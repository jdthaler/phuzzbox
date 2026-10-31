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
const D = defaults(PEDAL.groups);
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

// 10. CPU: the budget is 5 % of a core, with the rocker moving all the time (the faster of two
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
}

done();
