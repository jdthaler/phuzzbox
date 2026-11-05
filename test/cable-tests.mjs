// cable-tests.mjs — the Transatlantic Cable against its physics worked out independently of the
// C++ (test/cable-circuit.mjs: the cables' constants from their construction, the line's response
// from its ABCD matrix, the ladder's by chaining its sections, the step response by inverting the
// Laplace transform on Talbot's contour, Kelvin's cable by its Fourier series), Heaviside's line
// by its bounce diagram, and each knob's hint.

import { check, done, CI } from './harness.mjs';
import { loadPedal, loadBass } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { db, peak, sine, amplitudeAt } from '../tools/audio-util.mjs';
import { tune } from '../shared/tuner.js';
import { abs, CABLES, SPACING, setup, line, ladder, stepAt, kelvinHalf } from './cable-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('cable');
const x = Effect.exports;
const fs = 48000;
const D = { ...defaults(PEDAL.groups), repeater: 0 };
const W = (over) => ({ ...D, ...over });
const KINDS = Object.keys(CABLES);
const hint = (id) => PEDAL.groups.flatMap((g) => g.params).find((p) => p.id === id).hint;

// the C++ model through its exports
function call(fn, P, extra = [], args = []) {
  const s = scratch(x), v = P ? Effect.native(P) : [];
  if (v.length) s.f64(v.length).set(v);
  if (extra.length) s.f64(extra.length, 8 * v.length).set(extra);
  x[fn](s.at, ...args);
  return { n: v.length, read: (count, at = 0) => Array.from(s.f64(count, 8 * at)) };
}
const cppParts = (P) => { const r = call('cable_parts', P).read(16); return { R: r[0], L: r[1], C: r[2], G: r[3], length: r[4], loading: r[5], coil: r[6], source: r[7], load: r[8], gain: r[9], sections: r[10], delay: r[11], loss: r[12], z0: r[13], fc: r[14], per: r[15] }; };
const cppResponse = (P, freqs) => { const n = freqs.length, c = call('cable_response', P, freqs, [n]), r = c.read(3 * n, c.n + n); return { mag: r.slice(0, n), phase: r.slice(n, 2 * n), ladder: r.slice(2 * n) }; };
const cppStep = (P, dt, n) => { const c = call('cable_step', P, [dt], [n]); return c.read(n, c.n + 1); };

function run(P, input) {
  const e = new Effect(fs);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length);
  const ok = e.process(input, L, R);
  const out = { L, R, ok, messages: e.messages(), latency: e.latency() };
  e.destroy();
  return out;
}
// the engine's response at f from its response to a volt for one sample (its own DFT)
function engineAt(h, f) {
  const w = (2 * Math.PI * f) / fs;
  let re = 0, im = 0;
  for (let i = 0; i < h.length; i++) { re += h[i] * Math.cos(w * i); im -= h[i] * Math.sin(w * i); }
  return Math.hypot(re, im);
}
const impulse = (P, n) => { const u = new Float32Array(n); u[0] = 1; return run(P, u).L; };
// the trapezoidal rule hears the line at f as the line itself at (fs/π) tan(π f / fs)
const warp = (f) => (fs / Math.PI) * Math.tan((Math.PI * f) / fs);
const logf = (lo, hi, n) => Array.from({ length: n }, (_, i) => lo * (hi / lo) ** (i / (n - 1)));
// the first time a step response reaches half its final value, by linear interpolation
function half(v, dt, final) {
  const k = v.findIndex((y) => y >= final / 2);
  return k < 1 ? NaN : dt * (k - 1 + (final / 2 - v[k - 1]) / (v[k] - v[k - 1]));
}

