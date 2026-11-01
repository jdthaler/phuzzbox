// preamp-tests.mjs — the Tube Preamp against circuit theory written here, independently of the
// C++ (test/preamp-circuit.mjs: Newton on every node voltage for the DC operating point, complex
// nodal analysis around it for the small-signal response, Yeh and Smith's closed form for the
// tone stack), Kirchhoff's current law, Kuehnel's analysis of the Bassman, and each knob's hint.

import { check, done, CI } from './harness.mjs';
import { loadPedal, loadBass } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { amplitudeAt, db, sine, peak } from '../tools/audio-util.mjs';
import { tune } from '../shared/tuner.js';
import { operatingPoint, smallSignal, yehSmith, toneStackNodal, triode, mag, ratio, TUBES, PARTS, N } from './preamp-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('preamp');
const x = Effect.exports;
const fs = 48000;
const D = defaults(PEDAL.groups);
const W = (over) => ({ ...D, ...over });
const NODES = Object.keys(N);

// the C++ model through its exports
function cppOperatingPoint(P) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length).set(v);
  x.preamp_operating_point(s.at);
  const r = Array.from(s.f64(NODES.length + 12));
  return { node: Object.fromEntries(NODES.map((n, i) => [n, r[i]])), V: r.slice(0, NODES.length), tubes: [0, 1, 2].map((t) => { const o = r.slice(NODES.length + 4 * t); return { vg: o[0], va: o[1], ig: o[2], ia: o[3] }; }) };
}
function cppResponse(P, freqs) {
  const s = scratch(x), v = Effect.native(P), n = freqs.length;
  s.f64(v.length).set(v);
  s.f64(n, 8 * v.length).set(freqs);
  x.preamp_response(s.at, n);
  const out = Array.from(s.f64(3 * n, 8 * (v.length + n)));
  return { mag: out.slice(0, n), phase: out.slice(n, 2 * n), stack: out.slice(2 * n) };
}
function cppPlate(P, va, vg) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length).set(v);
  s.f64(2, 8 * v.length).set([va, vg]);
  x.preamp_plate_curves(s.at, 1, 1);
  return s.f64(1, 8 * (v.length + 2))[0];
}
function run(P, input, quality = 'high') {
  const e = new Effect(fs);
  e.setQuality(quality);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length);
  const ok = e.process(input, L, R);
  const out = { L, R, ok, messages: e.messages(), iterations: x.preamp_iterations(x.px_effect(e.h)), failures: x.preamp_failures(x.px_effect(e.h)), latency: e.latency() };
  e.destroy();
  return out;
}
// the engine's small-signal gain at f: a tiny sine after the coupling capacitors have settled
function gain(P, f, quality = 'high') {
  const a = 1e-5, n = 16384, settle = 24000;
  const { L } = run(P, sine(f, fs, n + settle, a), quality);
  return amplitudeAt(L.subarray(settle), f, fs) / a;
}
function phase(P, f, quality) {
  const a = 1e-5, n = 16384, settle = 24000, { L } = run(P, sine(f, fs, n + settle, a), quality);
  let re = 0, im = 0;
  for (let i = settle; i < n + settle; i++) { re += L[i] * Math.sin((2 * Math.PI * f * i) / fs); im += L[i] * Math.cos((2 * Math.PI * f * i) / fs); }
  return Math.atan2(im, re);
}
const ss = (P, f) => mag(smallSignal(P, f).V);
// the harmonics of a steady sine through the engine, against its fundamental (dB)
function harmonics(P, f, amp, quality = 'high') {
  const settle = fs, n = Math.round(fs / f) * Math.round(0.25 * f); // a whole number of periods
  const y = run(P, sine(f, fs, settle + n, amp), quality).L.subarray(settle, settle + n);
  const a = (k) => amplitudeAt(y, k * f, fs);
  const h1 = a(1);
  return { h2: db(a(2) / h1), h3: db(a(3) / h1), thd: db(Math.sqrt([2, 3, 4, 5, 6, 7].reduce((s, k) => s + a(k) ** 2, 0)) / h1), y };
}

// 1. the model's own triode is the paper's equations
{
  let worst = 0;
  for (const tube of Object.keys(TUBES)) for (const [va, vg] of [[250, -2], [150, -1], [100, 0], [300, -4], [50, 0.5]]) {
    const want = triode(TUBES[tube], vg, va).ia, got = cppPlate(W({ tube }), va, vg);
    worst = Math.max(worst, Math.abs(got - want) / Math.max(1e-6, Math.abs(want)));
  }
  check(worst < 1e-9, 'model: each tube\'s plate current is Dempwolf and Zölzer\'s equations with their Table 1', `worst ${worst.toExponential(1)} relative`);
}

