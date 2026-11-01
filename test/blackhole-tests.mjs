// blackhole-tests.mjs — the Black Hole against physics written here, independently of the C++
// (test/blackhole-circuit.mjs): its modes against fresh Leaver solves, the literature and Hod's
// limit; the harmonics in closed form; the engine's ringing measured against the modes; each hint,
// and hygiene.

import { check, done, CI } from './harness.mjs';
import { loadPedal } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { peak, sine } from '../tools/audio-util.mjs';
import { trackQNM, LITERATURE, hod, y22, y2m2, amplitudes, MSUN_S } from './blackhole-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('blackhole');
const x = Effect.exports;
const fs = 48000;
// at the output knob's unity setting (its default is set for loudness: tools/loudness.mjs)
const D = { ...defaults(PEDAL.groups), level: 0 };
const W = (over) => ({ ...D, ...over });
const wet = (over) => W({ dry: 0, mix: 1, ...over });
const ninesOf = (a) => -Math.log10(1 - a);

function run(P, input) {
  const e = new Effect(fs);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length);
  let ok = true;
  for (let at = 0; at < input.length; at += 4800) {
    const m = Math.min(4800, input.length - at);
    ok = e.process(input.subarray(at, at + m), L.subarray(at, at + m), R.subarray(at, at + m)) && ok;
  }
  const latency = e.latency();
  e.destroy();
  return { L, R, ok, latency };
}
function modes(P) {
  const v = Effect.native(P), s = scratch(x);
  s.f64(v.length).set(v);
  x.blackhole_modes(s.at);
  const o = s.f64(2 + 40);
  return { a: o[0], gain: o[1], modes: Array.from({ length: 4 }, (_, k) => { const q = o.slice(2 + 10 * k, 12 + 10 * k); return { l: q[0], m: q[1], n: q[2], f: q[3], gamma: q[4], Q: q[5], amp: q[6], plus: q[7], cross: q[8], on: q[9] }; }) };
}
function omega(l, m, n, a) { const s = scratch(x); s.f64(4).set([l, m, n, a]); x.blackhole_omega(s.at); const o = s.f64(2); return { re: o[0], im: o[1] }; }
function swsh(l, m, th) { const s = scratch(x); s.f64(3).set([l, m, th]); x.blackhole_swsh(s.at); return s.f64(1)[0]; }
const click = (secs) => { const a = new Float32Array(Math.round(secs * fs)); a[0] = 1; return a; };
// y demodulated at f, smoothed by four one-pole lowpasses of time constant tau: complex samples
function demod(y, f, tau) {
  const a = Math.exp(-1 / (tau * fs)), re = new Float64Array(y.length), im = new Float64Array(y.length);
  for (let i = 0; i < y.length; i++) { const ph = (2 * Math.PI * f * i) / fs; re[i] = y[i] * Math.cos(ph); im[i] = -y[i] * Math.sin(ph); }
  for (const z of [re, im]) for (let pass = 0; pass < 4; pass++) { let s = 0; for (let i = 0; i < z.length; i++) { s = a * s + (1 - a) * z[i]; z[i] = s; } }
  return { re, im };
}
// the ringing's frequency and damping from its demodulated phase and magnitude between t0 and t1
function ringing(y, f, t0, t1, tau) {
  const d = demod(y, f, tau), i0 = Math.round(t0 * fs), i1 = Math.round(t1 * fs);
  let n = 0, st = 0, sp = 0, sm = 0, stt = 0, stp = 0, stm = 0, prev = Math.atan2(d.im[i0], d.re[i0]), unwrap = 0;
  for (let i = i0; i <= i1; i += 4) {
    let ph = Math.atan2(d.im[i], d.re[i]);
    while (ph + unwrap - prev > Math.PI) unwrap -= 2 * Math.PI;
    while (ph + unwrap - prev < -Math.PI) unwrap += 2 * Math.PI;
    ph += unwrap; prev = ph;
    const t = i / fs, lm = Math.log(Math.hypot(d.re[i], d.im[i]));
    n++; st += t; sp += ph; sm += lm; stt += t * t; stp += t * ph; stm += t * lm;
  }
  const den = n * stt - st * st;
  return { f: f + (n * stp - st * sp) / den / (2 * Math.PI), gamma: -(n * stm - st * sm) / den };
}
const rel = (a, b) => Math.abs(a / b - 1);