// 1. the cables, from their construction
{
  for (const conductor of KINDS) {
    const pp = cppParts(W({ conductor })), c = CABLES[conductor];
    const worst = Math.max(Math.abs(pp.R / c.R - 1), Math.abs(pp.L / c.L - 1), Math.abs(pp.C / c.C - 1));
    check(worst < 1e-9 && pp.source === c.source, `${conductor}: R, L and C from its copper and insulation`, `${(pp.R * 1e3).toFixed(2)} Ω/km, ${(pp.L * 1e6).toFixed(3)} mH/km, ${(pp.C * 1e12).toFixed(1)} nF/km, a ${pp.source} Ω source`);
    const z = setup(W({ conductor })).zl;
    check(Math.abs(pp.load / z - 1) < 1e-9, `${conductor}: matched to |Z₀| at 1 kHz`, `${pp.load.toFixed(1)} Ω`);
  }
  const a = cppParts(W({ conductor: 'atlantic1858' })), b = cppParts(W({ conductor: 'atlantic1866' })), t = cppParts(W({ conductor: 'pair' }));
  const near = (v, want, tol) => Math.abs(v / want - 1) < tol;
  check(near(a.R * 1e3, 5.93, 0.002) && near(a.C * 1e9, 0.106, 0.005) && near(b.R * 1e3, 2.11, 0.002) && near(b.C * 1e9, 0.129, 0.005) && near(t.R * 1e3, 274, 0.002),
    'the README: 5.93 and 2.11 Ω/km, 0.106 and 0.129 µF/km, 274 Ω/km for the pair', `${(a.R * 1e3).toFixed(3)}, ${(b.R * 1e3).toFixed(3)}, ${(a.C * 1e9).toFixed(4)}, ${(b.C * 1e9).toFixed(4)}, ${(t.R * 1e3).toFixed(2)}`);
  check(near(a.load, 97, 0.01) && near(b.load, 57.3, 0.01) && near(t.load, 915, 0.01), 'the README: Z₀ at 1 kHz 97, 57 and 915 Ω', `${a.load.toFixed(1)}, ${b.load.toFixed(1)}, ${t.load.toFixed(1)}`);
}

// 2. the line's response: the C++ against the ABCD matrices here, and its ladder against the
// ladder here
const CONFIGS = [];
for (const conductor of KINDS) for (const loading of ['none', 'coils', 'heaviside']) for (const far of ['matched', 'open']) for (const length of [5e3, 60e3, 200e3]) CONFIGS.push(W({ conductor, loading, far, length }));
{
  const freqs = logf(10, 20000, 25);
  let worstLine = 0, worstPhase = 0, worstLadder = 0, at = '';
  for (const P of CONFIGS) {
    const c = cppResponse(P, freqs), pp = cppParts(P);
    freqs.forEach((f, i) => {
      const h = line(P, f), m = abs(h);
      if (m < 1e-12) return;
      const e = Math.abs(c.mag[i] / m - 1);
      if (e > worstLine) { worstLine = e; at = `${P.conductor} ${P.loading} ${P.far} ${P.length / 1e3} km ${f.toFixed(0)} Hz`; }
      worstPhase = Math.max(worstPhase, Math.abs(Math.atan2(Math.sin(c.phase[i] - Math.atan2(h[1], h[0])), Math.cos(c.phase[i] - Math.atan2(h[1], h[0])))));
      if (P.loading !== 'heaviside') worstLadder = Math.max(worstLadder, Math.abs(c.ladder[i] / abs(ladder(P, f, pp.sections, pp.per)) - 1));
    });
  }
  check(worstLine < 1e-7 && worstPhase < 1e-7, 'the continuous line: cosh γℓ, Z₀ sinh γℓ and sinh γℓ / Z₀ between source and load, as here', `worst ${worstLine.toExponential(1)} in size (${at}), ${worstPhase.toExponential(1)} rad`);
  check(worstLadder < 1e-7, 'the ladder: its sections chained, as here', `worst ${worstLadder.toExponential(1)}`);
}

