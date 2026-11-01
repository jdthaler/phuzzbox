// wah-tests.mjs — the Wah against circuit theory written here, independently of the C++: the
// circuit's DC operating point by Newton on Kirchhoff's current law at every node, its small-signal
// response by complex nodal analysis with the transistors linearised there, and the sweep's ends
// against 1/(2π√(LC)) and against a real pedal's measured peaks; then the engine against both, the
// hints, and what the signal's level does (volts in, volts out).

import { check, done, CI } from './harness.mjs';
import { loadPedal, loadBass } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { amplitudeAt, db, sine } from '../tools/audio-util.mjs';

const { PEDAL, Effect } = await loadPedal('wah');
const x = Effect.exports;
const fs = 48000;
// at the output knob's unity setting (its default is set for loudness: tools/loudness.mjs)
const D = { ...defaults(PEDAL.groups), level: 0 };
const with_ = (over) => ({ ...D, ...over });

// ---- the circuit, as Holters and Zölzer give it (DAFx 2011, Table 1): [a, b, value], nodes 1–13,
// 0 ground, 1 the input, 13 the supply
const IS = 20.3e-15, BF = 1430, BR = 4, VT = 0.026;
function parts(P) {
  const x0 = Math.min(1, Math.max(0, P.position));
  const travel = P.taper === 'linear' ? x0 : 1 - (81 ** (1 - x0) - 1) / 80;
  const a = 0.008 + (0.999 - 0.008) * travel;
  return {
    R: [[1, 2, 68e3], [4, 13, 22e3], [5, 0, 390], [4, 6, 470e3], [4, 10, 470e3], [3, 7, 1.5e3], [6, 7, P.qR], [6, 0, 82e3], [12, 0, 10e3], [11, 13, 1e3], [8, 9, a * 100e3], [9, 0, (1 - a) * 100e3]],
    C: [[2, 3, 10e-9], [6, 0, 4.7e-6], [7, 12, P.sweepC], [4, 8, 220e-9], [9, 10, 220e-9]],
    L: [[6, 7, P.inductor]],
    Q: [[3, 4, 5], [10, 11, 12]], // base, collector, emitter (NPN)
  };
}
// Ebers–Moll: the currents into the base, collector and emitter for junction voltages vbe, vbc
function bjt(vbe, vbc) {
  const IF = IS * Math.expm1(vbe / VT), IR = IS * Math.expm1(vbc / VT);
  const ic = IF - IR - IR / BR, ib = IF / BF + IR / BR;
  return [ib, ic, -(ib + ic)];
}
// a real solve by Gaussian elimination with partial pivoting
function solveReal(A, b) {
  const n = b.length;
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(A[i][k]) > Math.abs(A[p][k])) p = i;
    [A[k], A[p]] = [A[p], A[k]]; [b[k], b[p]] = [b[p], b[k]];
    for (let i = k + 1; i < n; i++) { const m = A[i][k] / A[k][k]; for (let j = k; j < n; j++) A[i][j] -= m * A[k][j]; b[i] -= m * b[k]; }
  }
  const xx = new Array(n).fill(0);
  for (let k = n - 1; k >= 0; k--) { let s = b[k]; for (let j = k + 1; j < n; j++) s -= A[k][j] * xx[j]; xx[k] = s / A[k][k]; }
  return xx;
}
// The operating point: the currents leaving each node sum to zero (capacitors open, the coil a
// short), solved by Newton with a finite-difference Jacobian and the supply stepped up from zero.
function operatingPoint(P) {
  const c = parts(P), V = new Array(14).fill(0);
  const free = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const kcl = (V) => {
    const I = new Array(14).fill(0);
    const flow = (a, b, i) => { I[a] += i; I[b] -= i; };
    for (const [a, b, r] of c.R) flow(a, b, (V[a] - V[b]) / r);
    for (const [a, b] of c.L) flow(a, b, (V[a] - V[b]) * 1e3);
    for (const [b, co, e] of c.Q) { const [ib, ic, ie] = bjt(V[b] - V[e], V[b] - V[co]); I[b] += ib; I[co] += ic; I[e] += ie; }
    return free.map((n) => I[n]);
  };
  for (let s = 1; s <= 40; s++) {
    V[13] = (P.vcc * s) / 40;
    for (let it = 0; it < 100; it++) {
      const f = kcl(V), J = free.map(() => new Array(free.length).fill(0));
      free.forEach((n, j) => { const h = 1e-7, v0 = V[n]; V[n] = v0 + h; const f2 = kcl(V); V[n] = v0; f2.forEach((y, i) => { J[i][j] = (y - f[i]) / h; }); });
      const dv = solveReal(J, f.map((y) => -y));
      let worst = 0;
      free.forEach((n, j) => { const d = Math.max(-0.1, Math.min(0.1, dv[j])); V[n] += d; worst = Math.max(worst, Math.abs(d)); });
      if (worst < 1e-12) break;
    }
  }
  return V;
}
// The small-signal response v8 / v1 at f: complex nodal analysis, the transistors' currents
// linearised at the operating point (their partial derivatives by finite differences).
function response(P, f, V = operatingPoint(P)) {
  const c = parts(P), w = 2 * Math.PI * f, free = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], idx = new Map(free.map((n, i) => [n, i]));
  const n = free.length, Mr = free.map(() => new Array(n).fill(0)), Mi = free.map(() => new Array(n).fill(0)), br = new Array(n).fill(0), bi = new Array(n).fill(0);
  // y between a and b; node 1 is the input (1 V), node 13 and ground held
  const add = (a, b, yr, yi) => {
    for (const [p, q, s] of [[a, a, 1], [b, b, 1], [a, b, -1], [b, a, -1]]) {
      if (!idx.has(p)) continue;
      if (idx.has(q)) { Mr[idx.get(p)][idx.get(q)] += s * yr; Mi[idx.get(p)][idx.get(q)] += s * yi; } else if (q === 1) { br[idx.get(p)] -= s * yr; bi[idx.get(p)] -= s * yi; }
    }
  };
  for (const [a, b, r] of c.R) add(a, b, 1 / r, 0);
  for (const [a, b, C] of c.C) add(a, b, 0, w * C);
  for (const [a, b, L] of c.L) add(a, b, 0, -1 / (w * L));
  for (const [b, co, e] of c.Q) {
    const nodes = [b, co, e], at = (dvb, dvc, dve) => bjt(V[b] + dvb - V[e] - dve, V[b] + dvb - V[co] - dvc), i0 = at(0, 0, 0);
    nodes.forEach((m, j) => {
      const d = [0, 0, 0]; d[j] = 1e-6;
      const i1 = at(...d);
      nodes.forEach((p, k) => { const g = (i1[k] - i0[k]) / 1e-6; if (idx.has(p) && idx.has(m)) Mr[idx.get(p)][idx.get(m)] += g; });
    });
  }
  // the complex system as a real one twice its size
  const A = [], rhs = [];
  for (let i = 0; i < n; i++) { A.push([...Mr[i], ...Mi[i].map((v) => -v)]); rhs.push(br[i]); }
  for (let i = 0; i < n; i++) { A.push([...Mi[i], ...Mr[i]]); rhs.push(bi[i]); }
  const s = solveReal(A, rhs);
  return Math.hypot(s[idx.get(8)], s[n + idx.get(8)]);
}