// 2. the DC operating point: the C++ (DK, Newton on six ports) against Newton on every node
{
  let worst = 0, all = true;
  for (const over of [{}, { tube: 'rsd2' }, { tube: 'ehx1' }, { emission: 0.5 }, { bplus: 250 }, { bplus: 450, supplyR: 2e3 }, { gain: 1, master: 0 }, { active: true }]) {
    const c = cppOperatingPoint(W(over)), j = operatingPoint(W(over));
    all &&= j.converged;
    c.V.forEach((v, k) => { worst = Math.max(worst, Math.abs(v - j.V[k])); });
  }
  check(all && worst < 1e-4, 'model: the operating point is the nodal analysis\'s, at eight settings', `worst ${worst.toExponential(1)} V`);
}

// 3. Kirchhoff's current law at the operating point, from the C++'s own voltages and currents
{
  const P = W({}), { node: n, tubes: t } = cppOperatingPoint(P);
  const errs = [
    (n.D - n.P1) / PARTS.Rp1 - t[0].ia,                           // V1a's plate current, down its 100 kΩ
    n.K1 / PARTS.Rk1 - t[0].ia - t[0].ig,                         // and out of its cathode, with its grid's
    (n.D - n.P2) / PARTS.Rp2 - t[1].ia - t[2].ig,                 // V2a's plate and the follower's grid
    n.K2 / PARTS.Rk2 - t[1].ia - t[1].ig,
    n.K3 / PARTS.Rk3 - t[2].ia - t[2].ig,                         // the follower's cathode: no DC into the stack
    (n.E - n.D) / P.supplyR - (n.D - n.P1) / PARTS.Rp1 - (n.D - n.P2) / PARTS.Rp2 - t[2].ia, // the dropper feeds them all
  ];
  const worst = Math.max(...errs.map(Math.abs));
  check(worst < 1e-9 && n.E === P.bplus, 'model: every DC current balances at its node, and the dropper supplies them all', `worst ${worst.toExponential(1)} A`);
  check(Math.abs(n.D - 325) < 2, 'the dropper leaves the preamp\'s rail at about 325 V, as Kuehnel computes with', `${n.D.toFixed(1)} V`);
  // Kuehnel's second stage: −1.2 V of bias, 181 V on the plate, about 1.4 mA
  check(Math.abs(t[1].vg + 1.2) < 0.1 && Math.abs(n.P2 - 181) < 10 && Math.abs(t[1].ia - 1.4e-3) < 0.1e-3,
    'the second stage sits where Kuehnel\'s analysis puts the Bassman\'s', `${t[1].vg.toFixed(2)} V, ${n.P2.toFixed(1)} V, ${(t[1].ia * 1e3).toFixed(2)} mA against −1.2 V, 181 V, 1.4 mA`);
  const table = [[-1.6, 217, 1.06e-3], [-1.15, 186, 1.38e-3], [-0.48, 137, 1.88e-3]];
  check(table.every(([vg, va, ia], k) => Math.abs(t[k].vg - vg) < 0.01 && Math.abs(t[k].va - va) < 0.6 && Math.abs(t[k].ia - ia) < 0.006e-3),
    'and every triode where the README\'s table says', t.map((q) => `${q.vg.toFixed(2)} V, ${q.va.toFixed(1)} V, ${(q.ia * 1e3).toFixed(3)} mA`).join('; '));
}

// 4. the tone stack: the schematic is the network Yeh and Smith solved, and it scoops the middle
{
  let worst = 0;
  for (const [t, m, l] of [[0.5, 0.5, 0.5], [0.2, 0.8, 0.1], [0.9, 0.1, 0.7], [0.3, 0.3, 0.95]]) for (const f of [30, 100, 400, 1500, 6000, 15000]) {
    const a = yehSmith(t, m, l, f), b = toneStackNodal(t, m, l, f);
    worst = Math.max(worst, Math.hypot(a[0] - b[0], a[1] - b[1]) / mag(a));
  }
  check(worst < 1e-9, 'tone stack: the schematic\'s network is Yeh and Smith\'s closed form', `worst ${worst.toExponential(1)} relative`);
  const at = (f, o = {}) => mag(yehSmith(o.t ?? 0.5, o.m ?? 0.5, o.l ?? 0.5, f));
  check(Math.abs(db(at(1000)) + 12.4) < 0.1, 'with every knob at halfway it takes 12.4 dB off at 1 kHz', `${db(at(1000)).toFixed(2)} dB`);
  let lo = [Infinity, 0], lo0 = [Infinity, 0];
  for (let f = 100; f < 5000; f *= 1.01) { if (at(f) < lo[0]) lo = [at(f), f]; if (at(f, { m: 0 }) < lo0[0]) lo0 = [at(f, { m: 0 }), f]; }
  check(lo[1] > 650 && lo[1] < 760, 'and scoops the middle most near 700 Hz', `${lo[1].toFixed(0)} Hz`);
  check(lo0[1] > 820 && lo0[1] < 950 && Math.abs(db(lo0[0]) + 22) < 0.5, 'Middle all the way down: about 22 dB near 900 Hz', `${db(lo0[0]).toFixed(1)} dB at ${lo0[1].toFixed(0)} Hz`);
}