// 3. the ladder as solved stands for the line: within a dB wherever the line passes a sine within
// 60 dB of the bass at 20 Hz, to 10 kHz, and below 70 % of the coils' cutoff
{
  const freqs = logf(20, 10000, 40);
  let worst = 0, at = '';
  for (const P of CONFIGS.filter((P) => P.loading !== 'heaviside')) {
    const c = cppResponse(P, freqs), pp = cppParts(P), best = c.mag[0];
    freqs.forEach((f, i) => {
      if (c.mag[i] < best * 1e-3 || (pp.fc && f > 0.7 * pp.fc)) return;
      const e = Math.abs(db(c.ladder[i] / c.mag[i]));
      if (e > worst) { worst = e; at = `${P.conductor} ${P.loading} ${P.far} ${P.length / 1e3} km ${f.toFixed(0)} Hz, ${pp.sections} sections`; }
    });
  }
  check(worst < 1, 'the ladder is the line to within a dB, wherever the line passes a sine within 60 dB of the bass', `worst ${worst.toFixed(2)} dB (${at})`);
}

// 4. the engine: its ladder by the trapezoidal rule, so the ladder itself at prewarped frequencies
{
  const freqs = [30, 82.4, 200, 500, 1000, 2000, 4000, 8000];
  let worst = 0, at = '';
  for (const P of CONFIGS.filter((P) => P.loading !== 'heaviside')) {
    const pp = cppParts(P), RCl2 = pp.R * pp.C * pp.length ** 2, h = impulse(P, Math.min(1 << 19, Math.max(P.far === 'open' ? 1 << 18 : 1 << 16, 2 ** Math.ceil(Math.log2(12 * RCl2 * fs))))), best = abs(ladder(P, warp(30), pp.sections, pp.per));
    for (const f of freqs) {
      const want = abs(ladder(P, warp(f), pp.sections, pp.per));
      if (want < best * 1e-3) continue;
      const e = Math.abs(db(engineAt(h, f) / want));
      if (e > worst) { worst = e; at = `${P.conductor} ${P.loading} ${P.far} ${P.length / 1e3} km ${f} Hz`; }
    }
  }
  check(worst < 0.02, 'the engine is its ladder at (fs/π) tan(πf/fs), to 0.02 dB', `worst ${worst.toFixed(4)} dB (${at})`);
}

// 5. a volt switched on: the engine's step response against the line's, by Talbot's inversion
{
  for (const P of [W({ length: 100e3 }), W({ length: 80e3, far: 'open' }), W({ conductor: 'atlantic1866', length: 200e3 }), W({ conductor: 'pair', length: 30e3, loading: 'coils' })]) {
    const dt = 1 / fs, n = 4800, v = cppStep(P, dt, n);
    let worst = 0;
    for (let k = 48; k < n; k += 48) worst = Math.max(worst, Math.abs(v[k] - stepAt(P, k * dt)));
    const final = stepAt(P, n * dt);
    check(worst < 0.02 * final, `${P.conductor} ${P.loading} ${P.far}, ${P.length / 1e3} km: the engine's step response is the line's, to 2 %`, `worst ${(100 * worst / final).toFixed(2)} % of ${final.toFixed(4)} V`);
  }
}

// 6. Kelvin's law of squares: the 1858 cable, open at the far end, reaches half its final voltage
// in 0.38 RCℓ², four times as long at twice the length (at 40 km its inductance and the battery's
// resistance hold it back 5 % more)
{
  const kh = kelvinHalf(), c = CABLES.atlantic1858, out = {};
  for (const km of [40, 80, 160]) {
    const P = W({ length: km * 1e3, far: 'open' }), RCl2 = c.R * c.C * (km * 1e3) ** 2, dt = RCl2 / 400, n = 1200;
    const final = stepAt(P, 20 * RCl2), talbot = Array.from({ length: n }, (_, k) => stepAt(P, (k + 1) * dt));
    out[km] = { RCl2, talbot: dt + half(talbot, dt, final), engine: half(cppStep(P, dt, n), dt, final) };
  }
  check(Math.abs(kh - 0.3787) < 0.0005, 'Kelvin\'s cable (all R and C, a perfect source, its end open) reaches half in 0.379 RCℓ²', `${kh.toFixed(4)}`);
  for (const km of [80, 160]) {
    const o = out[km];
    check(Math.abs(o.talbot / o.RCl2 / kh - 1) < 0.03, `the 1858 cable, ${km} km: half its final voltage in Kelvin's time, to 3 %`, `${(o.talbot * 1e3).toFixed(3)} ms = ${(o.talbot / o.RCl2).toFixed(4)} RCℓ²`);
    check(Math.abs(o.engine / o.talbot - 1) < 0.02, `the engine's arrival at ${km} km is the line's, to 2 %`, `${(o.engine * 1e3).toFixed(3)} ms`);
  }
  check(Math.abs(out[160].engine / out[80].engine / 4 - 1) < 0.03, 'twice the length, four times as long', `${(out[160].engine / out[80].engine).toFixed(3)} (${(out[80].engine / out[40].engine).toFixed(3)} from 40 km)`);
}

