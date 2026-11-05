// bandgap-tests.mjs — the Bandgap against its circuit solved independently of the C++
// (test/bandgap-circuit.mjs: the same equations by explicit Runge–Kutta at tens of nanoseconds a
// step, with hard rails; the small-signal response from complex impedances), Shockley's and SPICE's
// closed forms, E = hc/λ, and each knob's hint.

import { check, done, CI } from './harness.mjs';
import { loadPedal, loadBass } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { amplitudeAt, db, sine, peak } from '../tools/audio-util.mjs';
import { tune } from '../shared/tuner.js';
import { simulate, smallSignal, mag, circuit, diode, voltageAt, FAMILIES, k, q, h, c } from './bandgap-circuit.mjs';
import { DIODES } from '../bandgap/src/bandgap-params.js';

const { PEDAL, Effect } = await loadPedal('bandgap');
const x = Effect.exports;
const fs = 48000;
// at unity output (the Level's default is set for loudness: tools/loudness.mjs)
const D = { ...defaults(PEDAL.groups), level: 0 };
const W = (over) => ({ ...D, ...over });
const KINDS = DIODES.map(([id]) => id).filter((id) => id !== 'none');

// the C++ model through its exports
function call(fn, P, extra = [], args = [], out = 0) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length).set(v);
  if (extra.length) s.f64(extra.length, 8 * v.length).set(extra);
  x[fn](s.at, ...args);
  return { s, n: v.length, read: (count, at = 0) => Array.from(s.f64(count, 8 * at)) };
}
const cppParts = (P) => { const r = call('bandgap_parts', P).read(12); return { rail: r[0], sr: r[1], gbw: r[2], vs: r[3], Rf: r[4], Rg: r[5], Cg: r[6], Rt: r[7], Cd: r[8], level: r[9], Rft: r[10], Ct: r[11] }; };
function cppFamilies(P, i) {
  const r = call('bandgap_families', P, [i]).read(30);
  return KINDS.map((id, j) => ({ id, up: r[5 * j], down: r[5 * j + 1], v1: r[5 * j + 2], eg: r[5 * j + 3], lambda: r[5 * j + 4] }));
}
function cppIV(P, kind, volts) {
  const c2 = call('bandgap_iv', P, volts, [kind, volts.length]);
  return c2.read(volts.length, c2.n + volts.length);
}
function cppResponse(P, freqs) {
  const c2 = call('bandgap_response', P, freqs, [freqs.length]);
  return c2.read(freqs.length, c2.n + freqs.length);
}

function run(P, input, quality = 'high') {
  const e = new Effect(fs);
  e.setQuality(quality);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length);
  const ok = e.process(input, L, R);
  const out = { L, R, ok, messages: e.messages(), iterations: x.bandgap_iterations(x.px_effect(e.h)), failures: x.bandgap_failures(x.px_effect(e.h)), latency: e.latency() };
  e.destroy();
  return out;
}
// the engine's small-signal gain at f: a tiny sine after the low-cut capacitor has settled
function gain(P, f, quality = 'high') {
  const a = 1e-5, n = 16384, settle = 24000;
  const { L } = run(P, sine(f, fs, n + settle, a), quality);
  return amplitudeAt(L.subarray(settle), f, fs) / a;
}
// the first few harmonics' amplitudes of a steady periodic signal y at f (an integer number of periods)
function harmonics(y, f, count = 5) {
  return Array.from({ length: count }, (_, j) => amplitudeAt(y, (j + 1) * f, fs));
}