// ---- the C++ model through its exports
function model(P, freqs) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length).set(v);
  s.f64(freqs.length, 8 * v.length).set(freqs);
  x.wah_response(s.at, freqs.length);
  return Array.from(s.f64(freqs.length, 8 * (v.length + freqs.length)));
}
function modelDC(P) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length).set(v);
  x.wah_operating_point(s.at);
  return [0, ...s.f64(13)];
}
const logspace = (a, b, n) => Array.from({ length: n }, (_, i) => a * (b / a) ** (i / (n - 1)));
const FREQS = logspace(60, 6000, 300);
function peak(P) {
  const H = model(P, FREQS);
  let k = 0;
  H.forEach((h, i) => { if (h > H[k]) k = i; });
  const half = H[k] / Math.SQRT2;
  let lo = k, hi = k;
  while (lo > 0 && H[lo] > half) lo--;
  while (hi < H.length - 1 && H[hi] > half) hi++;
  return { f: FREQS[k], db: db(H[k]), Q: FREQS[k] / (FREQS[hi] - FREQS[lo]) };
}
// the engine's gain at f, from a small sine after the transient (at 4 × 48 kHz, where the bilinear
// transform's warping is a few hundredths of a decibel)
function measure(P, f, { rate = 4 * fs, amp = 1e-3 } = {}) {
  const e = new Effect(rate);
  e.setParams(P);
  const n = Math.round(rate / 2), inp = sine(f, rate, 2 * n, amp), L = new Float32Array(2 * n), R = new Float32Array(2 * n);
  e.process(inp, L, R);
  e.destroy();
  return amplitudeAt(L.subarray(n), f, rate) / amplitudeAt(inp.subarray(n), f, rate);
}

// 1. the operating point is Kirchhoff's
{
  let worst = 0;
  for (const P of [D, with_({ vcc: 6 }), with_({ vcc: 12, position: 0 })]) {
    const a = operatingPoint(P), b = modelDC(P);
    for (let k = 1; k <= 13; k++) worst = Math.max(worst, Math.abs(a[k] - b[k]));
  }
  const V = modelDC(D);
  check(worst < 1e-3, 'model: the DC operating point satisfies Kirchhoff\'s current law at every node', `worst ${(1000 * worst).toFixed(3)} mV`);
  check(V[4] > 3 && V[4] < 6 && V[5] > 0.02 && V[12] > 2, 'and both transistors are biased on, Q1\'s collector mid-supply', `Q1 collector ${V[4].toFixed(2)} V, emitter ${(1000 * V[5]).toFixed(0)} mV; Q2 emitter ${V[12].toFixed(2)} V`);
}

// 2. the model's small-signal response is the complex nodal analysis
{
  let worst = 0;
  for (const P of [D, with_({ position: 0 }), with_({ position: 1, sweepC: 10e-9 }), with_({ qR: 100e3, inductor: 1, taper: 'linear', position: 0.4 })]) {
    const freqs = logspace(50, 8000, 24), m = model(P, freqs), V = operatingPoint(P);
    freqs.forEach((f, i) => { worst = Math.max(worst, Math.abs(db(m[i]) - db(response(P, f, V)))); });
  }
  check(worst < 0.05, 'model: the response is complex nodal analysis, transistors linearised at the operating point', `worst ${worst.toFixed(4)} dB`);
}

// 3. the sweep's ends: toe down there is little feedback, and the coil rings with the sweep
// capacitor alone at 1/(2π√(LC)); a real 10 nF pedal measures about 433 Hz heel down and 2.22 kHz
// toe down (the music-electronics-forum measurements in the README)
{
  const guitar = with_({ sweepC: 10e-9 });
  const toe = peak({ ...guitar, position: 1 }), heel = peak({ ...guitar, position: 0 });
  const f0 = 1 / (2 * Math.PI * Math.sqrt(0.5 * 10e-9));
  check(Math.abs(toe.f / f0 - 1) < 0.05, 'toe down, the peak is near 1/(2π√(L·C_sweep))', `${toe.f.toFixed(0)} Hz against ${f0.toFixed(0)} Hz`);
  check(Math.abs(toe.f / 2220 - 1) < 0.05 && Math.abs(heel.f / 433 - 1) < 0.08, 'and the 10 nF sweep matches a measured pedal\'s, 433 Hz to 2.22 kHz', `${heel.f.toFixed(0)} Hz to ${toe.f.toFixed(0)} Hz`);
}

// 4. the engine follows the model
{
  let worst = 0;
  for (const P of [with_({ position: 0 }), D, with_({ position: 1 })]) {
    for (const f of [80, 250, 500, 1000, 2000]) worst = Math.max(worst, Math.abs(db(measure(P, f)) - db(model(P, [f])[0])));
  }
  check(worst < 0.1, 'engine: a 1 mV sine\'s gain is the circuit\'s small-signal response', `worst ${worst.toFixed(3)} dB`);
}