// 5. the C++'s small-signal response against complex nodal analysis around the operating point
{
  const freqs = [30, 60, 120, 250, 500, 1000, 2000, 4000, 8000, 15000];
  let worst = 0, worstStack = 0;
  for (const over of [{}, { gain: 0.9, bass: 0.1, middle: 1, treble: 0 }, { tube: 'ehx1', emission: 0.6 }, { cathodeC: 0.5e-6, outCable: 20 }, { active: true, load: 50e3 }]) {
    const P = W(over), op = operatingPoint(P), c = cppResponse(P, freqs);
    freqs.forEach((f, k) => {
      const s = smallSignal(P, f, op);
      worst = Math.max(worst, Math.abs(db(c.mag[k] / mag(s.V))));
      worstStack = Math.max(worstStack, Math.abs(db(c.stack[k] / mag(ratio(s.V, s.K3)))));
    });
  }
  check(worst < 0.01 && worstStack < 0.01, 'model: the small-signal response is the nodal analysis\'s, 30 Hz–15 kHz at five settings', `worst ${worst.toFixed(4)} dB, the stack's ${worstStack.toFixed(4)} dB`);
}

// 6. the engine against the small-signal response
{
  const freqs = [50, 100, 250, 500, 1000, 2000, 4000, 8000];
  for (const [name, over] of Object.entries({ 'as it comes': {}, 'gain down, scooped': { gain: 0.1, middle: 0, bass: 0.8 }, 'small cathode capacitor': { cathodeC: 0.68e-6 }, 'tired tubes, low rail': { emission: 0.6, bplus: 300 }, 'active bass, long cable out': { active: true, outCable: 20 } })) {
    let worst = 0;
    for (const f of freqs) worst = Math.max(worst, Math.abs(db(gain(W(over), f) / ss(W(over), f))));
    check(worst < 0.3, `engine: "${name}" follows the circuit's small-signal response, 50 Hz–8 kHz`, `worst ${worst.toFixed(3)} dB`);
  }
}