// 1. the diodes: Shockley's law with each family's 1 mA voltage, and E = hc/λ for the LEDs
{
  const fam = cppFamilies(W({}), 1e-3);
  let worst = 0;
  for (const f of fam) worst = Math.max(worst, Math.abs(f.up - FAMILIES[f.id].v1), Math.abs(f.down - FAMILIES[f.id].v1));
  check(worst < 1e-9, 'model: each family passes 1 mA at its stated voltage at 25 °C, both ways', `worst ${worst.toExponential(1)} V`);
  const leds = fam.filter((f) => f.lambda > 0);
  const hc = leds.map((f) => Math.abs(f.eg - (h * c) / (f.lambda * q)));
  check(leds.length === 3 && Math.max(...hc) < 1e-9, 'model: each LED\'s gap is its photon\'s energy, hc/λ', leds.map((f) => `${(f.lambda * 1e9).toFixed(0)} nm: ${f.eg.toFixed(3)} eV`).join(', '));
  // the order the switch promises, and the slope of V against 1/λ is about h/q
  const order = fam.map((f) => f.v1);
  check(order.every((v, i) => !i || v > order[i - 1]), 'the switch\'s order: each family turns on above the one before', order.map((v) => v.toFixed(2)).join(' < '));
  const [r, , b] = leds, slope = (b.v1 - r.v1) / (1 / b.lambda - 1 / r.lambda);
  check(Math.abs(slope / ((h * c) / q) - 1) < 1e-9, 'the LEDs\' turn-on voltage against 1/λ has slope hc/q: Planck\'s constant from a handful of LEDs', `${((slope * q) / c).toExponential(4)} J s`);
  // the I–V curves are Shockley's, here computed independently
  let ivWorst = 0;
  const volts = [-0.5, -0.3, -0.1, 0.05, 0.2, 0.35, 0.5];
  for (const [j, id] of KINDS.entries()) {
    const P = W({ diodes: id, temp: 37 }), C = circuit(P), got = cppIV(P, j, volts);
    volts.forEach((v, i) => {
      const want = C.d.is * Math.expm1(v / C.d.nvt) - C.d.is * Math.expm1(-v / C.d.nvt);
      ivWorst = Math.max(ivWorst, Math.abs(got[i] - want) / (Math.abs(want) + 1e-15));
    });
  }
  check(ivWorst < 1e-9, 'model: every family\'s current is Shockley\'s, both ways, at 37 °C', `worst ${ivWorst.toExponential(1)} relative`);
}

// 2. temperature: SPICE's law gives dV/dT = (V − Eg/q − XTI kT/q)/T at a fixed current
{
  const T = 298.15, a = cppFamilies(W({ temp: 24 }), 1e-3), b = cppFamilies(W({ temp: 26 }), 1e-3);
  const rows = KINDS.map((id, j) => {
    const f = FAMILIES[id], got = (b[j].up - a[j].up) / 2, want = (f.v1 - f.eg - (f.xti * k * T) / q) / T;
    return { id, got, want };
  });
  const worst = Math.max(...rows.map((r) => Math.abs(r.got / r.want - 1)));
  check(worst < 2e-3, 'temperature: each family\'s voltage at 1 mA moves by SPICE\'s closed form, (V − Eg − XTI kT/q)/T', rows.map((r) => `${r.id} ${(r.got * 1e3).toFixed(2)} mV/K`).join(', '));
  const si = rows.find((r) => r.id === 'si').got, ge = rows.find((r) => r.id === 'ge').got, led = rows.find((r) => r.id === 'red').got;
  check(Math.abs(si * 1e3 + 2) < 0.3 && Math.abs(ge * 1e3 + 1.5) < 0.3 && Math.abs(led * 1e3 + 1) < 0.3, 'the hint: about −2 mV/K for silicon, −1.5 for germanium, −1 for an LED', `${(si * 1e3).toFixed(2)}, ${(ge * 1e3).toFixed(2)}, ${(led * 1e3).toFixed(2)} mV/K`);
}