// 5. the hints
{
  const at = (position, over = {}) => peak(with_({ position, ...over }));
  const steps = [0, 0.25, 0.5, 0.75, 1].map((p) => at(p));
  check(steps.every((s, i) => !i || s.f > steps[i - 1].f), 'Rocker: the peak rises from heel to toe', steps.map((s) => s.f.toFixed(0)).join(' → ') + ' Hz');
  check(steps[0].Q > 2 * steps[4].Q, 'and is sharp heel down, broad toe down', `Q ${steps[0].Q.toFixed(1)} heel, ${steps[4].Q.toFixed(1)} toe`);
  const c10 = at(1, { sweepC: 10e-9 }), c22 = at(1, { sweepC: 22e-9 }), c47 = at(1, { sweepC: 47e-9 });
  check(Math.abs(c22.f / c10.f / Math.sqrt(10 / 22) - 1) < 0.04 && Math.abs(c47.f / c10.f / Math.sqrt(10 / 47) - 1) < 0.04, 'Range: a bigger sweep capacitor moves the sweep down as 1/√C', `toe ${c10.f.toFixed(0)}, ${c22.f.toFixed(0)}, ${c47.f.toFixed(0)} Hz`);
  const q33 = at(0.5), q100 = at(0.5, { qR: 100e3 }), q15 = at(0.5, { qR: 15e3 });
  check(q100.db > q33.db && q100.Q > q33.Q && q15.db < q33.db && q15.Q < q33.Q, 'Q: more resistance across the coil, a taller and narrower peak', `15 kΩ ${q15.db.toFixed(1)} dB Q ${q15.Q.toFixed(1)}; 33 kΩ ${q33.db.toFixed(1)} dB Q ${q33.Q.toFixed(1)}; 100 kΩ ${q100.db.toFixed(1)} dB Q ${q100.Q.toFixed(1)}`);
  const l5 = at(1), l10 = at(1, { inductor: 1 });
  check(Math.abs(l10.f / l5.f / Math.SQRT1_2 - 1) < 0.05 && l10.db > l5.db, 'Inductor: more henries lower the sweep as 1/√L, and raise the peak a little', `${l5.f.toFixed(0)} → ${l10.f.toFixed(0)} Hz, ${l5.db.toFixed(1)} → ${l10.db.toFixed(1)} dB`);
  const lin = (p) => peak(with_({ position: p, taper: 'linear' })), aud = (p) => peak(with_({ position: p, taper: 'audio' }));
  const top = lin(1).f, bottom = lin(0).f;
  check(lin(0.9).f < top / 2, 'Pot taper: a linear pot leaves the top octave for the last tenth of the travel', `${lin(0.9).f.toFixed(0)} Hz at 90 % against ${top.toFixed(0)} Hz toe down`);
  const mid = Math.log(aud(0.5).f / bottom) / Math.log(top / bottom);
  check(mid > 0.4 && mid < 0.7, 'and an audio pot puts mid-travel near the middle of the sweep, in octaves', `${(100 * mid).toFixed(0)} % of the way up at half travel`);
  const g0 = measure(with_({ blend: 0 }), 50), g4 = measure(with_({ blend: 0.4 }), 50);
  check(db(g4) - db(g0) > 6, 'Clean blend: the dry signal brings the low end back', `${db(g0).toFixed(1)} dB → ${db(g4).toFixed(1)} dB at 50 Hz`);
  const e = new Effect(fs);
  e.setParams(with_({ blend: 1 }));
  const inp = sine(97, fs, 4096, 0.3), L = new Float32Array(4096), R = new Float32Array(4096);
  e.process(inp, L, R);
  let worst = 0;
  for (let i = 0; i < 4096; i++) worst = Math.max(worst, Math.abs(L[i] - inp[i]));
  check(worst < 1e-6, 'and all the way up, the signal passes unchanged', `worst ${worst.toExponential(1)} V`);
  e.destroy();
  const g = measure(with_({ level: 6.0206 }), 400) / measure(D, 400);
  check(Math.abs(g - 2) < 1e-3, 'Level: +6.02 dB doubles the output', `× ${g.toFixed(4)}`);
}

// 6. volts in, volts out: a hard note distorts where a soft one doesn't, more on a low supply
function distortion(P, amp, f = 110) {
  const e = new Effect(fs);
  e.setParams(P);
  const n = fs / 2, inp = sine(f, fs, 2 * n, amp), L = new Float32Array(2 * n), R = new Float32Array(2 * n);
  e.process(inp, L, R);
  e.destroy();
  const y = L.subarray(n), a1 = amplitudeAt(y, f, fs);
  let h = 0;
  for (let k = 2; k <= 8; k++) h += amplitudeAt(y, k * f, fs) ** 2;
  return Math.sqrt(h) / a1;
}
{
  const P = with_({ position: 0.1 });
  const soft = distortion(P, 0.01), hard = distortion(P, 1), low = distortion({ ...P, vcc: 5 }, 1);
  check(soft < 0.003, 'a 10 mV note comes through clean', `${(100 * soft).toFixed(2)} % distortion`);
  check(hard > 10 * soft, 'a 1 V one, a hot passive bass\'s peak, distorts: the transistors\' exponential shows', `${(100 * hard).toFixed(1)} % distortion`);
  check(low > hard, 'Supply: lower, and it distorts more', `${(100 * low).toFixed(1)} % on 5 V`);
}