// 7. Heaviside's line: distortionless, a delay and a flat loss
{
  for (const conductor of KINDS) for (const henries of [0.01, 0.1, 1]) {
    const P = W({ conductor, loading: 'heaviside', inductance: henries, length: 100e3 }), s = setup(P), pp = cppParts(P);
    check(Math.abs(pp.delay / s.delay - 1) < 1e-9 && Math.abs(pp.loss / s.loss - 1) < 1e-9 && Math.abs(pp.z0 / s.z0 - 1) < 1e-9 && Math.abs(pp.G * pp.L / (pp.R * pp.C) - 1) < 1e-12,
      `${conductor}, ${henries * 1e3} mH/km: L/R = C/G, a delay of ℓ√(LC) and a loss of e^{−ℓ√(RG)}`, `${(pp.delay * 1e3).toFixed(2)} ms, ${db(pp.loss).toFixed(2)} dB, Z₀ ${pp.z0.toFixed(0)} Ω`);
  }
  const P = W({ conductor: 'atlantic1866', loading: 'heaviside', inductance: 1 }), s = setup(P), freqs = logf(20, 10000, 30), r = cppResponse(P, freqs);
  const flat = Math.max(...r.mag) / Math.min(...r.mag), want = s.loss * s.z0 / (s.z0 + s.zs);
  const lag = Math.max(...freqs.map((f, i) => { const d = r.phase[i] + 2 * Math.PI * f * s.delay; return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); }));
  check(db(flat) < 1e-9 && Math.abs(r.mag[0] / want - 1) < 1e-9 && lag < 1e-8, 'matched, it passes every frequency alike, each delayed by the same time', `${db(want).toFixed(3)} dB, flat to ${db(flat).toExponential(1)} dB; phase −ωT to ${lag.toExponential(1)} rad`);
  // the bounce diagram: launched at Z₀/(Z₀ + Rs), reflected by (Z − Z₀)/(Z + Z₀) at each end
  for (const far of ['matched', 'open']) {
    const Q = { ...P, far }, q = setup(Q), T = q.delay, gs = (q.zs - q.z0) / (q.zs + q.z0), gl = (q.zl - q.z0) / (q.zl + q.z0), tau = q.z0 / (q.z0 + q.zs);
    const want = (t) => { let v = 0; for (let k = 0; (2 * k + 1) * T < t; k++) v += (1 + gl) * tau * q.loss ** (2 * k + 1) * (gs * gl) ** k; return v; };
    const n = Math.ceil(9 * T * fs), v = run(Q, new Float32Array(n).fill(1)).L;
    let worst = 0;
    for (let k = 0; k < n; k++) { const t = k / fs, edge = (t / T + 1) % 2; if (Math.min(edge, 2 - edge) * T * fs > 8) worst = Math.max(worst, Math.abs(v[k] - want(t))); }
    check(worst < 1e-4, `the engine, far end ${far}: the step arrives as the bounce diagram says (but for 8 samples round each edge, where the fractional delays' interpolation rounds it)`, `worst ${worst.toExponential(1)} V; first arrival ${(tau * (1 + gl) * q.loss).toFixed(4)} V at ${(T * 1e3).toFixed(2)} ms`);
    const k = v.findIndex((y) => y >= want(1.5 * T) / 2);
    check(Math.abs(k / fs - T) < 1 / fs, `far end ${far}: it arrives half-way at ℓ√(LC), to a sample`, `${(k / fs * 1e3).toFixed(3)} ms for ${(T * 1e3).toFixed(3)} ms`);
  }
}