// 7. the hints
{
  const rel = (o, f, base = {}) => db(ss(W(o), f) / ss(W(base), f));
  const near = (v, want, tol) => Math.abs(v - want) < tol;
  const b1 = rel({ bass: 1 }, 60), b0 = rel({ bass: 0 }, 60);
  check(near(b1, 4, 0.5) && near(b0, -8, 1), 'Bass: from halfway, full up lifts 60 Hz about 4 dB, all the way down takes about 8 dB off', `${b1.toFixed(1)} dB, ${b0.toFixed(1)} dB`);
  const m1 = rel({ middle: 1 }, 500);
  check(near(m1, 2.5, 0.5), 'Middle: full up adds about 2.5 dB at 500 Hz', `${m1.toFixed(1)} dB`);
  const t1 = rel({ treble: 1 }, 5000), t0 = rel({ treble: 0 }, 5000);
  check(near(t1, 4.5, 0.5) && near(t0, -7.5, 0.7), 'Treble: from halfway, full up adds about 4.5 dB at 5 kHz, all the way down takes about 7.5 dB off', `${t1.toFixed(1)} dB, ${t0.toFixed(1)} dB`);
  const mh = db(gain(W({ master: 0.5 }), 1000) / gain(W({ master: 1 }), 1000));
  check(near(mh, -20, 1), 'Master at half: about a tenth of the voltage', `${mh.toFixed(1)} dB`);
  const ck = [60, 100].map((f) => rel({ cathodeC: 1e-6 }, f)), ckHi = rel({ cathodeC: 1e-6 }, 1000);
  check(ck.every((v) => v < -4 && v > -6.5) && ckHi > -0.5, 'a 1 µF cathode capacitor: below 100 Hz the first stage gives about 5 dB less, the highs all of it', `${ck.map((v) => v.toFixed(1)).join(', ')} dB at 60 and 100 Hz, ${ckHi.toFixed(2)} dB at 1 kHz`);
  const ehx = rel({ tube: 'ehx1' }, 1000);
  check(near(ehx, -2.5, 0.6) && TUBES.ehx1.mu < 90 && TUBES.rsd1.mu > 100 && TUBES.rsd2.mu > 100, 'Tubes: the Electro-Harmonix (µ 87) gives about 2.5 dB less gain than the RSDs (µ near 100)', `${ehx.toFixed(1)} dB`);
  const em = rel({ emission: 0.6 }, 1000), op = cppOperatingPoint(W({})), op6 = cppOperatingPoint(W({ emission: 0.6 }));
  check(near(em, -5, 1) && op6.node.P1 > op.node.P1 && op6.node.P2 > op.node.P2, 'Emission at 60 %: the gain stages\' plates sit higher and the gain falls about 5 dB', `${em.toFixed(1)} dB; plates ${op.node.P1.toFixed(0)}→${op6.node.P1.toFixed(0)} V, ${op.node.P2.toFixed(0)}→${op6.node.P2.toFixed(0)} V`);
  const d300 = cppOperatingPoint(W({ bplus: 300 })).node.D;
  const clip = (b) => peak(run(W({ bplus: b, gain: 1, master: 1 }), sine(110, fs, fs, 0.5)).L.subarray(fs / 2));
  check(near(d300, 250, 5) && clip(300) < 0.9 * clip(385), 'B+ at 300 V: the preamp\'s rail at about 250 V, and the output clips lower', `rail ${d300.toFixed(1)} V; ${clip(385).toFixed(1)} V peak at 385 V, ${clip(300).toFixed(1)} V at 300 V`);
  const c10 = db(ss(W({ cable: 10 }), 5000) / ss(W({ cable: 1 }), 5000));
  check(near(c10, -9, 1.5), 'the cable from the bass: 10 m against 1 m leaves 5 kHz about 9 dB darker', `${c10.toFixed(1)} dB`);
  const oc = db(ss(W({ outCable: 30 }), 3000) / ss(W({ outCable: 0.3 }), 3000));
  check(near(oc, -10, 1.5), 'the cable to the amp: 30 m takes about 10 dB off 3 kHz', `${oc.toFixed(1)} dB`);
  const l100 = rel({ load: 100e3 }, 1000), l10 = rel({ load: 10e3 }, 1000);
  check(near(l100, -3, 0.7) && near(l10, -16, 1.5), 'the amp\'s input: into 100 kΩ about 3 dB quieter, into 10 kΩ about 16 dB', `${l100.toFixed(1)} dB, ${l10.toFixed(1)} dB`);
}

// a note of the test bass, and what the preamp makes of it
const TB = await loadBass();
function note(key = 28, velocity = 0.8, seconds = 1) {
  const b = new TB(fs);
  b.note(key, velocity);
  const out = new Float32Array(Math.round(seconds * fs));
  b.process(out);
  return out;
}
{
  // Gain: clean low down, breaking up past about a third, even harmonics first
  const a = 0.2;
  const h = [0.15, 0.33, 0.5, 0.8].map((g) => harmonics(W({ gain: g }), 110, a));
  check(h[0].thd < -40 && h[1].thd > h[0].thd + 10 && h[3].thd > -15, 'Gain: a 0.2 V note comes through clean low down and breaks up as it turns', h.map((q, i) => `${[15, 33, 50, 80][i]} %: ${q.thd.toFixed(1)} dB`).join(', '));
  check(h[1].h2 > h[1].h3, 'and as it starts to, the second harmonic leads the third', `${h[1].h2.toFixed(1)} dB against ${h[1].h3.toFixed(1)} dB`);
  // grid current: the follower's and V2a's grids conduct when pushed
  const igPeak = (o) => Math.max(...run(W(o), note(28, 1)).messages.filter((m) => m.type === 1).map((m) => m.values[26]));
  check(igPeak({ gain: 0.1 }) < 1e-6 && igPeak({ gain: 0.9 }) > 1e-5, 'pushed, the grids conduct: tens of microamperes, against none played clean', `${(igPeak({ gain: 0.1 }) * 1e6).toFixed(2)} µA clean, ${(igPeak({ gain: 0.9 }) * 1e6).toFixed(0)} µA cranked`);
  // the supply sags a little when you dig in, more with a smaller filter or a bigger dropper
  const sag = (o) => { const r = run(W({ gain: 0.9, ...o }), note(28, 1, 1.5)).messages.filter((m) => m.type === 1).map((m) => m.values[24]); return Math.max(...r) - Math.min(...r); };
  const s8 = sag({}), s1 = sag({ filterC: 1e-6 }), s47 = sag({ supplyR: 47e3 });
  check(s8 > 0.01 && s1 > s8 && s47 > s8, 'the rail moves when you dig in, more with a smaller filter capacitor or a bigger dropper', `${s8.toFixed(2)} V at 8 µF and 14 kΩ, ${s1.toFixed(2)} V at 1 µF, ${s47.toFixed(2)} V at 47 kΩ`);
  const dry = peak(note());
  const y = peak(run(W({}), note()).L);
  check(y > 0.5 * dry && y < 4 * dry, 'as it comes, the preamp is about as loud as the bass straight in', `${db(y / dry).toFixed(1)} dB`);
}