// 7. the rocker glides: a jump from heel to toe arrives within 50 ms, and the move itself makes no
// sound: on silence, the circuit's state carries across the pot's change (it is AC-coupled, so its
// operating point does not move either)
{
  const e = new Effect(fs);
  e.setParams(with_({ position: 0 }));
  const n = fs, jumpAt = fs / 2, inp = sine(300, fs, n, 0.05), L = new Float32Array(n), R = new Float32Array(n);
  e.process(inp.subarray(0, jumpAt), L.subarray(0, jumpAt), R.subarray(0, jumpAt));
  e.setParams(with_({ position: 1 }));
  e.process(inp.subarray(jumpAt), L.subarray(jumpAt), R.subarray(jumpAt));
  const settled = amplitudeAt(L.subarray(jumpAt + 2400, jumpAt + 7200), 300, fs) / 0.05, want = measure(with_({ position: 1 }), 300, { rate: fs, amp: 0.05 });
  check(Math.abs(db(settled) - db(want)) < 0.2, 'Rocker: a jump heel to toe arrives within 50 ms', `${db(settled).toFixed(2)} dB against ${db(want).toFixed(2)} dB`);
  e.destroy();
  const q = new Effect(fs), z = new Float32Array(fs / 2), zL = new Float32Array(fs / 2), zR = new Float32Array(fs / 2);
  q.setParams(with_({ position: 0 }));
  q.process(z, zL, zR);
  let most = 0;
  for (const pos of [1, 0, 0.5]) {
    q.setParams(with_({ position: pos }));
    q.process(z.subarray(0, 4800), zL.subarray(0, 4800), zR.subarray(0, 4800));
    most = zL.subarray(0, 4800).reduce((m, v) => Math.max(m, Math.abs(v)), most);
  }
  check(most < 1e-5, 'and rocking it makes no sound of its own (below −100 dBV on silence)', `largest ${most.toExponential(1)} V`);
  q.destroy();
}

// 8. hygiene
{
  const e = new Effect(fs);
  e.setParams(D);
  const n = fs, L = new Float32Array(n), R = new Float32Array(n);
  e.process(new Float32Array(n), L, R);
  const most = L.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  check(most < 1e-5, 'silence in, silence out: the circuit starts at its operating point, without a thump (below −100 dBV)', `largest ${most.toExponential(1)} V`);
  const bad = new Float32Array(128); bad[5] = NaN;
  const ok = e.process(bad, L.subarray(0, 128), R.subarray(0, 128));
  e.process(sine(100, fs, 4096), L.subarray(0, 4096), R.subarray(0, 4096));
  check(!ok && L.subarray(0, 4096).every(Number.isFinite), 'a NaN in comes out as a silent block, and the pedal recovers');
  check(e.latency() === 0 && e.tail() > 0, 'no latency, and a tail for the ringing');
  e.destroy();
}
{
  const ids = new Map(PEDAL.groups.flatMap((g) => g.params).map((p) => [p.id, p]));
  const bad = Object.entries(PEDAL.presets).flatMap(([n, v]) => Object.entries(v).filter(([id, val]) => !ids.has(id) || (typeof val === 'number' && (val < ids.get(id).min || val > ids.get(id).max))).map(([id]) => `${n}: ${id}`));
  check(!bad.length, 'every preset sets real parameters inside their ranges', bad.join(', '));
}

// 9. end to end: the test bass through the Wah comes out finite and louder near the peak
{
  const TB = await loadBass();
  const b = new TB(fs);
  b.note(28, 0.8);
  const n = fs, inp = new Float32Array(n), L = new Float32Array(n), R = new Float32Array(n);
  b.process(inp);
  const e = new Effect(fs);
  e.setParams(D);
  e.process(inp, L, R);
  check(L.every(Number.isFinite) && Math.max(...L.map(Math.abs)) > 0.01, 'the test bass\'s low E through the Wah plays');
  e.destroy();
}

