// phuzz-tests.mjs — the Phuzz against circuit theory written here, independently of the C++
// (test/phuzz-circuit.mjs: Newton on every node voltage for the DC operating point, complex nodal
// analysis around it for the small-signal response), Ebers–Moll's closed forms, Kirchhoff's
// current law, and each knob's hint.

import { check, done, CI } from './harness.mjs';
import { loadPedal, loadBass } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { amplitudeAt, db, sine, peak, rms } from '../tools/audio-util.mjs';
import { tune } from '../shared/tuner.js';
import { operatingPoint, smallSignal, inputImpedance, mag, transistor, T0, PARTS } from './phuzz-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('phuzz');
const x = Effect.exports;
const fs = 48000;
// at the output knob's unity setting (its default is set for loudness: tools/loudness.mjs)
const D = { ...defaults(PEDAL.groups), volume: 1 };
const W = (over) => ({ ...D, ...over });

// the C++ model through its exports
function cppOperatingPoint(P) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length).set(v);
  x.phuzz_operating_point(s.at);
  const r = Array.from(s.f64(18));
  return { node: r.slice(0, 10), i: r.slice(10, 14), v: r.slice(14, 18) };
}
// a transistor's collector current at |V_CE| for base current ib (the C++ model's characteristics)
function cppIc(P, which, vce, ib) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length).set(v);
  s.f64(2, 8 * v.length).set([vce, ib]);
  x.phuzz_characteristics(s.at, which, 1, 1);
  return s.f64(1, 8 * (v.length + 2))[0];
}
function run(P, input, quality = 'high') {
  const e = new Effect(fs);
  e.setQuality(quality);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length);
  const ok = e.process(input, L, R);
  const out = { L, R, ok, messages: e.messages(), iterations: x.phuzz_iterations(x.px_effect(e.h)), failures: x.phuzz_failures(x.px_effect(e.h)), latency: e.latency() };
  e.destroy();
  return out;
}
// the engine's small-signal gain at f: a tiny sine after the coupling capacitors have settled
function gain(P, f, quality = 'high') {
  const a = 1e-5, n = 16384, settle = 16384;
  const inp = sine(f, fs, n + settle, a), { L } = run(P, inp, quality);
  return amplitudeAt(L.subarray(settle), f, fs) / a;
}
// the engine's phase lag at f (radians), from the same sine
function phase(P, f, quality) {
  const a = 1e-5, n = 16384, settle = 16384, inp = sine(f, fs, n + settle, a), { L } = run(P, inp, quality);
  let re = 0, im = 0;
  for (let i = settle; i < n + settle; i++) { re += L[i] * Math.sin((2 * Math.PI * f * i) / fs); im += L[i] * Math.cos((2 * Math.PI * f * i) / fs); }
  return Math.atan2(im, re);
}
const ss = (P, f) => mag(smallSignal(P, [f])[0].out);

// 1. the DC operating point: the C++ (DK, Newton on four junctions) against Newton on all nodes
{
  let worst = 0;
  for (const over of [{}, { temp: -10 }, { temp: 45 }, { fuzz: 0.2 }, { battery: 6, battR: 400 }, { leak1: 300e-6 }, { hfe1: 30, hfe2: 220 }, { bias: 3000 }, { active: true }]) {
    const c = cppOperatingPoint(W(over)), j = operatingPoint(W(over));
    c.node.forEach((v, k) => { worst = Math.max(worst, Math.abs(v - j.V[k])); });
  }
  check(worst < 1e-6, 'model: the operating point is the nodal analysis\'s, at nine settings', `worst ${worst.toExponential(1)} V`);
}