// 3. the parts against the hints: Drive's gain, the Filter's corners, the low cut, the rails
{
  const g = (d) => { const p = cppParts(W({ drive: d })); return 1 + p.Rf / p.Rg; };
  check(Math.abs(g(0) - 1.1) < 0.01 && Math.abs(g(1) - 101.1) < 0.05 && Math.abs(g(D.drive) - 16.1) < 0.2,
    'Drive: a gain from 1.1 to 101, 0 to 40 dB, and 16 (24 dB) at its default', `${g(0).toFixed(2)}, ${g(1).toFixed(1)}, ${g(D.drive).toFixed(1)} (${db(g(D.drive)).toFixed(1)} dB)`);
  const fc = (f) => { const p = cppParts(W({ filter: f })); return 1 / (2 * Math.PI * p.Rft * p.Ct); };
  check(Math.abs(fc(0) / 32e3 - 1) < 0.02 && Math.abs(fc(D.filter) / 2.2e3 - 1) < 0.05 && Math.abs(fc(1) / 475 - 1) < 0.02,
    'Filter: a low-pass from 32 kHz down to 475 Hz, 2.2 kHz at its default', `${(fc(0) / 1e3).toFixed(1)} kHz, ${(fc(D.filter) / 1e3).toFixed(2)} kHz, ${fc(1).toFixed(0)} Hz`);
  const lc = (C) => 1 / (2 * Math.PI * 1e3 * C);
  check(Math.abs(lc(10e-6) - 16) < 0.5 && Math.abs(lc(2.2e-6) - 72) < 1 && Math.abs(lc(0.22e-6) - 720) < 10, 'Low-cut capacitor: 16 Hz with 10 µF, 72 Hz with 2.2 µF, 720 Hz with 0.22 µF', `${lc(10e-6).toFixed(1)}, ${lc(2.2e-6).toFixed(1)}, ${lc(0.22e-6).toFixed(0)} Hz`);
  // and the engine's gain follows the low cut: at the corner, about 1/√2 of the way (in dB) from 1 to G
  const G = gain(W({ diodes: 'none', lowCut: 2.2e-6 }), 1000), lo = gain(W({ diodes: 'none', lowCut: 2.2e-6 }), 20), lo10 = gain(W({ diodes: 'none' }), 20);
  check(lo < G / 2 && lo10 > 0.7 * G, 'the low cut: 2.2 µF leaves a 20 Hz note far less driven, 10 µF hardly less', `20 Hz at ${db(lo / G).toFixed(1)} dB with 2.2 µF, ${db(lo10 / G).toFixed(1)} dB with 10 µF`);
  const r9 = cppParts(W({ supply: 9 })).rail, r18 = cppParts(W({ supply: 18 })).rail;
  check(Math.abs(r9 - 3) < 1e-9 && Math.abs(r18 - 7.5) < 1e-9, 'Supply: the op-amp swings to ±3 V from 9 V, ±7.5 V from 18 V', `±${r9} V, ±${r18} V`);
  const lm = cppParts(W({ opamp: 'lm308' })), tl = cppParts(W({ opamp: 'tl072' })), ua = cppParts(W({ opamp: 'ua741' }));
  const swing = (2 * lm.rail) / lm.sr, swingTL = (2 * tl.rail) / tl.sr;
  check(Math.abs(swing - 20e-6) < 1e-7 && swingTL < 0.6e-6 && Math.abs(lm.gbw / 101 - 10e3) < 200 && Math.abs(tl.gbw / 101 - 30e3) < 500 && ua.sr === 0.5e6,
    'Op-amp: the LM308 swings rail to rail in 20 µs, the TL072 in half a microsecond; at full drive 10 kHz of bandwidth against 30 kHz', `${(swing * 1e6).toFixed(1)} µs, ${(swingTL * 1e6).toFixed(2)} µs`);
}