// 10. Auto: the envelope follower, a capacitor C charged from the full-wave rectified input through
// the attack resistor while the input is above it (an ideal diode), and always discharged through
// the decay resistor: C dv/dt = (|in| − v)/Ra·[|in| > v] − v/Rd, with τa = RaC and τd = RdC. Its
// voltage moves the rocker from where it rests: rest + (1 − rest)·min(1, v/full) up, rest·(1 − …) down.
const auto_ = (over) => with_({ control: 'auto', ...over });
function runAuto(P, inp) {
  const e = new Effect(fs);
  e.setParams(P);
  const L = new Float32Array(inp.length), R = new Float32Array(inp.length), ms = [];
  for (let at = 0; at < inp.length; at += 4800) {
    const m = Math.min(4800, inp.length - at);
    e.process(inp.subarray(at, at + m), L.subarray(at, at + m), R.subarray(at, at + m));
    for (const q of e.messages()) if (q.type === 1) ms.push({ rocker: q.values[0], v: q.values[1] });
  }
  e.destroy();
  return { L, ms }; // a message every 10 ms: after samples 480, 960, …
}
// the follower's equation integrated here by RK4, 64 steps a sample, the input held through each
// sample and the diode deciding at every step
function follower(P, inp) {
  const h = 1 / fs / 64, out = new Float64Array(inp.length);
  let v = 0;
  for (let i = 0; i < inp.length; i++) {
    const r = Math.abs(inp[i]);
    const f = (v) => (r > v ? (r - v) / P.attack : 0) - v / P.decay;
    for (let k = 0; k < 64; k++) {
      const k1 = f(v), k2 = f(v + (h / 2) * k1), k3 = f(v + (h / 2) * k2), k4 = f(v + h * k3);
      v += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    }
    out[i] = v;
  }
  return out;
}
const TBA = await loadBass();
const bassNote = (midi, vel, secs = 1.5) => { const b = new TBA(fs); b.note(midi, vel); const y = new Float32Array(Math.round(secs * fs)); b.process(y); return y; };
{
  const P = auto_({ attack: 4e-3, decay: 0.2 }), inp = bassNote(28, 0.9);
  const { ms } = runAuto(P, inp), ref = follower(P, inp);
  let worst = 0;
  ms.forEach((m, k) => { const want = ref[480 * (k + 1) - 1]; if (want > 1e-3) worst = Math.max(worst, Math.abs(m.v / want - 1)); });
  check(ms.length >= 140 && worst < 0.01, 'Auto: the follower is its circuit\'s equation, integrated here by RK4, on the test bass\'s low E', `${ms.length} points, worst ${(100 * worst).toFixed(2)} %`);
}
{
  // a steady 0.1 V: the capacitor charges with τ = τaτd/(τa + τd) toward 0.1·τd/(τa + τd); then,
  // the input gone, it discharges through Rd alone, with τd
  const P = auto_({ attack: 0.02, decay: 0.2, sens: 1 }), A = 0.1, n = fs, inp = new Float32Array(n);
  inp.fill(A, 0, n / 2);
  const { ms } = runAuto(P, inp);
  const tau = (0.02 * 0.2) / 0.22, vInf = (A * 0.2) / 0.22;
  const at = (t) => ms[Math.round(t / 0.01) - 1].v; // the message after t seconds
  const rise = at(0.1) / (vInf * (1 - Math.exp(-0.1 / tau))), held = at(0.5) / vInf, fall = at(0.7) / at(0.5);
  check(Math.abs(rise - 1) < 0.002 && Math.abs(held - 1) < 0.002, `Attack: a steady 0.1 V charges the follower with τ = τaτd/(τa + τd) = ${(1e3 * tau).toFixed(1)} ms, to 0.1·τd/(τa + τd) = ${(1e3 * vInf).toFixed(1)} mV`, `${(100 * rise).toFixed(2)} % and ${(100 * held).toFixed(2)} % of the closed form`);
  check(Math.abs(fall - Math.exp(-0.2 / 0.2)) < 0.002, 'Decay: let go, and it discharges through the decay resistor alone, e^(−t/τd)', `${fall.toFixed(4)} after τd, against ${Math.exp(-1).toFixed(4)}`);
  const P2 = auto_({ position: 0.3, sens: 0.05 }), P3 = auto_({ position: 0.3, sens: 0.05, direction: 'down' });
  const rel = (P) => runAuto(P, inp).ms.map((m) => Math.abs(m.rocker - (P.direction === 'down' ? 0.3 * (1 - Math.min(1, m.v / 0.05)) : 0.3 + 0.7 * Math.min(1, m.v / 0.05))));
  const worst = Math.max(...rel(P2), ...rel(P3));
  // (the wiper moves every 32 samples, so the rocker is the follower's of up to 0.7 ms before)
  check(worst < 0.005, 'the rocker goes from where it rests toward the toe (up) or the heel (down), all the way at the Full sweep voltage', `worst ${worst.toExponential(1)}`);
}
{
  // on silence, the rocker rests where the Rocker knob has it: the same filter as your foot there
  const a = measure(auto_({ position: 0.3, sens: 1 }), 300, { rate: fs }), b = measure(with_({ position: 0.3 }), 300, { rate: fs });
  check(Math.abs(db(a) - db(b)) < 0.1, 'Rocked by: Auto rests where the Rocker (or your expression pedal) has it', `${db(a).toFixed(2)} against ${db(b).toFixed(2)} dB at 300 Hz for a 1 mV sine`);
  const note = bassNote(33, 0.9, 1.5), r = runAuto(auto_({ ...PEDAL.presets['Auto: funky envelope'] }), note).ms.map((m) => m.rocker);
  const top = Math.max(...r.slice(0, 15)), end = r[r.length - 1];
  check(r[0] > 0.2 && top > 0.6 && end < top - 0.3, 'and each note sweeps the peak as it starts and lets it fall back as it dies away', `rocker ${(100 * top).toFixed(0)} % in the first 150 ms, ${(100 * end).toFixed(0)} % at 1.5 s`);
  const fp = (rocker) => peak(with_({ position: rocker })).f;
  check(fp(top) > 2 * fp(end), 'which sweeps the filter\'s peak: the test bass\'s A opens it up and lets it fall', `${fp(top).toFixed(0)} Hz at the top, ${fp(end).toFixed(0)} Hz at 1.5 s`);
}
{
  const s = (P) => runAuto(P, sine(110, fs, fs / 2, 0.3)).ms.at(-1).rocker;
  const up = s(auto_({ position: 0.5, sens: 0.15 })), down = s(auto_({ position: 0.5, sens: 0.15, direction: 'down' }));
  check(up > 0.99 && down < 0.01, 'Direction: a hard note takes it to the toe (up) or the heel (down)', `${(100 * up).toFixed(0)} % and ${(100 * down).toFixed(0)} % from 50 %`);
  const soft = (sens) => runAuto(auto_({ position: 0, sens }), sine(110, fs, fs / 2, 0.05)).ms.at(-1).rocker;
  check(soft(0.1) > 1.5 * soft(0.3), 'Full sweep at: lower, and a soft note sweeps further', `a 50 mV note: ${(100 * soft(0.3)).toFixed(0)} % at 300 mV, ${(100 * soft(0.1)).toFixed(0)} % at 100 mV`);
  const t90 = (attack) => { const r = runAuto(auto_({ position: 0, sens: 0.3, attack }), sine(110, fs, fs / 2, 0.3)).ms.map((m) => m.rocker); return 10 * (r.findIndex((v) => v > 0.9 * r.at(-1)) + 1); };
  check(t90(40e-3) > 3 * t90(2e-3), 'Attack: longer, and the peak slides up rather than jumping', `90 % of the way in ${t90(2e-3)} ms at 2 ms, ${t90(40e-3)} ms at 40 ms`);
  const after = (decay) => { const inp = new Float32Array(fs); inp.set(sine(110, fs, fs / 2, 0.3)); const r = runAuto(auto_({ position: 0, sens: 0.15, decay }), inp).ms; return r[69].rocker; };
  check(after(0.05) < 0.2 && after(1) > 0.8, 'Decay: short, and the peak falls with the note; long, and it hangs', `200 ms after the note: ${(100 * after(0.05)).toFixed(0)} % at 50 ms, ${(100 * after(1)).toFixed(0)} % at 1 s`);
}