// 8. the coils: a cutoff at 1/(π√(L_coil C d)), and nothing much above it
{
  for (const conductor of KINDS) {
    const P = W({ conductor, loading: 'coils', length: 60e3 }), pp = cppParts(P), d = pp.length * pp.per / pp.sections;
    const want = 1 / (Math.PI * Math.sqrt((pp.coil + pp.L * d) * pp.C * d));
    const [lo, hi] = cppResponse(P, [0.5 * want, 1.3 * want]).mag;
    check(Math.abs(pp.fc / want - 1) < 1e-12 && db(lo / hi) > 30, `${conductor}: the coils cut off at ${want.toFixed(0)} Hz, and 30 % above it the line passes 30 dB less than at half of it`, `${db(lo / hi).toFixed(1)} dB`);
  }
}

// 9. the messages: the voltage along the line
{
  const P = W({ conductor: 'atlantic1866', loading: 'heaviside', inductance: 1, length: 200e3 });
  const r = run(P, new Float32Array(fs).fill(0.5)), m = r.messages.filter((m) => m.type === 1), last = m.at(-1).values, s = setup(P);
  check(m.length >= 25 && m.length <= 35 && last.length === 25, 'the voltage along the line, 24 points and the far end, 30 times a second', `${m.length} messages of ${last.length}`);
  check(Math.abs(last[24] - r.L.at(-1)) < 1e-6 && Math.abs(last[23] - 0.5 * s.loss ** (23.5 / 24) * s.z0 / (s.z0 + s.zs)) < 1e-4, 'the far end comes last, before the repeater, the point before it 1/48 of the way back', `${last[23].toFixed(4)} V, ${last[24].toFixed(4)} V`);
}