// 1. the modes against fresh Leaver solves and the literature
{
  const spins = [0.1, 0.45, 0.69, 0.9, 0.97, 0.99, 0.999];
  let worst = 0, where = '';
  for (const [l, m] of [[2, 2], [2, 1], [3, 3], [4, 4]]) {
    const tr = trackQNM(l, m, 0, spins);
    for (const p of tr) {
      const got = omega(l, m, 0, p.a), e = Math.max(rel(got.re, p.omega.re), rel(got.im, p.omega.im));
      if (e > worst) { worst = e; where = `(${l},${m},0) at a = ${p.a}`; }
    }
  }
  check(worst < 2e-4, 'the engine\'s modes (Forte\'s table, interpolated) against Leaver\'s continued fractions solved afresh, between the table\'s spins', `worst ${worst.toExponential(1)} relative, ${where}`);
  const lit = LITERATURE.map((q) => { const g = omega(q.l, q.m, 0, q.a); return Math.max(Math.abs(g.re - q.re), Math.abs(g.im - q.im)); });
  check(Math.max(...lit) < 2e-6, 'and against the literature: Leaver\'s Schwarzschild modes, and Kerr (2,2,0) at a = 0.9, 0.671613 − 0.064869i', `worst ${Math.max(...lit).toExponential(1)}`);
  const a = 1 - 1e-6, worstHod = [2, 3, 4].map((m) => { const g = omega(m, m, 0, a), h = hod(m, a); return Math.max(rel(g.re, h.re), rel(g.im, h.im)); });
  check(Math.max(...worstHod) < 0.02, 'as a → 1 the l = m modes go to Hod\'s limit, mΩ_H − πiT_H: harmonics of the horizon\'s spin, their damping set by its temperature', `a = 1 − 10⁻⁶: within ${(100 * Math.max(...worstHod)).toFixed(2)} %`);
}

// 2. the harmonics
{
  let worst = 0;
  for (const th of [0, 0.3, 1, Math.PI / 2, 2.5]) worst = Math.max(worst, Math.abs(swsh(2, 2, th) - y22(th)), Math.abs(swsh(2, -2, th) - y2m2(th)));
  check(worst < 1e-12, 'the spin-weighted harmonics ₋₂Y_2,±2 against their closed form √(5/64π)(1 ± cos θ)²', `worst ${worst.toExponential(1)}`);
  const q = 3, mine = amplitudes(q), got = modes(W({ ratio: q })).modes;
  check(rel(got[1].amp, mine.a21) < 1e-12 && rel(got[2].amp, mine.a33) < 1e-12 && rel(got[3].amp, mine.a44) < 1e-12, 'the merger\'s amplitudes are Gossan, Veitch and Sathyaprakash\'s fits', `q = 3: A₂₁ ${mine.a21.toFixed(3)}, A₃₃ ${mine.a33.toFixed(3)}, A₄₄ ${mine.a44.toFixed(3)} of A₂₂`);
}

// 3. the engine rings in its modes. Face-on only m = 2 is heard (₋₂Y_lm(0) is zero for m ≠ 2), so
// L − iR is the (2,2,0) mode alone, A ₋₂Y₂₂ ζ: its ratio from sample to sample is e^{−iωT}.
{
  for (const [a, what] of [[0.69, 'a = 0.69'], [0.99, 'a = 0.99'], [0, 'no spin'], [0.9999, 'a = 0.9999']]) {
    const P = wet({ ratio: 3, nines: a ? ninesOf(a) : 0, inclination: 0 }), M = P.mass * MSUN_S;
    const ladder = [0.3, 0.6, 0.8, 0.9, 0.95, 0.98, 0.99, 0.995, 0.998, 0.999, 0.9995, 0.9998, 0.9999].filter((s) => s < a);
    const ref = a ? trackQNM(2, 2, 0, [...ladder, a]).at(-1).omega : { re: 0.373672, im: -0.088962 };
    const f = ref.re / (2 * Math.PI * M), gamma = -ref.im / M;
    const y = run(P, click(0.5)), i0 = 100, N = 200;
    const c = (i) => [y.L[i], -y.R[i]];
    let turn = 0; // the phase turned from i0 to i0 + N, one sample at a time
    for (let i = i0; i < i0 + N; i++) { const [ar, ai] = c(i), [br, bi] = c(i + 1); turn += Math.atan2(bi * ar - br * ai, br * ar + bi * ai); }
    const gotF = -turn / (2 * Math.PI) * fs / N, gotG = -Math.log(Math.hypot(...c(i0 + N)) / Math.hypot(...c(i0))) * fs / N;
    check(rel(gotF, f) < 1e-4 && rel(gotG, gamma) < 1e-3, `a click rings in the (2,2,0) mode Leaver puts there: ${what}, 200 suns`, `${gotF.toFixed(3)} Hz decaying at ${gotG.toFixed(3)}/s, against ${f.toFixed(3)} Hz and ${gamma.toFixed(3)}/s`);
  }
  // the whole ringing, every mode and both channels, against the modes summed here from fresh
  // Leaver solves and the engine's angular weights
  const P = wet({ ratio: 6, nines: ninesOf(0.9), inclination: 60, mass: 100 }), info = modes(P), M = P.mass * MSUN_S;
  const y = run(P, click(0.3));
  const ref = info.modes.map((md) => trackQNM(md.l, md.m, 0, [0.3, 0.6, 0.8, 0.9]).at(-1).omega);
  let err = 0, sig = 0;
  for (let i = 0; i < y.L.length; i++) {
    let hp = 0, hx = 0;
    info.modes.forEach((md, k) => { const t = i / fs, env = Math.exp((ref[k].im / M) * t), ph = (-ref[k].re / M) * t; hp += md.plus * env * Math.cos(ph); hx += md.cross * env * Math.sin(ph); });
    err += (y.L[i] - info.gain * hp) ** 2 + (y.R[i] - info.gain * hx) ** 2; sig += (info.gain * hp) ** 2 + (info.gain * hx) ** 2;
  }
  check(Math.sqrt(err / sig) < 1e-3, 'the whole ringing, all four modes in both channels, against the modes summed from fresh Leaver solves (q = 6, a = 0.9, 60°)', `${(100 * Math.sqrt(err / sig)).toFixed(4)} % RMS difference`);
}