// 2. Kirchhoff's current law at the operating point, from the C++'s own node voltages and currents
{
  const P = W({ battR: 50 }), { node, i } = cppOperatingPoint(P);
  const [, B, K1, E2, Wn, K2, X, S] = node;
  const errs = [
    i[2] - (K2 - X) / P.bias,                                    // Q2's collector current, down R3
    (K2 - X) / P.bias - (X - S) / PARTS.R2,                      // through X (no DC through C3)
    i[0] + i[3] - (K1 - S) / PARTS.R1,                           // Q1's collector and Q2's base, down R1
    i[1] - (B - E2) / PARTS.R4,                                  // Q1's base current, through the feedback resistor
    i[2] + i[3] - (B - E2) / PARTS.R4 + E2 / (PARTS.FUZZ + 1),   // Q2's emitter: the feedback and the Fuzz pot (and its 1 Ω end)
    (X - S) / PARTS.R2 + (K1 - S) / PARTS.R1 - (S + P.battery) / P.battR, // into the battery
  ];
  const worst = Math.max(...errs.map(Math.abs));
  check(worst < 1e-9 && Math.abs(Wn / E2 - PARTS.FUZZ / (PARTS.FUZZ + 1)) < 1e-6, 'model: every DC current balances at its node, and the battery supplies them all', `worst ${worst.toExponential(1)} A`);
}

// 3. Ebers–Moll's closed forms: with the base open, the collector current is the leakage the
// parameter names, and germanium's doubles every 7 °C or so
{
  const P = W({}), icOpen = cppIc(P, 0, 6, 0);
  check(Math.abs(icOpen / P.leak1 - 1) < 1e-3, 'model: with the base open, Q1 passes its leakage I_CEO', `${(icOpen * 1e6).toFixed(2)} µA for ${(P.leak1 * 1e6).toFixed(0)} µA`);
  const r = cppIc(W({ temp: 27 }), 0, 6, 0) / icOpen;
  const q20 = transistor(P.hfe1, P.leak1, T0), q27 = transistor(P.hfe1, P.leak1, T0 + 7);
  check(r > 1.8 && r < 2.3 && Math.abs(r / (q27.is / q20.is * ((q27.bF + q27.bR + 1) / q27.bR) / ((q20.bF + q20.bR + 1) / q20.bR)) - 1) < 1e-3,
    'temperature: 7 °C warmer, about twice the leakage (Is from SPICE\'s law with Eg = 0.67 eV)', `× ${r.toFixed(2)}`);
  // in the active region I_C = βF I_B + I_CEO
  const ib = 3e-6, ic = cppIc(P, 1, 4, ib);
  check(Math.abs(ic / (P.hfe2 * ib + P.leak2) - 1) < 0.01, 'model: in its active region I_C = hFE·I_B + I_CEO', `${(ic * 1e3).toFixed(4)} mA against ${((P.hfe2 * ib + P.leak2) * 1e3).toFixed(4)} mA`);
}

// 4. the engine's small-signal response against complex nodal analysis around the operating point
{
  const freqs = [50, 100, 200, 500, 1000, 2000, 4000, 8000];
  const settings = { 'full fuzz': {}, 'fuzz at half': { fuzz: 0.5 }, 'fuzz down': { fuzz: 0.05 }, 'hot': { temp: 40 }, 'dying battery': { battery: 7, battR: 200 },
    'volume at 0.7, long cable': { volume: 0.7, outCable: 20 }, 'active bass': { active: true }, 'heavy pickup': { pickupL: 8, pickupR: 15000 } };
  for (const [name, over] of Object.entries(settings)) {
    let worst = 0;
    for (const f of freqs) worst = Math.max(worst, Math.abs(db(gain(W(over), f)) - db(ss(W(over), f))));
    check(worst < 0.5, `engine: "${name}" follows the circuit's small-signal response, 50 Hz–8 kHz`, `worst ${worst.toFixed(3)} dB`);
  }
}

// 5. the hints
{
  // fuzz: the gain falls by about 25 dB by halfway, and the input impedance to a few hundred ohms
  const fall = db(ss(W({}), 500) / ss(W({ fuzz: 0.5 }), 500));
  check(fall > 20 && fall < 30, 'fuzz at half: about 25 dB less gain', `${fall.toFixed(1)} dB less at 500 Hz`);
  const z1 = mag(inputImpedance(W({}), 1000)), zh = mag(inputImpedance(W({ fuzz: 0.5 }), 1000));
  check(z1 > 3e3 && z1 < 10e3 && zh < 1000, 'and the input impedance falls from a few kilohms to a few hundred ohms', `${(z1 / 1e3).toFixed(2)} kΩ full, ${zh.toFixed(0)} Ω at half`);
  // volume: halfway is −20 dB
  const v = db(gain(W({ volume: 0.5 }), 1000) / gain(W({}), 1000));
  check(Math.abs(v + 20) < 1.5, 'volume at half: about −20 dB', `${v.toFixed(1)} dB`);
}