// 10. the hints
{
  const dbAt = (P, f) => db(abs(line(P, f)));
  // Length: darker the longer, and slower to arrive (the 1858 cable, matched)
  const P1 = W({ length: 100e3 }), P2 = W({ length: 200e3 }), n = 8000;
  const t1 = half(cppStep(P1, 1 / fs, n), 1 / fs, stepAt(P1, n / fs)), t2 = half(cppStep(P2, 1 / fs, n), 1 / fs, stepAt(P2, n / fs));
  const dark1 = dbAt(P1, 82.4) - dbAt(P1, 1000), dark2 = dbAt(P2, 82.4) - dbAt(P2, 1000);
  check(hint('length').includes('15 dB') && Math.abs(dark1 - 15) < 0.5 && hint('length').includes('37 dB') && Math.abs(dark2 - 37) < 0.5, 'the Length hint: 1 kHz 15 dB below the bass down 100 km, 37 dB down 200', `${dark1.toFixed(1)}, ${dark2.toFixed(1)} dB`);
  check(hint('length').includes('3.5 times') && Math.abs(t2 / t1 - 3.5) < 0.1, 'the Length hint: 3.5 times as long to arrive down 200 km as down 100', `${(t1 * 1e3).toFixed(2)} and ${(t2 * 1e3).toFixed(2)} ms, ${(t2 / t1).toFixed(2)}`);
  // Loading: coils on 30 km of pair, 20 dB more at 1 kHz and nothing at 4
  const none = W({ conductor: 'pair', length: 30e3 }), coiled = W({ conductor: 'pair', length: 30e3, loading: 'coils' });
  const gain = dbAt(coiled, 1000) - dbAt(none, 1000), at4 = dbAt(coiled, 4000) - dbAt(coiled, 300);
  check(hint('loading').includes('20 dB louder') && gain > 19.5 && gain < 21 && at4 < -100, 'the Loading hint: coils pass 1 kHz 20 dB louder down 30 km of pair, and 4 kHz not at all', `${gain.toFixed(1)} dB; 4 kHz ${at4.toFixed(0)} dB below 300 Hz`);
  // Repeater: 20 dB is ten times the voltage
  const u = sine(200, fs, fs / 2, 0.1), a = run(W({ repeater: 0 }), u).L, b = run(W({ repeater: 20 }), u).L;
  const ratio = amplitudeAt(b.subarray(fs / 4), 200, fs) / amplitudeAt(a.subarray(fs / 4), 200, fs);
  check(Math.abs(ratio - 10) < 1e-4 && cppParts(W({ repeater: 40 })).gain === 100 && Math.abs(cppParts(W({ repeater: -20 })).gain - 0.1) < 1e-15, 'the Repeater hint: every 20 dB is ten times the voltage, and −20 dB a tenth', `${ratio.toFixed(5)}`);
  // Far end: open, the voltage doubles
  const hv = W({ conductor: 'atlantic1866', loading: 'heaviside', inductance: 1 });
  const T = setup(hv).delay, k = Math.round(1.5 * T * fs), ones = new Float32Array(k + 1).fill(1);
  const doubled = run({ ...hv, far: 'open' }, ones).L[k] / run(hv, ones).L[k];
  check(hint('far').includes('doubles') && Math.abs(doubled - 2) < 0.01, 'the Far end hint: open, the voltage arriving there doubles', `${doubled.toFixed(4)} times the matched end's`);
  // Cable: 2.8 times the resistance; the pair's 274 Ω/km and half the capacitance
  const c58 = cppParts(W({ conductor: 'atlantic1858' })), c66 = cppParts(W({ conductor: 'atlantic1866' })), pr = cppParts(W({ conductor: 'pair' }));
  check(hint('conductor').includes('2.8 times') && Math.abs(c58.R / c66.R - 2.8) < 0.05 && hint('conductor').includes('274 Ω') && Math.abs(pr.R * 1e3 - 274) < 0.5 && Math.abs(pr.C / c58.C - 0.5) < 0.02,
    'the Cable hint: 2.8 times the resistance, 274 Ω/km and half the capacitance', `${(c58.R / c66.R).toFixed(3)}, ${(pr.R * 1e3).toFixed(1)} Ω/km, ${(pr.C / c58.C).toFixed(3)}`);
  // Loading coils: 3.4 kHz at 88 mH, 2.0 at 250
  const f88 = cppParts(W({ conductor: 'pair', length: 30e3, loading: 'coils', coil: 88e-3 })).fc, f250 = cppParts(W({ conductor: 'pair', length: 30e3, loading: 'coils', coil: 250e-3 })).fc;
  check(hint('coil').includes('3.4 kHz') && Math.abs(f88 / 1000 - 3.4) < 0.05 && hint('coil').includes('2.0 kHz') && Math.abs(f250 / 1000 - 2.0) < 0.05, 'the Loading coils hint: the pair cuts off at 3.4 kHz with 88 mH coils, 2.0 kHz with 250 mH', `${f88.toFixed(0)}, ${f250.toFixed(0)} Hz`);
  // Heaviside inductance on 100 km of the 1866 cable
  const h1 = cppParts(W({ conductor: 'atlantic1866', loading: 'heaviside', inductance: 0.1, length: 100e3 })), h2 = cppParts(W({ conductor: 'atlantic1866', loading: 'heaviside', inductance: 1, length: 100e3 }));
  const said = (v, d) => hint('inductance').includes(v.toFixed(d));
  check(said(h1.delay * 1e3, 1) && said(-db(h1.loss), 1) && said(h2.delay * 1e3, 1) && said(-db(h2.loss), 1), 'the Heaviside inductance hint: 11.4 ms and 2.1 dB at 100 mH/km, 35.9 ms and 0.7 dB at 1 H/km', `${(h1.delay * 1e3).toFixed(2)} ms, ${(-db(h1.loss)).toFixed(2)} dB; ${(h2.delay * 1e3).toFixed(2)} ms, ${(-db(h2.loss)).toFixed(2)} dB`);
}