// 4. the hints
{
  const m = (P) => modes(W(P)).modes;
  const f65 = m({ mass: 65 })[0].f, f200 = m({ mass: 200 })[0].f, f414 = m({ mass: 414 })[0].f;
  const gw = W(PEDAL.presets.GW150914), fgw = modes(gw).modes[0].f, agw = modes(gw).a;
  check(Math.abs(f65 - 262) < 1.5 && Math.abs(f200 - 85) < 0.5 && Math.abs(f414 - 41.2) < 0.2 && rel(f65 / f200, 200 / 65) < 1e-12 && Math.abs(fgw - 271) < 0.5 && Math.abs(agw - 0.67) < 0.005,
    'Mass: the ringing goes as one over the mass: 65 suns at middle C, GW150914\'s 62 suns at a = 0.67 at 271 Hz, 200 at 85 Hz, 414 on the open E', `${f65.toFixed(1)}, ${fgw.toFixed(1)} (a = ${agw.toFixed(3)}), ${f200.toFixed(1)}, ${f414.toFixed(2)} Hz`);
  const Q = (n) => m({ nines: n })[0].Q, q0 = Q(0), q69 = Q(ninesOf(0.69)), q99 = Q(2), q6 = Q(6);
  check(q0 < 2.2 && Math.abs(q69 - 3.3) < 0.15 && Math.abs(q99 - 14.8) < 0.3 && Math.abs(q6 - 1415) < 20, 'Spin: a thud without spin (barely two cycles), a bell near the limit: Q about 3 at 0.69, 15 at 0.99, 1400 at 0.999999', `Q ${q0.toFixed(2)}, ${q69.toFixed(2)}, ${q99.toFixed(1)}, ${q6.toFixed(0)}`);
  const six = m({ nines: 6, ratio: 3 });
  check(Math.abs(six[2].f / six[0].f - 1.5) < 1e-3 && Math.abs(six[3].f / six[0].f - 2) < 1e-3, 'and near the limit the l = m modes ring 2 : 3 : 4', `(3,3) / (2,2) = ${(six[2].f / six[0].f).toFixed(4)}, (4,4) / (2,2) = ${(six[3].f / six[0].f).toFixed(4)}`);
  // equal masses: no (2,1) or (3,3); lopsided: both
  const eq = m({ ratio: 1 }), lop = m({ ratio: 8 });
  check(eq[1].amp === 0 && eq[2].amp === 0 && eq[1].plus === 0 && eq[2].plus === 0 && lop[1].amp > 0.2 && lop[2].amp > 0.3, 'Mass ratio: equal masses leave the odd-m modes silent; a lopsided merger switches them on', `A₂₁ and A₃₃: 0 at 1:1, ${lop[1].amp.toFixed(2)} and ${lop[2].amp.toFixed(2)} of A₂₂ at 8:1`);
  const face = m({ inclination: 0, ratio: 1 })[0], edge = m({ inclination: 90, ratio: 1 })[0];
  const yf = run(wet({ inclination: 0, ratio: 1 }), click(0.2)), df = [demod(yf.L, face.f, 3e-3), demod(yf.R, face.f, 3e-3)], i = Math.round(0.03 * fs);
  const dphi = Math.atan2(df[1].im[i], df[1].re[i]) - Math.atan2(df[0].im[i], df[0].re[i]), quarter = Math.abs(Math.abs(Math.sin(dphi)) - 1), ratio = Math.hypot(df[1].re[i], df[1].im[i]) / Math.hypot(df[0].re[i], df[0].im[i]);
  check(quarter < 1e-3 && Math.abs(ratio - 1) < 0.01 && Math.abs(edge.cross) < 1e-12 && Math.abs(edge.plus) > 0.1, 'Inclination: face-on, h₊ and h× a quarter cycle apart and equal (circular); edge-on, the (2,2) mode\'s h× vanishes', `face-on: ${(Math.abs(dphi) * 180 / Math.PI).toFixed(1)}°, h× / h₊ ${ratio.toFixed(3)}; edge-on h× weight ${edge.cross.toExponential(1)}`);
  // the detector's gain: white noise in comes out at its own level, the channels averaged
  let seed = 12345; const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  const white = Float32Array.from({ length: 30 * fs }, () => 0.1 * 2 * (rnd() - 0.5) * Math.sqrt(3));
  for (const nines of [0, 2]) {
    const yw = run(wet({ nines }), white); let eo = 0, ei = 0;
    for (let k = fs; k < white.length; k++) { eo += (yw.L[k] ** 2 + yw.R[k] ** 2) / 2; ei += white[k] ** 2; }
    check(Math.abs(10 * Math.log10(eo / ei)) < 0.5, `the detector's gain: white noise in comes out at its own level (spin ${nines} nines)`, `${(10 * Math.log10(eo / ei)).toFixed(2)} dB`);
  }
  const n = sine(220, fs, 4800, 0.2), dry = run(W({ dry: 1, mix: 0 }), n).L;
  check(dry.every((v, k) => Math.abs(v - n[k]) < 1e-6), 'Dry: the bass as it came in');
  const lv = run(W({ dry: 1, mix: 0, level: -6 }), n).L;
  check(lv.every((v, k) => Math.abs(v - 0.501187 * n[k]) < 1e-6), 'Level: gain after the mix, in decibels');
  const half = run(W({ dry: 0, mix: 0.5 }), n).L, full = run(W({ dry: 0, mix: 1 }), n).L;
  check(half.every((v, k) => Math.abs(v - 0.5 * full[k]) < 1e-6) && peak(full) > 1e-3, 'Hole: how much of the ringing is mixed in');
}