// 11. plugged in backwards (Reversed): the bass drives the output jack (node 8) through its pickup,
// and the input jack (node 1) drives the cable to the amp. Here independently: the bass as its coil's
// series admittance 1/(R + jωL) to ground with its capacitance and pots, driven by the Norton current
// that makes the recorded voltage; the circuit's own behaviour from its linearised equations
// G x + C x' = 0 (every node and each inductor's current), stepped by backward Euler from a random
// start until only its slowest-decaying (or fastest-growing) disturbance is left.
function bassOf(P) {
  const passive = !P.active, R = passive ? P.pickupR : P.activeR, L = passive ? P.pickupL : 0;
  return {
    R, L, C: (passive ? P.pickupC : 0) + P.cable * P.cablePF, pots: passive ? P.pots : Infinity,
    ampC: P.outCable * P.cablePF, amp: P.load,
    yrec: (w) => { // the recording's admittance at the jack, as [re, im]
      const zr = R, zi = w * L, m = zr * zr + zi * zi;
      return [zr / m + (passive ? 1 / P.pots : 0) + 1 / P.recLoad, -zi / m + w * ((passive ? P.pickupC : 0) + P.recCable * P.cablePF)];
    },
  };
}
// |v1| per volt recorded, for a small signal at the operating point
function responseBack(P, f, V = operatingPoint(P)) {
  const c = parts(P), b = bassOf(P), w = 2 * Math.PI * f, free = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], idx = new Map(free.map((n, i) => [n, i]));
  const n = free.length, Mr = free.map(() => new Array(n).fill(0)), Mi = free.map(() => new Array(n).fill(0)), br = new Array(n).fill(0), bi = new Array(n).fill(0);
  const add = (a, bb, yr, yi) => { for (const [p, q, s] of [[a, a, 1], [bb, bb, 1], [a, bb, -1], [bb, a, -1]]) if (idx.has(p) && idx.has(q)) { Mr[idx.get(p)][idx.get(q)] += s * yr; Mi[idx.get(p)][idx.get(q)] += s * yi; } };
  for (const [a, bb, r] of c.R) add(a, bb, 1 / r, 0);
  for (const [a, bb, C] of c.C) add(a, bb, 0, w * C);
  for (const [a, bb, L] of c.L) add(a, bb, 0, -1 / (w * L));
  const zm = b.R * b.R + (w * b.L) ** 2;
  add(8, 0, b.R / zm + 1 / b.pots, -w * b.L / zm + w * b.C);
  add(1, 0, 1 / b.amp, w * b.ampC);
  for (const [bq, co, e] of c.Q) {
    const nodes = [bq, co, e], at = (dvb, dvc, dve) => bjt(V[bq] + dvb - V[e] - dve, V[bq] + dvb - V[co] - dvc), i0 = at(0, 0, 0);
    nodes.forEach((m, j) => { const d = [0, 0, 0]; d[j] = 1e-6; const i1 = at(...d); nodes.forEach((p, k) => { if (idx.has(p) && idx.has(m)) Mr[idx.get(p)][idx.get(m)] += (i1[k] - i0[k]) / 1e-6; }); });
  }
  const [ir, ii] = b.yrec(w); // the Norton current into node 8
  br[idx.get(8)] = ir; bi[idx.get(8)] = ii;
  const A = [], rhs = [];
  for (let i = 0; i < n; i++) { A.push([...Mr[i], ...Mi[i].map((v) => -v)]); rhs.push(br[i]); }
  for (let i = 0; i < n; i++) { A.push([...Mi[i], ...Mr[i]]); rhs.push(bi[i]); }
  const sol = solveReal(A, rhs);
  return Math.hypot(sol[idx.get(1)], sol[n + idx.get(1)]);
}
// the growth rate (1/s; above zero, it oscillates by itself) and frequency (Hz) of the circuit's
// least-damped disturbance, plugged in either way (forward, the input jack held by its source)
function growth(P, back, T = 1 / 400000, secs = 0.2) {
  const c = parts(P), V = operatingPoint(P), Rs = [...c.R], Cs = [...c.C], Ls = [...c.L];
  const free = back ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  if (back) {
    const b = bassOf(P);
    if (b.L > 0) { free.push(14); Rs.push([8, 14, b.R]); Ls.push([14, 0, b.L]); } else Rs.push([8, 0, b.R]);
    if (Number.isFinite(b.pots)) Rs.push([8, 0, b.pots]);
    Rs.push([1, 0, b.amp]); Cs.push([8, 0, b.C], [1, 0, b.ampC]);
  }
  const idx = new Map(free.map((nd, i) => [nd, i])), n = free.length + Ls.length;
  const G = Array.from({ length: n }, () => new Array(n).fill(0)), C = Array.from({ length: n }, () => new Array(n).fill(0));
  const stamp = (M, a, bb, y) => { for (const [p, q, s] of [[a, a, 1], [bb, bb, 1], [a, bb, -1], [bb, a, -1]]) if (idx.has(p) && idx.has(q)) M[idx.get(p)][idx.get(q)] += s * y; };
  for (const [a, bb, r] of Rs) stamp(G, a, bb, 1 / r);
  for (const [a, bb, cap] of Cs) stamp(C, a, bb, cap);
  Ls.forEach(([a, bb, h], k) => { // its current j, from a to b: in the KCL rows, and v_a − v_b = h dj/dt
    const j = free.length + k;
    if (idx.has(a)) { G[idx.get(a)][j] += 1; G[j][idx.get(a)] -= 1; }
    if (idx.has(bb)) { G[idx.get(bb)][j] -= 1; G[j][idx.get(bb)] += 1; }
    C[j][j] += h;
  });
  for (const [bq, co, e] of c.Q) {
    const nodes = [bq, co, e], at = (d) => bjt(V[bq] + d[0] - V[e] - d[2], V[bq] + d[0] - V[co] - d[1]), i0 = at([0, 0, 0]);
    nodes.forEach((m, j) => { const d = [0, 0, 0]; d[j] = 1e-6; const i1 = at(d); nodes.forEach((p, k) => { if (idx.has(p) && idx.has(m)) G[idx.get(p)][idx.get(m)] += (i1[k] - i0[k]) / 1e-6; }); });
  }
  // backward Euler: (G + C/T) x' = (C/T) x
  const A = G.map((row, i) => row.map((g, j) => g + C[i][j] / T));
  const cols = Array.from({ length: n }, (_, i) => solveReal(A.map((r) => [...r]), Array.from({ length: n }, (_, k) => +(k === i))));
  const M = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => { let s = 0; for (let k = 0; k < n; k++) s += cols[k][i] * C[k][j] / T; return s; }));
  let xv = Array.from({ length: n }, (_, i) => Math.sin(7.1 * i + 1)), logN = 0, ups = 0, prev = 0, first = -1, last = -1;
  const steps = Math.round(secs / T), probe = idx.get(4);
  for (let s = 0; s < steps; s++) {
    const yv = M.map((row) => row.reduce((acc, m, j) => acc + m * xv[j], 0)), norm = Math.hypot(...yv);
    xv = yv.map((v) => v / norm);
    if (s < steps / 2) continue;
    logN += Math.log(norm);
    if (prev < 0 && xv[probe] >= 0) { ups++; if (first < 0) first = s; last = s; }
    prev = xv[probe];
  }
  return { rate: logN / (steps / 2) / T, f: ups > 1 ? (ups - 1) / ((last - first) * T) : 0 };
}
function squeal(P) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length).set(v);
  x.wah_squeal(s.at);
  const [on, f, pk] = s.f64(3);
  return { on: !!on, f, peak: pk };
}
// the engine from silence, plugged in backwards: its pitch and peak over its second half
function play(P, secs = 0.5) {
  const e = new Effect(fs);
  e.setParams(P);
  const n = Math.round(secs * fs), inp = new Float32Array(n), L = new Float32Array(n), R = new Float32Array(n);
  e.process(inp, L, R);
  e.destroy();
  const y = L.subarray(n / 2);
  let ups = 0, first = -1, last = -1, pk = 0;
  for (let i = 1; i < y.length; i++) { pk = Math.max(pk, Math.abs(y[i])); if (y[i - 1] < 0 && y[i] >= 0) { ups++; if (first < 0) first = i; last = i; } }
  return { peak: pk, f: ups > 1 ? ((ups - 1) * fs) / (last - first) : 0, start: L.findIndex((v) => Math.abs(v) > 0.01) / fs };
}
{
  const back = with_({ reversed: true }), active = with_({ reversed: true, active: true });
  // a: from a passive bass the loop oscillates over most of the rocker's travel; forward, and from
  // an active bass, it never does
  const g = [0, 0.3, 0.5, 0.9, 1].map((position) => growth({ ...back, position }, true));
  check(g[0].rate > 100 && g[1].rate > 100 && g[2].rate > 100 && g[3].rate < 0 && g[4].rate < 0,
    'backwards from a passive bass: its linearised circuit grows by itself from the heel to past halfway, and is stable toe down',
    g.map((r, i) => `${[0, 30, 50, 90, 100][i]} %: ${r.rate.toFixed(0)}/s${r.rate > 0 ? ` at ${r.f.toFixed(0)} Hz` : ''}`).join(', '));
  const fw = [0, 0.5, 1].map((position) => growth(with_({ position }), false).rate), ac = [0, 0.5, 1].map((position) => growth({ ...active, position }, true).rate);
  check(fw.every((r) => r < 0) && ac.every((r) => r < 0), 'and it is stable plugged in the right way round, and backwards from an active bass',
    `forward ${fw.map((r) => r.toFixed(0)).join(', ')}/s; active ${ac.map((r) => r.toFixed(0)).join(', ')}/s`);
  // b: the engine squeals exactly where the linear analysis says it grows, and starts by itself
  const where = [0, 0.3, 0.5, 0.9, 1].map((position) => play({ ...back, position }));
  const agree = where.every((r, i) => (r.peak > 0.01) === (g[i].rate > 0)) && [0, 0.5, 1].every((position) => play({ ...active, position }).peak < 1e-4);
  check(agree, 'engine: it squeals from silence just where the linearised circuit grows, and is silent elsewhere',
    where.map((r, i) => `${[0, 30, 50, 90, 100][i]} %: ${r.peak.toFixed(2)} V`).join(', '));
  check(where[0].start >= 0 && where[0].start < 0.1, 'the squeal starts by itself within 0.1 s of plugging in', `${(1000 * where[0].start).toFixed(0)} ms`);
  const sq = [0, 0.3, 0.6].map((position) => play({ ...back, position }));
  check(sq.every((r, i) => !i || (r.f > sq[i - 1].f && r.peak < sq[i - 1].peak)) && Math.abs(sq[0].f / 880 - 1) < 0.05 && Math.abs(sq[2].f / 1160 - 1) < 0.05,
    'Reversed: the squeal\'s pitch rises from about 880 Hz heel down to 1.16 kHz at 60 %, and it quietens as it goes',
    sq.map((r) => `${r.f.toFixed(0)} Hz ${r.peak.toFixed(2)} V`).join(' → '));
  const ss = [0.3, 0.9].map((position) => squeal({ ...back, position })), es = play({ ...back, position: 0.3 });
  check(ss[0].on && !ss[1].on && Math.abs(ss[0].f / es.f - 1) < 0.01, 'model: the page\'s squeal check agrees with the engine', `${ss[0].f.toFixed(0)} Hz against ${es.f.toFixed(0)} Hz; none at 90 %`);
  const c10 = play({ ...back, sweepC: 10e-9, position: 0 }), c47 = play({ ...back, sweepC: 47e-9, position: 0 });
  check(c10.f > 1.3 * where[0].f && c47.f < 0.75 * where[0].f, 'Range: the sweep capacitor moves the squeal too', `heel down ${c47.f.toFixed(0)} Hz (47 nF), ${where[0].f.toFixed(0)} Hz (22 nF), ${c10.f.toFixed(0)} Hz (10 nF)`);
  // c: where it is stable, the model's response is the independent analysis, and the engine follows it
  let worst = 0;
  for (const P of [{ ...back, position: 1 }, { ...back, position: 0.9, cable: 30 }, { ...active, position: 0 }, { ...active, position: 0.5, outCable: 20 }, { ...active, position: 1, load: 100e3 }]) {
    const freqs = logspace(50, 8000, 16), m = model(P, freqs), V = operatingPoint(P);
    freqs.forEach((f, i) => { worst = Math.max(worst, Math.abs(db(m[i]) - db(responseBack(P, f, V)))); });
  }
  check(worst < 0.05, 'model: backwards, the response is complex nodal analysis with the bass as a Norton source', `worst ${worst.toFixed(4)} dB`);
  let worstE = 0;
  for (const P of [{ ...active, position: 0 }, { ...active, position: 0.5 }, { ...back, position: 1 }]) {
    for (const f of [250, 1000, 2000]) worstE = Math.max(worstE, Math.abs(db(measure(P, f)) - db(model(P, [f])[0])));
  }
  check(worstE < 0.2, 'engine: backwards, a 1 mV sine\'s gain is the model\'s', `worst ${worstE.toFixed(3)} dB`);
  // d: from an active bass, a wah that works backwards: the peak follows the rocker and fades toward the toe
  const ap = [0, 0.5, 1].map((position) => peak({ ...active, position }));
  check(ap.every((p, i) => !i || (p.f > ap[i - 1].f && p.db < ap[i - 1].db)), 'from an active bass, the peak still rises with the rocker, and fades toward the toe',
    ap.map((p) => `${p.f.toFixed(0)} Hz ${p.db.toFixed(1)} dB`).join(' → '));
  // e: the hints of what it brings in
  const c30 = play({ ...back, position: 0, cable: 30 });
  check(Math.abs(c30.f / where[0].f - 1) < 0.05 && Math.abs(db(c30.peak / where[0].peak)) < 1, 'Cable from the bass: it hardly matters', `30 m: ${c30.f.toFixed(0)} Hz ${c30.peak.toFixed(2)} V against ${where[0].f.toFixed(0)} Hz ${where[0].peak.toFixed(2)} V`);
  const o30 = play({ ...back, position: 0, outCable: 30 }), l10 = play({ ...back, position: 0, load: 10e3 });
  const o = db(o30.peak / where[0].peak), l = db(l10.peak / where[0].peak);
  check(o < -5 && o > -9, 'Cable to the amp: 30 m takes the squeal down by about 7 dB', `${o.toFixed(1)} dB`);
  check(l < -15 && l > -21, 'Amp\'s input: into 10 kΩ the squeal is about 18 dB down', `${l.toFixed(1)} dB`);
  const b0 = play({ ...back, position: 0.3, blend: 0 }), b1 = play({ ...back, position: 0.3, blend: 1 });
  check(b0.peak === b1.peak, 'Clean blend: off when plugged in backwards', `${b0.peak.toFixed(3)} V and ${b1.peak.toFixed(3)} V`);
  // e2: Auto backwards: the follower hears the input jack, which now carries the squeal, and rocks
  // away from it; up, it pushes toward the toe until the squeal holds itself at the edge
  {
    const run = (over) => {
      const e = new Effect(fs);
      e.setParams({ ...back, ...PEDAL.presets['Auto: funky envelope'], reversed: true, ...over });
      const n = 3 * fs, inp = new Float32Array(n), L = new Float32Array(n), R = new Float32Array(n);
      e.process(inp, L, R);
      e.destroy();
      const pk = (a, b) => L.subarray(a * fs, b * fs).reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      return [pk(2, 2.5), pk(2.5, 3)];
    };
    const up = run({ direction: 'up', position: 0 }), down = run({ direction: 'down', position: 0.9 });
    check(up[0] > 0.01 && up[0] < where[0].peak / 4 && Math.abs(up[1] / up[0] - 1) < 0.1, 'Auto backwards, up: the follower hears the squeal and rocks it down to a steady edge',
      `${up[0].toFixed(2)} V and ${up[1].toFixed(2)} V against ${where[0].peak.toFixed(2)} V by foot, heel down`);
    check(down[1] < 1e-4, 'and down, resting near the toe, it never starts', `${down[1].toExponential(1)} V`);
  }
  // f: hygiene: turning the cables round on silence, either way, makes no thump in a stable setting,
  // and the test bass plays through it backwards
  const e = new Effect(fs), z = new Float32Array(4800), zL = new Float32Array(4800), zR = new Float32Array(4800);
  e.setParams(with_({ position: 1 }));
  e.process(z, zL, zR);
  let most = 0;
  for (const rev of [true, false, true]) {
    e.setParams(with_({ position: 1, reversed: rev }));
    e.process(z, zL, zR);
    most = zL.reduce((m, v) => Math.max(m, Math.abs(v)), most);
  }
  check(most < 1e-5, 'turning it round toe down, on silence, makes no sound of its own', `largest ${most.toExponential(1)} V`);
  e.destroy();
  const TB = await loadBass(), tb = new TB(fs);
  tb.note(28, 0.8);
  const n = fs, inp = new Float32Array(n), L = new Float32Array(n), R = new Float32Array(n);
  tb.process(inp);
  const q = new Effect(fs);
  q.setParams({ ...back, position: 0.85 });
  q.process(inp, L, R);
  check(L.every(Number.isFinite) && L.reduce((m, v) => Math.max(m, Math.abs(v)), 0) > 1e-4, 'the test bass\'s low E through it backwards plays');
  q.destroy();
}