// 4. the small-signal response: the C++'s closed form and the engine against complex nodal analysis
{
  const freqs = [20, 50, 100, 300, 1000, 3000, 8000];
  const settings = { 'default': {}, 'drive up, filter down': { drive: 1, filter: 0 }, 'drive down': { drive: 0.1 }, 'filter up': { filter: 1 },
    'fast op-amp, low cut': { opamp: 'tl072', drive: 1, lowCut: 0.22e-6 }, 'germanium': { diodes: 'ge' } };
  for (const [name, over] of Object.entries(settings)) {
    const P = W(over), want = freqs.map((f) => mag(smallSignal(P, f))), cpp = cppResponse(P, freqs);
    const closed = Math.max(...freqs.map((f, i) => Math.abs(db(cpp[i] / want[i]))));
    const engine = Math.max(...freqs.map((f, i) => Math.abs(db(gain(P, f) / want[i]))));
    check(closed < 0.01 && engine < 0.3, `small signal, "${name}": the model's response and the engine's are nodal analysis's, 20 Hz–8 kHz`, `closed form ${closed.toFixed(4)} dB, engine ${engine.toFixed(3)} dB at worst`);
  }
}

// 5. large signal: the engine against the circuit integrated independently, harmonic by harmonic
{
  const f = 100, settle = 7200, len = 4800; // 0.15 s to settle, then ten periods
  const settings = {
    'silicon': {}, 'germanium': { diodes: 'ge' }, 'blue LEDs': { diodes: 'blue' }, 'no diodes: the rails': { diodes: 'none' },
    'lopsided': { perSide: 'asym' }, 'two each way, filter up': { perSide: 'two', filter: 0.8 }, 'full drive, slow op-amp': { drive: 1, filter: 0 },
    'full drive, fast op-amp, hot': { drive: 1, filter: 0, opamp: 'tl072', temp: 45 },
  };
  for (const [name, over] of Object.entries(settings)) {
    const P = W(over), inp = sine(f, fs, settle + len, 0.25);
    const want = harmonics(simulate(P, inp, fs, 256).subarray(settle), f), got = harmonics(run(P, inp).L.subarray(settle), f);
    const ref = want[0];
    const worst = Math.max(...want.map((w, i) => Math.abs(got[i] - w) / ref));
    check(worst < 0.01, `large signal, "${name}": the engine's first five harmonics are the independent integration's, within 1 % of the fundamental`, `fundamental ${ref.toFixed(3)} V; worst ${(100 * worst).toFixed(2)} %`);
  }
}