// a note of the test bass, and what the Phuzz makes of it
const TB = await loadBass();
function note(key = 28, velocity = 0.8, seconds = 1) {
  const b = new TB(fs);
  b.note(key, velocity);
  const out = new Float32Array(Math.round(seconds * fs));
  b.process(out);
  return out;
}
const E = note();
const after = (y) => y.subarray(4800); // past the first 0.1 s, the attack
function asymmetry(y) { // |positive peak / negative peak − 1|
  let mx = -Infinity, mn = Infinity;
  for (const v of after(y)) { mx = Math.max(mx, v); mn = Math.min(mn, v); }
  return Math.abs(mx / -mn - 1);
}
{
  const dry = peak(E), y = run(W({}), E).L, p = db(peak(after(y)) / dry), r = db(rms(after(y)) / rms(E));
  check(p > 0 && p < 10 && r - p > 3, 'volume full: peaks a few dB above the bass\'s own, and louder still by its power (a nearly square wave)', `peaks ${p.toFixed(1)} dB, power ${r.toFixed(1)} dB`);

  // temperature: hotter, Q2 is starved and its collector slides toward the battery
  const vc2 = (t) => cppOperatingPoint(W({ temp: t })).node[5];
  check(vc2(0) > vc2(20) && vc2(20) > vc2(40) && vc2(40) < -7, 'hotter: Q2\'s collector slides toward the battery', `${vc2(0).toFixed(2)} V at 0 °C, ${vc2(20).toFixed(2)} V at 20 °C, ${vc2(40).toFixed(2)} V at 40 °C`);
  const a0 = asymmetry(run(W({ temp: 0 }), E).L), a38 = asymmetry(run(W({ temp: 38 }), E).L);
  check(a0 < a38, 'cold, it clips more evenly than hot', `peaks ${(100 * a0).toFixed(0)} % apart at 0 °C, ${(100 * a38).toFixed(0)} % at 38 °C`);
  const lost = db(ss(W({}), 1000) / ss(W({ temp: 50 }), 1000));
  check(lost > 20, 'near 50 °C most of the gain is gone', `${lost.toFixed(1)} dB less at 1 kHz`);

  // battery: less voltage, the output clips lower
  const clip = (V) => peak(run(W({ battery: V }), sine(110, fs, fs, 0.5)).L.subarray(fs / 2));
  check(clip(7) < 0.85 * clip(9), 'a flat battery: the output clips lower', `${clip(9).toFixed(3)} V peak at 9 V, ${clip(7).toFixed(3)} V at 7 V`);

  // battery resistance: the rail sags with each note, and the output is a little louder
  const rail = (R) => { const m = run(W({ battR: R }), E).messages.filter((q) => q.type === 1).map((q) => q.values[28]); return Math.max(...m) - Math.min(...m); };
  check(rail(200) > 50 * rail(2) && rail(200) > 0.05, 'an old battery: the rail sags with each note', `${(1000 * rail(2)).toFixed(1)} mV of sag at 2 Ω, ${(1000 * rail(200)).toFixed(0)} mV at 200 Ω`);
  const louder = db(peak(after(run(W({ battR: 200 }), E).L)) / peak(after(y)));
  check(louder > 0.5, 'and the output comes out a little louder', `+${louder.toFixed(1)} dB`);

  // bias: more resistance lifts the collector off the battery; about 12 kΩ clips evenly
  const op = (R) => cppOperatingPoint(W({ bias: R })).node[5];
  const a12 = asymmetry(run(W({ bias: 12000 }), E).L), a56 = asymmetry(run(W({ bias: 5600 }), E).L);
  check(op(12000) > op(8200) && op(8200) > op(5600) && a12 < 0.03 && a56 > a12, 'Q2\'s collector resistor: more lifts the collector off the battery, and 12 kΩ clips evenly', `${op(5600).toFixed(2)}, ${op(8200).toFixed(2)}, ${op(12000).toFixed(2)} V; peaks ${(100 * a12).toFixed(1)} % apart at 12 kΩ, ${(100 * a56).toFixed(1)} % at 5.6 kΩ`);

  // the transistors
  const zin = (o) => mag(inputImpedance(W(o), 1000));
  check(zin({ hfe1: 120 }) > zin({}) && ss(W({ hfe1: 120 }), 1000) > ss(W({}), 1000), 'Q1\'s gain: more raises the input impedance and the gain a little', `${(zin({}) / 1e3).toFixed(2)} → ${(zin({ hfe1: 120 }) / 1e3).toFixed(2)} kΩ`);
  check(ss(W({ hfe2: 200 }), 1000) > 1.1 * ss(W({}), 1000), 'Q2\'s gain: more, a little more gain', `+${db(ss(W({ hfe2: 200 }), 1000) / ss(W({}), 1000)).toFixed(1)} dB`);
  const ic2 = (o) => operatingPoint(W(o)).q2.ic;
  const byQ1 = 1 - ic2({ leak1: 3 * D.leak1 }) / ic2({}), byQ2 = Math.abs(1 - ic2({ leak2: 3 * D.leak2 }) / ic2({}));
  check(byQ1 > 0.1 && byQ2 < byQ1 / 5, 'Q1\'s leakage starves Q2; Q2\'s own matters much less', `three times Q1's: Q2's current ${(100 * byQ1).toFixed(0)} % less; three times Q2's: ${(100 * byQ2).toFixed(1)} %`);

  // the cables and the load
  let moved = 0;
  for (const f of [100, 500, 1000, 2000, 4000, 8000]) moved = Math.max(moved, Math.abs(db(ss(W({ cable: 10 }), f) / ss(W({ cable: 1 }), f))));
  check(moved < 1, 'the cable from the bass hardly matters into this input', `1 m against 10 m: ${moved.toFixed(2)} dB at most`);
  const dark = db(ss(W({ volume: 0.7, outCable: 30 }), 5000) / ss(W({ volume: 0.7, outCable: 0.3 }), 5000));
  check(dark < -6, 'below full volume a long cable to the amp darkens it', `${dark.toFixed(1)} dB at 5 kHz, 30 m against 0.3 m`);
  check(ss(W({ load: 10e3 }), 1000) < 0.7 * ss(W({}), 1000), 'a low input after it loads the volume pot', `${db(ss(W({ load: 10e3 }), 1000) / ss(W({}), 1000)).toFixed(1)} dB into 10 kΩ`);
}