// 5. hygiene
{
  const r = run(D, sine(41.2, fs, fs, 0.5));
  check(r.ok && r.L.every(Number.isFinite) && peak(r.L) < 5, 'a loud low note: finite and bounded', `peak ${peak(r.L).toFixed(2)} V`);
  const big = run(W({ mass: 30, nines: 6 }), sine(1000, fs, fs, 0.2));
  check(big.ok && big.L.every(Number.isFinite), 'the lightest hole at the highest spin, its modes above 0.45 fs left out: finite', `${modes(W({ mass: 30, nines: 6 })).modes.filter((q) => !q.on).length} modes out`);
  check(r.latency === 0, 'no latency');
  const e = new Effect(fs); e.setParams(D);
  const bad = new Float32Array(128); bad[5] = NaN;
  const L = new Float32Array(4096), R = new Float32Array(4096);
  const ok = e.process(bad, L.subarray(0, 128), R.subarray(0, 128));
  e.process(sine(100, fs, 4096, 0.1), L, R);
  check(!ok && L.every(Number.isFinite) && peak(L) > 0.01, 'a NaN in comes out as a silent block, and the pedal recovers');
  e.destroy();
  const ids = new Map(PEDAL.groups.flatMap((g) => g.params).map((p) => [p.id, p]));
  const badP = Object.entries(PEDAL.presets).flatMap(([nm, v]) => Object.entries(v).filter(([id, val]) => !ids.has(id) || (typeof val === 'number' && (val < ids.get(id).min || val > ids.get(id).max))).map(([id]) => `${nm}: ${id}`));
  check(!badP.length, 'every preset sets real parameters inside their ranges', badP.join(', '));
}

// 6. CPU
if (!CI) {
  const e = new Effect(fs); e.setParams(D);
  const inp = sine(55, fs, 3 * fs, 0.3), L = new Float32Array(128), R = new Float32Array(128), t0 = performance.now();
  for (let at = 0; at < inp.length; at += 128) e.process(inp.subarray(at, at + 128), L, R);
  const share = (performance.now() - t0) / 3000;
  e.destroy();
  check(share < 0.01, 'CPU: four modes, under 1 % of a core (WebAssembly)', `${(100 * share).toFixed(2)} %`);
}

done();