// 6. the hints on the sound
const TB = await loadBass();
function note(key = 33, velocity = 0.8, seconds = 1) {
  const b = new TB(fs);
  b.note(key, velocity);
  const out = new Float32Array(Math.round(seconds * fs));
  b.process(out);
  return out;
}
const steady = (P, f = 110, a = 0.25) => run(P, sine(f, fs, fs, a)).L.subarray(fs / 2);
{
  // the clipping levels climb with the bandgap
  const peaks = DIODES.map(([id]) => peak(steady(W({ diodes: id }))));
  check(peaks.every((p, i) => !i || p > peaks[i - 1]), 'Diodes: the louder, the higher the gap, from germanium to blue, then None', peaks.map((p) => p.toFixed(2)).join(' < '));
  const [ge, , si, red, green, blue, none] = peaks;
  check(ge > 0.25 && ge < 0.4 && si > 0.5 && si < 0.7 && Math.abs(red - 1.8) < 0.15 && Math.abs(green - 2.2) < 0.15 && Math.abs(blue - 2.5) < 0.15,
    'the hint: about 0.3 V germanium, 0.6 V silicon, red LEDs 1.8 V, green 2.2 V, blue 2.5 V', `${ge.toFixed(2)}, ${si.toFixed(2)}, ${red.toFixed(2)}, ${green.toFixed(2)}, ${blue.toFixed(2)} V`);
  check(Math.abs(none - 3) < 0.3, 'None: only the op-amp\'s rails, ±3 V at 9 V', `${none.toFixed(2)} V`);
  check(red > 5 * ge, 'Level: LEDs come out several times louder than germanium', `× ${(red / ge).toFixed(1)}`);
  // two each way about twice the level; one up and two down: even harmonics
  const two = peak(steady(W({ perSide: 'two' })));
  check(two > 1.7 * si && two < 2.2 * si, 'two each way: about twice the voltage', `${two.toFixed(2)} V against ${si.toFixed(2)} V`);
  const hs = harmonics(steady(W({}), 100), 100), ha = harmonics(steady(W({ perSide: 'asym' }), 100), 100);
  check(hs[1] / hs[0] < 1e-3 && ha[1] / ha[0] > 0.03, 'one up and two down adds the even harmonics a symmetrical clipper doesn\'t make', `2nd at ${db(hs[1] / hs[0]).toFixed(0)} dB symmetrical, ${db(ha[1] / ha[0]).toFixed(1)} dB lopsided`);
  // temperature: warm clips lower and quieter
  const cold = peak(steady(W({ temp: -5 }))), hot = peak(steady(W({ temp: 45 })));
  check(cold > si && si > hot && db(cold / hot) > 1, 'Temperature: warm diodes clip lower and quieter, cold ones higher', `${cold.toFixed(3)} V at −5 °C, ${si.toFixed(3)} V at 25 °C, ${hot.toFixed(3)} V at 45 °C`);
  // the supply: with no diodes, the rails move out
  const r18 = peak(steady(W({ diodes: 'none', supply: 18 }), 110, 0.6));
  check(Math.abs(r18 - 7.5) < 0.6, 'Supply: from 18 V, with no diodes, the output reaches ±7.5 V', `${r18.toFixed(2)} V`);
  // the Filter: up, darker and gentler, and less current into the LEDs
  const hiF = (fl) => { const y = harmonics(steady(W({ filter: fl }), 100), 100, 29); return y.slice(9).reduce((a, b) => a + b * b, 0) / y[0] ** 2; };
  check(hiF(0.9) < hiF(0.1) / 4, 'Filter: turned up, the clipping\'s high harmonics fall away (by more than 6 dB, 1–3 kHz)', `${(10 * Math.log10(hiF(0.1))).toFixed(1)} dB of 10th–29th harmonics at 10 %, ${(10 * Math.log10(hiF(0.9))).toFixed(1)} dB at 90 %`);
  // the diodes clip the same whatever the Filter: it comes after them
  const ledI = (over) => Math.max(...run(W({ diodes: 'red', ...over }), sine(110, fs, fs / 2, 0.25)).messages.filter((m) => m.type === 1).flatMap((m) => [0, 1, 2, 3, 4, 5, 6].map((j) => Math.abs(m.values[4 * j + 1]))));
  const i1 = ledI({ filter: 0.1 }), i9 = ledI({ filter: 0.9 }), iLow = ledI({ drive: 0.3 });
  check(Math.abs(i9 / i1 - 1) < 0.02 && iLow < i1 / 2, 'the Filter can\'t change how hard the diodes clip (the LEDs\' current is the same); the Drive can', `${(i1 * 1e3).toFixed(2)} mA at 10 %, ${(i9 * 1e3).toFixed(2)} mA at 90 %; ${(iLow * 1e3).toFixed(2)} mA with Drive at 30 %`);
  // the op-amp: a shade darker on high notes, flat out, with the LM308
  const hi = (op) => { const y = harmonics(steady(W({ opamp: op, drive: 1, filter: 0 }), 1000, 0.3), 1000, 21); return y.slice(6).reduce((a, b) => a + b * b, 0) / y[0] ** 2; };
  const dl = 10 * Math.log10(hi('lm308')), dt = 10 * Math.log10(hi('tl072'));
  check(dl < dt && dt - dl < 3, 'Op-amp: flat out on a high note the LM308 is a shade darker than the TL072', `harmonics 7–21 at ${dl.toFixed(2)} dB against ${dt.toFixed(2)} dB`);
}