// 6. the solver: Newton converges, fast, on a loud riff at every quality
for (const q of ['high', 'medium', 'low']) {
  const r = run(W({ battR: 100 }), Float32Array.from(note(28, 1, 2), (v) => 2 * v), q);
  check(r.failures === 0 && r.iterations < 2.5 && r.L.every(Number.isFinite), `Newton converges on a loud note (${q} quality)`, `${r.iterations.toFixed(2)} iterations a sample`);
}

// 7. aliasing: oversampling keeps the inharmonic products of a loud high note down
{
  const f = 2500, n = 4800; // 250 periods, so the harmonics fall on bins exactly
  const inharmonic = (q) => {
    const y = run(W({}), sine(f, fs, fs + n, 0.3), q).L.subarray(fs);
    let tot = 0, bad = 0;
    for (let k = 1; k < n / 2; k++) {
      let re = 0, im = 0;
      for (let i = 0; i < n; i++) { const w = (2 * Math.PI * k * i) / n; re += y[i] * Math.cos(w); im -= y[i] * Math.sin(w); }
      const pw = re * re + im * im, h = (k * fs) / n / f;
      tot += pw;
      if (Math.abs(h - Math.round(h)) > 1e-6) bad += pw;
    }
    return 10 * Math.log10(bad / tot);
  };
  const hi = inharmonic('high'), lo = inharmonic('low');
  check(hi < -30 && hi < lo - 10, 'aliasing: at high quality (4×) the inharmonic products of a loud 2.5 kHz note are 30 dB down', `${hi.toFixed(1)} dB at high, ${lo.toFixed(1)} dB with no oversampling`);
}