// 12. CPU: the budget is 5 % of a core, with the rocker moving all the time (the faster of two
// runs, since the other test files share the machine)
if (!CI) {
  const n = 10 * fs, inp = sine(82.4, fs, n, 0.3), L = new Float32Array(n), R = new Float32Array(n);
  let ms = Infinity;
  for (let run = 0; run < 2; run++) {
    const e = new Effect(fs);
    const t0 = performance.now();
    for (let at = 0; at < n; at += 128) {
      if (at % 1024 === 0) e.setParams(with_({ position: 0.5 + 0.5 * Math.sin(at / 20000) }));
      e.process(inp.subarray(at, at + 128), L.subarray(at, at + 128), R.subarray(at, at + 128));
    }
    ms = Math.min(ms, performance.now() - t0);
    e.destroy();
  }
  check(ms < 500, 'CPU: ten seconds of audio, the rocker moving, in under 0.5 s', `${ms.toFixed(0)} ms`);
  let ma = Infinity;
  for (let run = 0; run < 2; run++) {
    const e = new Effect(fs), t0 = performance.now();
    e.setParams(auto_({ ...PEDAL.presets['Auto: funky envelope'] }));
    for (let at = 0; at < n; at += 128) e.process(inp.subarray(at, at + 128), L.subarray(at, at + 128), R.subarray(at, at + 128));
    ma = Math.min(ma, performance.now() - t0);
    e.destroy();
  }
  check(ma < 500, 'CPU: and in Auto, the follower moving it on every block, under 0.5 s too', `${ma.toFixed(0)} ms`);
}

done();