// 8. the solver: Newton converges, fast, on a loud note at every quality
for (const q of ['high', 'medium', 'low']) {
  const r = run(W({ gain: 1 }), Float32Array.from(note(28, 1, 2), (v) => 2 * v), q);
  check(r.failures === 0 && r.iterations < 3 && r.L.every(Number.isFinite), `Newton converges on a loud note at full gain (${q} quality)`, `${r.iterations.toFixed(2)} iterations a sample`);
}

// 9. aliasing: oversampling keeps the inharmonic products of a loud high note down
{
  const f = 2500, n = 4800;
  const inharmonic = (q) => {
    const y = run(W({ gain: 0.8 }), sine(f, fs, fs + n, 0.3), q).L.subarray(fs);
    let tot = 0, bad = 0;
    for (let k = 1; k < n / 2; k++) {
      let re = 0, im = 0;
      for (let i = 0; i < n; i++) { const w = (2 * Math.PI * k * i) / n; re += y[i] * Math.cos(w); im -= y[i] * Math.sin(w); }
      const pw = re * re + im * im, hh = (k * fs) / n / f;
      tot += pw;
      if (Math.abs(hh - Math.round(hh)) > 1e-6) bad += pw;
    }
    return 10 * Math.log10(bad / tot);
  };
  const hi = inharmonic('high'), lo = inharmonic('low');
  check(hi < -40 && hi < lo - 10, 'aliasing: at high quality (4×) the inharmonic products of a loud 2.5 kHz note are 40 dB down', `${hi.toFixed(1)} dB at high, ${lo.toFixed(1)} dB with no oversampling`);
}

// 10. hygiene
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
  const f = 300, extra = phase(W({}), f, 'high') - phase(W({}), f, 'low');
  const lag = (-extra / (2 * Math.PI * f)) * fs;
  check(Math.abs(lag - r.latency) < 0.6 && r.latency <= 5, 'latency: what latency() reports, a few samples', `${lag.toFixed(2)} samples measured, ${r.latency} reported`);
  check(R.every((v, i) => v === L[i]), 'mono out on both sides');
}

// 11. presets stay in range
{
  const ids = new Map(PEDAL.groups.flatMap((g) => g.params).map((p) => [p.id, p]));
  const bad = Object.entries(PEDAL.presets).flatMap(([n, v]) => Object.entries(v).filter(([id, val]) => !ids.has(id) || (typeof val === 'number' && (val < ids.get(id).min || val > ids.get(id).max))).map(([id]) => `${n}: ${id}`));
  check(!bad.length, 'every preset sets real parameters inside their ranges', bad.join(', '));
}

// 12. end to end: the test bass's note keeps its pitch through the preamp
{
  const dry = note(33, 0.8), y = run(W({}), dry).L;
  const f0 = tune(y.subarray(4800, 4800 + 16384), fs), want = tune(dry.subarray(4800, 4800 + 16384), fs);
  check(f0 && want && Math.abs(1200 * Math.log2(f0 / want)) < 2, 'the test bass\'s A keeps its pitch through the preamp, to the tuner\'s eye (2 cents)', `${f0?.toFixed(3)} Hz out for ${want?.toFixed(3)} Hz in`);
}

// 13. CPU
if (!CI) {
  const n = 10 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 82.4 * i) / fs) * Math.exp(-(i % fs) / fs));
  for (const [q, budget] of [['high', 0.4], ['medium', 0.2]]) {
    const e = new Effect(fs);
    e.setQuality(q);
    e.setParams(W({ gain: 0.6 }));
    const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
    e.process(inp, L, R);
    const share = (performance.now() - t0) / 1000 / 10;
    e.destroy();
    check(share < budget, `CPU: ${q} quality under ${(100 * budget).toFixed(0)} % of a core (WebAssembly)`, `${(100 * share).toFixed(1)} %`);
  }
}

done();