// 8. hygiene
{
  const r = run(W({}), new Float32Array(fs));
  check(peak(r.L) < 1e-6, 'silence in, silence out: the operating point is where it rests', `${peak(r.L).toExponential(1)} V`);
  const e = new Effect(fs);
  e.setParams(W({}));
  const bad = new Float32Array(128); bad[5] = NaN;
  const L = new Float32Array(4096), R = new Float32Array(4096);
  const ok = e.process(bad, L.subarray(0, 128), R.subarray(0, 128));
  e.process(sine(100, fs, 4096, 0.1), L, R);
  check(!ok && L.every(Number.isFinite) && peak(L) > 0.01, 'a NaN in comes out as a silent block, and the pedal recovers');
  e.destroy();
  // the latency reported is the oversampling filters' delay: the phase the high quality adds at
  // low frequencies over the unfiltered circuit's
  const f = 300, extra = phase(W({ fuzz: 0.05 }), f, 'high') - phase(W({ fuzz: 0.05 }), f, 'low');
  const lag = (-extra / (2 * Math.PI * f)) * fs;
  check(Math.abs(lag - r.latency) < 0.6 && r.latency <= 5, 'latency: what latency() reports, a few samples', `${lag.toFixed(2)} samples measured, ${r.latency} reported`);
  check(L.every(Number.isFinite) && R.every((v, i) => v === L[i]), 'mono out on both sides');
}

// 9. presets stay in range
{
  const ids = new Map(PEDAL.groups.flatMap((g) => g.params).map((p) => [p.id, p]));
  const bad = Object.entries(PEDAL.presets).flatMap(([n, v]) => Object.entries(v).filter(([id, val]) => !ids.has(id) || (typeof val === 'number' && (val < ids.get(id).min || val > ids.get(id).max))).map(([id]) => `${n}: ${id}`));
  check(!bad.length, 'every preset sets real parameters inside their ranges', bad.join(', '));
}

// 10. end to end: the test bass's note keeps its pitch through the fuzz
{
  const dry = note(33, 0.8), y = run(W({}), dry).L;
  // the tuner reads the first partial, which the fuzz moves no more than a clipper moves a sine's
  const f0 = tune(after(y).subarray(0, 16384), fs), want = tune(after(dry).subarray(0, 16384), fs);
  check(f0 && want && Math.abs(1200 * Math.log2(f0 / want)) < 2, 'the test bass\'s A keeps its first partial through the fuzz, to the tuner\'s eye (2 cents)', `${f0?.toFixed(3)} Hz out for ${want?.toFixed(3)} Hz in`);
}

// 11. CPU
if (!CI) {
  const n = 10 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 82.4 * i) / fs) * Math.exp(-(i % fs) / fs));
  for (const [q, budget] of [['high', 0.12], ['medium', 0.07]]) {
    const e = new Effect(fs);
    e.setQuality(q);
    e.setParams(W({}));
    const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
    e.process(inp, L, R);
    const share = (performance.now() - t0) / 1000 / 10;
    e.destroy();
    check(share < budget, `CPU: ${q} quality under ${(100 * budget).toFixed(0)} % of a core (WebAssembly)`, `${(100 * share).toFixed(1)} %`);
  }
  // the silence after a note costs what silence from rest does: the oversampler's filters, ringing
  // down, would otherwise sit among denormal numbers (which WebAssembly can't flush to zero)
  const silence = (afterNote) => {
    const e = new Effect(fs);
    e.setParams(W({}));
    const z = new Float32Array(fs), L = new Float32Array(fs), R = new Float32Array(fs);
    if (afterNote) e.process(inp.subarray(0, fs), L, R);
    e.process(z, L, R); e.process(z, L, R); // two seconds to ring down
    const t0 = performance.now();
    for (let s = 0; s < 3; s++) e.process(z, L, R);
    const ms = (performance.now() - t0) / 3;
    e.destroy();
    return ms;
  };
  const rest = silence(false), late = silence(true);
  check(late < 2 * rest + 5, 'CPU: the silence after a note costs what silence from rest does (no denormals)', `${late.toFixed(0)} ms a second after a note, ${rest.toFixed(0)} ms from rest`);
}

done();