// 7. the solver: Newton converges, fast, on a loud note at every quality and every diode
for (const qu of ['high', 'medium', 'low']) {
  let worstIt = 0, fails = 0, finite = true;
  const loud = Float32Array.from(note(28, 1, 1), (v) => 3 * v);
  for (const id of DIODES.map(([d]) => d)) {
    const r = run(W({ diodes: id, drive: 1, filter: 0 }), loud, qu);
    worstIt = Math.max(worstIt, r.iterations); fails += r.failures; finite &&= r.L.every(Number.isFinite);
  }
  check(fails === 0 && finite && worstIt < 4, `Newton converges on a loud note through every diode, flat out (${qu} quality)`, `${worstIt.toFixed(2)} iterations a step at worst`);
}

// 8. hygiene
{
  const r = run(W({}), new Float32Array(fs));
  check(peak(r.L) < 1e-9, 'silence in, silence out', `${peak(r.L).toExponential(1)} V`);
  const e = new Effect(fs);
  e.setParams(W({}));
  const bad = new Float32Array(128); bad[5] = NaN;
  const L = new Float32Array(4096), R = new Float32Array(4096);
  const ok = e.process(bad, L.subarray(0, 128), R.subarray(0, 128));
  e.process(sine(100, fs, 4096, 0.1), L, R);
  check(!ok && L.every(Number.isFinite) && peak(L) > 0.01, 'a NaN in comes out as a silent block, and the pedal recovers');
  e.destroy();
  check(L.every(Number.isFinite) && R.every((v, i) => v === L[i]), 'mono out on both sides');
  const lat = ['high', 'medium', 'low'].map((qu) => run(W({}), new Float32Array(128), qu).latency);
  check(lat[2] === 0 && lat[0] > 0 && lat[0] <= 5, 'latency: the oversampling filters\' few samples, none at low quality', lat.join(', '));
}

// 9. presets stay in range, and set real choices
{
  const ids = new Map(PEDAL.groups.flatMap((g) => g.params).map((p) => [p.id, p]));
  const bad = Object.entries(PEDAL.presets).flatMap(([n, v]) => Object.entries(v).filter(([id, val]) => {
    const p = ids.get(id);
    if (!p) return true;
    if (p.type === 'select') return !p.options.some(([o]) => o === val);
    return typeof val === 'number' && (val < p.min || val > p.max);
  }).map(([id]) => `${n}: ${id}`));
  check(!bad.length, 'every preset sets real parameters inside their ranges', bad.join(', '));
}

// 10. end to end: the test bass's note keeps its pitch through the overdrive
{
  // clipping mixes the string's upper partials, a little sharp of harmonic as a stiff string's are,
  // into the period the tuner reads, so it reads a couple of cents sharp, as on a real overdrive
  const dry = note(33, 0.8), y = run(W({}), dry).L, after = (z) => z.subarray(4800);
  const f0 = tune(after(y).subarray(0, 16384), fs), want = tune(after(dry).subarray(0, 16384), fs);
  check(f0 && want && Math.abs(1200 * Math.log2(f0 / want)) < 4, 'the test bass\'s A keeps its pitch through the diodes, to the tuner\'s eye (4 cents)', `${f0?.toFixed(3)} Hz out for ${want?.toFixed(3)} Hz in`);
}

// 11. CPU
if (!CI) {
  const n = 10 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 82.4 * i) / fs) * Math.exp(-(i % fs) / fs));
  for (const [qu, budget] of [['high', 0.12], ['medium', 0.07]]) {
    const e = new Effect(fs);
    e.setQuality(qu);
    e.setParams(W({}));
    const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
    e.process(inp, L, R);
    const share = (performance.now() - t0) / 1000 / 10;
    e.destroy();
    check(share < budget, `CPU: ${qu} quality under ${(100 * budget).toFixed(0)} % of a core (WebAssembly)`, `${(100 * share).toFixed(1)} %`);
  }
}

done();