// 11. hygiene
{
  const r = run(W({}), new Float32Array(fs));
  check(peak(r.L) < 1e-9, 'silence in, silence out', `${peak(r.L).toExponential(1)} V`);
  for (const P of [W({}), W({ loading: 'heaviside', far: 'open', conductor: 'atlantic1866', inductance: 1 })]) {
    const e = new Effect(fs);
    e.setParams(P);
    const bad = new Float32Array(128); bad[5] = NaN;
    const L = new Float32Array(4096), R = new Float32Array(4096);
    const ok = e.process(bad, L.subarray(0, 128), R.subarray(0, 128));
    e.process(sine(100, fs, 4096, 0.1), L, R);
    check(!ok && L.every(Number.isFinite) && peak(L) > 1e-4, `${P.loading}: a NaN in comes out as a silent block, and the pedal recovers`);
    e.destroy();
    check(R.every((v, i) => v === L[i]), `${P.loading}: mono out on both sides`);
  }
  check(run(W({}), new Float32Array(128)).latency === 0, 'no latency');
  const ids = new Map(PEDAL.groups.flatMap((g) => g.params).map((p) => [p.id, p]));
  const badP = Object.entries(PEDAL.presets).flatMap(([nm, v]) => Object.entries(v).filter(([id, val]) => {
    const p = ids.get(id);
    if (!p) return true;
    if (p.type === 'select') return !p.options.some(([o]) => o === val);
    return typeof val === 'number' && (val < p.min || val > p.max);
  }).map(([id]) => `${nm}: ${id}`));
  check(!badP.length, 'every preset sets real parameters inside their ranges', badP.join(', '));
  // a change of parameters mid-note neither clicks to a NaN nor sticks
  const e = new Effect(fs), L = new Float32Array(fs), R = new Float32Array(fs), u = sine(82.4, fs, fs, 0.3);
  e.setParams(W({}));
  e.process(u.subarray(0, fs / 2), L.subarray(0, fs / 2), R.subarray(0, fs / 2));
  e.setParams(W({ loading: 'coils', length: 30e3 }));
  e.process(u.subarray(fs / 2), L.subarray(fs / 2), R.subarray(fs / 2));
  e.destroy();
  check(L.every(Number.isFinite) && peak(L.subarray(fs / 2)) < 2, 'a change of loading mid-note stays finite and bounded', `${peak(L).toFixed(3)} V`);
}

// 12. end to end: the test bass's note keeps its pitch down the line
{
  const TB = await loadBass(), b = new TB(fs);
  b.note(33, 0.8);
  const dry = new Float32Array(fs);
  b.process(dry);
  const y = run(W({}), dry).L;
  const f0 = tune(y.subarray(4800, 4800 + 16384), fs), want = tune(dry.subarray(4800, 4800 + 16384), fs);
  check(f0 && want && Math.abs(1200 * Math.log2(f0 / want)) < 2, 'the test bass\'s A keeps its pitch down the line, to the tuner\'s eye (2 cents)', `${f0?.toFixed(3)} Hz out for ${want?.toFixed(3)} Hz in`);
}

// 13. CPU, at the heaviest: coils on the longest line
if (!CI) {
  for (const P of [W({ loading: 'coils', length: 200e3 }), W({ conductor: 'atlantic1866', far: 'open', length: 200e3 })]) {
    const n = 10 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 82.4 * i) / fs));
    const e = new Effect(fs);
    e.setParams(P);
    const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
    e.process(inp, L, R);
    const share = (performance.now() - t0) / 1000 / 10;
    e.destroy();
    check(share < 0.15, `CPU, ${P.loading}, ${P.length / 1e3} km: under 15 % of a core (WebAssembly)`, `${(100 * share).toFixed(1)} %, ${cppParts(P).sections} sections`);
  }
}

done();
