// spring-tests.mjs — the Spring Reverb against physics written here, independently of the C++
// (test/spring-circuit.mjs): the thin spring's dispersion as a 2 × 2 eigenproblem, Parker and
// Bilbao's closed forms for T_D and F_C, the beads and the losses; then the engine's modes against
// them, the arrival times of its echoes against the group delay, its decay, each hint, and hygiene.

import { check, done, CI } from './harness.mjs';
import { loadPedal } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { peak, sine } from '../tools/audio-util.mjs';
import { tankModes, springBank, POINTS } from '../spring/src/spring-motion.js';
import { TANKS, spring, tdPB, fcPB, beads, sigmaOf, kAt } from './spring-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('spring');
const x = Effect.exports;
const fs = 48000;
const D = defaults(PEDAL.groups);
const W = (over) => ({ ...D, ...over });
const preset = (name, over) => W({ ...PEDAL.presets[name], ...over });
const LOSSLESS = { tank: 'one', mounts: 0.05, steel: 1e-5, oil: 0 };

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
function info(P) {
  const v = Effect.native(P), s = scratch(x);
  s.f64(v.length).set(v);
  x.spring_info(s.at);
  const o = Array.from(s.f64(26, 8 * v.length));
  const springs = [];
  for (let k = 0; k < o[0]; k++) { const q = o.slice(1 + 8 * k, 9 + 8 * k); springs.push({ L: q[0], R: q[1], r: q[2], TD: q[3], Fc: q[4], c0: q[5], fb: q[6], modes: q[7] }); }
  return { springs, bank: o[25] };
}
function modes(P) {
  const v = Effect.native(P), all = [];
  for (let m0 = 0; ; m0 += 1000) {
    const s = scratch(x), n = 1000;
    s.f64(v.length + 1).set([...v, m0]);
    x.spring_modes(s.at, n);
    const o = s.f64(1 + 6 * n, 8 * (v.length + 1));
    const count = o[0];
    for (let i = 0; i < n && m0 + i < count; i++) all.push({ s: o[1 + i], n: o[1 + n + i], f: o[1 + 2 * n + i], cg: o[1 + 3 * n + i], w: o[1 + 4 * n + i], sigma: o[1 + 5 * n + i] });
    if (m0 + n >= count) break;
  }
  return all;
}
const click = (secs) => { const a = new Float32Array(Math.round(secs * fs)); a[0] = 1; return a; };
const wet = (over) => W({ dry: 0, reverb: 1, ...over });

// complex demodulation: the envelope of y near f, through a Gaussian of standard deviation sd (s)
function envelope(y, f, sd) {
  const n = y.length, re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) { const p = (2 * Math.PI * f * i) / fs; re[i] = y[i] * Math.cos(p); im[i] = -y[i] * Math.sin(p); }
  const h = Math.round(4 * sd * fs), g = Array.from({ length: 2 * h + 1 }, (_, j) => Math.exp(-0.5 * ((j - h) / (sd * fs)) ** 2));
  const gs = g.reduce((a, b) => a + b, 0);
  const env = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let a = 0, b = 0;
    for (let j = -h; j <= h; j++) { const k = i + j; if (k >= 0 && k < n) { a += g[j + h] * re[k]; b += g[j + h] * im[k]; } }
    env[i] = (2 * Math.hypot(a, b)) / gs;
  }
  return env;
}
// the time of the envelope's largest value in [t0, t1]
function peakTime(env, t0, t1) {
  let best = -1, at = 0;
  for (let i = Math.round(t0 * fs); i < Math.min(env.length, Math.round(t1 * fs)); i++) if (env[i] > best) { best = env[i]; at = i; }
  return { t: at / fs, v: best };
}

// 1. the thin spring, against Parker and Bilbao
{
  const s = spring(TANKS.leem[0], 0.35e-3);
  const lag = 1 - s.slope / s.c0, want = (s.r / (2 * s.R)) ** 2 / 2;
  check(Math.abs(lag / want - 1) < 0.01, 'the lowest waves travel at κε = (r/2R)√(E/ρ), less (r/2R)²/2 (0.08 %)', `${s.slope.toFixed(2)} m/s against κε = ${s.c0.toFixed(2)} m/s`);
  check(Math.abs(s.TD / tdPB(s) - 1) < 1e-12 && Math.abs((2 * s.L) / s.slope / s.TD - 1) < 1e-3, 'so they cross the spring twice in T_D = 4LR/(r√(E/ρ)) (Parker & Bilbao)', `${(1e3 * s.TD).toFixed(2)} ms; ${(2e3 * s.L / s.slope).toFixed(2)} ms at the exact slope`);
  const d = s.Fc / fcPB(s) - 1;
  check(d > 0 && d < 0.006, 'the transition frequency: the lower branch peaks 0.4 % above Parker and Bilbao\'s first-order F_C', `${s.Fc.toFixed(0)} Hz against ${fcPB(s).toFixed(0)} Hz, ${(100 * d).toFixed(2)} %`);
  check(Math.abs(s.kc * s.R - 0.53) < 0.01, 'at k ≈ 0.53/R', `kR = ${(s.kc * s.R).toFixed(3)}`);
  check(s.omega(s.eps) < 1e-3 * 2 * Math.PI * s.Fc && s.share(s.eps) < 1e-6, 'at k = 1/R the coil slides sideways: no frequency, and it doesn\'t turn the beads', `${(s.omega(s.eps) / 2 / Math.PI).toExponential(1)} Hz, share ${s.share(s.eps).toExponential(1)}`);
  check(Math.abs(s.share(1e-3 * s.eps) - 1) < 1e-4, 'and the low-frequency wave is a pure rotation (share 1)', s.share(1e-3 * s.eps).toFixed(6));
}

// 2. the tank the engine builds, against the same springs here
{
  let worst = { TD: 0, Fc: 0, fb: 0 };
  for (const t of ['leem', 'olson', 'one']) for (const wireD of [0.35e-3, 0.25e-3]) {
    const got = info(W({ tank: t, wire: wireD }));
    TANKS[t].forEach((c, k) => {
      const s = spring(c, wireD), g = got.springs[k];
      worst = { TD: Math.max(worst.TD, Math.abs(g.TD / s.TD - 1)), Fc: Math.max(worst.Fc, Math.abs(g.Fc / s.Fc - 1)), fb: Math.max(worst.fb, Math.abs(g.fb / s.fb - 1)) };
    });
  }
  check(worst.TD < 1e-6 && worst.Fc < 1e-6 && worst.fb < 1e-6, 'every tank\'s springs: T_D, F_C and the beads\' corner as here', `worst ${worst.TD.toExponential(1)}, ${worst.Fc.toExponential(1)}, ${worst.fb.toExponential(1)}`);
  // the modes: k = nπ/L on the lower root, weighted by the share, the beads and (−1)ⁿ
  const P = W({ tank: 'leem' }), ms = modes(P), sp = TANKS.leem.map((c) => spring(c, P.wire));
  let wf = 0, ww = 0, ws = 0;
  for (const m of ms) {
    const s = sp[m.s], k = (m.n * Math.PI) / s.L, f = s.omega(k) / (2 * Math.PI);
    const w = ((2 / s.TD) * s.share(k) * beads(s, f) * (m.n % 2 ? -1 : 1)) / sp.length;
    wf = Math.max(wf, Math.abs(m.f / f - 1));
    ww = Math.max(ww, Math.abs(m.w - w) / Math.abs(w));
    ws = Math.max(ws, Math.abs(m.sigma / sigmaOf(s, f, s.cg(k), P.mounts, P.steel, P.oil) - 1));
  }
  check(wf < 1e-9, 'the engine\'s modes: the standing waves k = nπ/L at the lower root\'s frequency', `${ms.length} modes, worst ${wf.toExponential(1)}`);
  check(ww < 1e-6, 'each weighted by its share of the beads\' turning, their inertia, and (−1)ⁿ at the far bead', `worst ${ww.toExponential(1)}`);
  check(ws < 1e-4, 'each decaying at the losses\' σ', `worst ${ws.toExponential(1)}`);
  const top = Math.max(...ms.map((m) => m.f)), slow = ms.filter((m) => m.f < sp[m.s].Fc && (m.n * Math.PI) / sp[m.s].L < sp[m.s].kc).length;
  check(top <= 8000 && slow > 600, 'up to 8 kHz, with hundreds of modes on the slow branch below F_C', `${ms.length} modes, ${slow} slow, top ${top.toFixed(0)} Hz`);
}

// 3. the echoes: one spring, nearly lossless, hears a click. Near each frequency the envelope peaks
// first at the group delay L/c_g(f), then every 2L/c_g(f): the dispersion, heard
{
  const y = run(wet(LOSSLESS), click(0.6)).L, s = spring(TANKS.one[0], 0.35e-3);
  const rows = [];
  let worst1 = 0, worst2 = 0;
  for (const f of [300, 1200, 2400, 3600]) {
    const tau = s.L / s.cg(kAt(s, f, 'slow')), env = envelope(y, f, 1.5e-3);
    const a = peakTime(env, 0.75 * tau, 1.25 * tau), b = peakTime(env, 2.6 * tau, 3.4 * tau);
    worst1 = Math.max(worst1, Math.abs(a.t / tau - 1)); worst2 = Math.max(worst2, Math.abs((b.t - a.t) / (2 * tau) - 1));
    rows.push(`${f} Hz: ${(1e3 * a.t).toFixed(1)}/${(1e3 * tau).toFixed(1)} ms`);
  }
  check(worst1 < 0.03, 'a click\'s first arrival near each frequency comes at the group delay L/c_g(f): the low frequencies first, a chirp up to F_C', `${rows.join(', ')}; worst ${(100 * worst1).toFixed(1)} %`);
  check(worst2 < 0.03, 'and the next echo 2L/c_g(f) later', `worst ${(100 * worst2).toFixed(1)} %`);
  // a low note's first arrival: a lossless line passes it at the level it went in, times the share and the beads
  const f = 150, sd = 3e-3, n = Math.round(0.08 * fs), t0 = 0.012;
  const burst = Float32Array.from({ length: n }, (_, i) => Math.exp(-0.5 * ((i / fs - t0) / sd) ** 2) * Math.sin(2 * Math.PI * f * (i / fs - t0)));
  const out = run(wet(LOSSLESS), burst).L, env = envelope(out, f, 1e-3), tau = s.L / s.cg(kAt(s, f, 'slow'));
  const k = kAt(s, f, 'slow'), want = s.share(k) * beads(s, f), got = peakTime(env, t0 + 0.8 * tau, t0 + 1.2 * tau).v;
  check(Math.abs(got / want - 1) < 0.03, 'Reverb at 100 %: a low note\'s first echo comes out as loud as it went in (a lossless line, times the beads)', `${got.toFixed(3)} of the note, against ${want.toFixed(3)}`);
}

// 4. the decay: near 500 Hz the default tank's tail falls at the losses' σ
{
  const P = wet({ tank: 'one' }), y = run(P, click(2.2)).L, s = spring(TANKS.one[0], P.wire);
  const f = 500, env = envelope(y, f, 0.03);
  // a straight line through ln(envelope) from 0.3 to 1.8 s
  let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0;
  for (let i = Math.round(0.3 * fs); i < Math.round(1.8 * fs); i += 48) { const t = i / fs, v = Math.log(env[i]); sx += t; sy += v; sxx += t * t; sxy += t * v; n++; }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx), k = kAt(s, f, 'slow');
  const want = sigmaOf(s, f, s.cg(k), P.mounts, P.steel, P.oil);
  check(Math.abs(-slope / want - 1) < 0.08, 'the tail near 500 Hz decays at σ = πfη + (ℓ ln10/20)|c_g|/L', `${(-slope).toFixed(2)} /s against ${want.toFixed(2)} /s: T₆₀ ${(6.91 / -slope).toFixed(2)} s`);
}

// 5. the hints
{
  const leem = info(W({ tank: 'leem' })).springs, olson = info(W({ tank: 'olson' })).springs;
  const ms = (q) => q.map((s) => (1e3 * s.TD).toFixed(1)).join(', ');
  check(Math.min(...leem.map((s) => s.TD)) > 0.0395 && Math.max(...leem.map((s) => s.TD)) < 0.0535, 'Tank: the three long springs echo every 40 to 53 ms', ms(leem));
  check(olson.map((s) => Math.round(1e3 * s.TD)).join() === '31,35' && Math.max(...olson.map((s) => s.Fc)) < Math.min(...leem.map((s) => s.Fc)), 'the two short, wider ones every 31 and 35 ms, with their chirps lower', `${ms(olson)} ms; F_C ${olson.map((s) => s.Fc.toFixed(0)).join(', ')} Hz against ${leem.map((s) => s.Fc.toFixed(0)).join(', ')}`);
  // one spring echoes crisply, three blur: how peaked the tail's envelope is (its kurtosis)
  const peaky = (t) => {
    const y = run(wet({ tank: t }), click(0.5)).L.subarray(Math.round(0.1 * fs)), e = envelope(y, 1000, 1e-3);
    const m = e.reduce((a, b) => a + b, 0) / e.length, v = e.reduce((a, b) => a + (b - m) ** 2, 0) / e.length;
    return e.reduce((a, b) => a + (b - m) ** 4, 0) / e.length / (v * v);
  };
  const p1 = peaky('one'), p3 = peaky('leem');
  check(p1 > 1.5 * p3, 'One spring alone echoes crisply, where three blur into a wash', `the tail's envelope near 1 kHz: kurtosis ${p1.toFixed(1)} against ${p3.toFixed(1)}`);
  // Wire: thinner, later echoes and F_C down in proportion
  const thick = info(W({ tank: 'one', wire: 0.35e-3 })).springs[0], thin = info(W({ tank: 'one', wire: 0.25e-3 })).springs[0];
  check(Math.abs(thin.TD / thick.TD - 0.35 / 0.25) < 1e-9 && Math.abs(thin.Fc / thick.Fc / (0.25 / 0.35) - 1) < 2e-3, 'Wire diameter: thinner wire echoes later and brings F_C down, in proportion', `0.25 mm: T_D ${(1e3 * thin.TD).toFixed(1)} ms, F_C ${thin.Fc.toFixed(0)} Hz; 0.35 mm: ${(1e3 * thick.TD).toFixed(1)} ms, ${thick.Fc.toFixed(0)} Hz`);
  // Loss at the mounts: more, a shorter reverb; the band just below F_C rings longest
  const t60 = (P) => { const y = run(P, click(3)).L; let e = 0; const tot = y.reduce((a, b) => a + b * b, 0); for (let i = y.length - 1; i >= 0; i--) { e += y[i] * y[i]; if (e > 1e-6 * tot) return i / fs; } return 0; };
  const lo = t60(wet({ tank: 'one', mounts: 0.2 })), hi = t60(wet({ tank: 'one', mounts: 1 }));
  check(hi < 0.6 * lo, 'Loss at the mounts: more is a shorter reverb', `60 dB of the energy gone by ${hi.toFixed(2)} s at 1 dB, ${lo.toFixed(2)} s at 0.2 dB`);
  const mm = modes(W({ tank: 'one', steel: 1e-5 })), sp = spring(TANKS.one[0], 0.35e-3), below = mm.filter((m) => m.f < sp.Fc);
  const longest = below.reduce((a, b) => (b.sigma < a.sigma ? b : a));
  check(longest.f > 0.9 * sp.Fc, 'and the waves just below F_C, crawling, are the ones the mounts damp least', `the mounts' slowest decay at ${longest.f.toFixed(0)} Hz, F_C ${sp.Fc.toFixed(0)} Hz`);
  // Steel loss factor: the high frequencies first
  const at = (ms2, f) => ms2.reduce((a, b) => (Math.abs(b.f - f) < Math.abs(a.f - f) ? b : a)).sigma;
  const m1 = modes(W({ tank: 'one', steel: 1e-4 })), m2 = modes(W({ tank: 'one', steel: 1e-3 }));
  const dLo = at(m2, 300) - at(m1, 300), dHi = at(m2, 3000) - at(m1, 3000);
  check(dHi > 8 * dLo && dLo > 0, 'Steel loss factor: it damps the high frequencies first', `σ up ${dHi.toFixed(2)} /s at 3 kHz, ${dLo.toFixed(2)} /s at 300 Hz`);
  // Oil damping: every frequency alike
  const o1 = modes(W({ tank: 'one', oil: 0 })), o2 = modes(W({ tank: 'one', oil: 5 }));
  const dif = o2.map((m, i) => m.sigma - o1[i].sigma);
  check(dif.every((d) => Math.abs(d - 5) < 1e-9), 'Oil damping: it adds the same σ to every mode, shortening without colouring', `${Math.min(...dif).toFixed(6)}–${Math.max(...dif).toFixed(6)} /s`);
  const n = sine(220, fs, 4800, 0.2), dry = run(W({ dry: 1, reverb: 0 }), n).L;
  check(dry.every((v, i) => Math.abs(v - n[i]) < 1e-6), 'Dry: the bass as it came in');
  const lv = run(W({ dry: 1, reverb: 0, level: -6 }), n).L;
  check(lv.every((v, i) => Math.abs(v - 0.501187 * n[i]) < 1e-6), 'Level: gain after the mix, in decibels');
}

// 5b. the bead magnets, lying along the spring or across it
{
  const along = info(W({ tank: 'leem' })), across = info(W({ tank: 'leem', beads: 'across' }));
  const mine = TANKS.leem.map((c) => spring(c, 0.35e-3, true));
  const worst = Math.max(...across.springs.map((g, k) => Math.abs(g.fb / mine[k].fb - 1)));
  check(worst < 1e-9, 'Bead magnets: across the spring, each bead\'s inertia is a cylinder\'s about a diameter, m(a²/4 + l²/12)', `f_b ${across.springs.map((g) => `${(g.fb / 1000).toFixed(2)} kHz`).join(', ')}`);
  const ratio = along.springs[0].fb / across.springs[0].fb;
  check(ratio > 4.5 && ratio < 6 && Math.abs(along.springs[0].fb / 1000 - 8) < 0.1 && Math.abs(across.springs[0].fb / 1000 - 1.5) < 0.1, 'Bead magnets: across, five times harder to turn in the Leem, the corner falling from 8 kHz to 1.5 kHz', `${ratio.toFixed(2)} times; ${(along.springs[0].fb / 1000).toFixed(2)} kHz to ${(across.springs[0].fb / 1000).toFixed(2)} kHz`);
  const click = new Float32Array(fs); click[100] = 0.1;
  // the energy from f − w to f + w, by the Fourier transform at every 20 Hz
  const band = (y, f, w) => { let e = 0; for (let q = f - w; q <= f + w; q += 20) { let re = 0, im = 0; for (let i = 0; i < y.length; i++) { const p = (2 * Math.PI * q * i) / fs; re += y[i] * Math.cos(p); im -= y[i] * Math.sin(p); } e += re * re + im * im; } return Math.sqrt(e); };
  const hi = (P) => { const y = run(W({ ...P, dry: 0, reverb: 1 }), click).L; return band(y, 4000, 1000); };
  check(hi({ beads: 'across' }) < 0.3 * hi({}), 'and the tank is darker', `${(20 * Math.log10(hi({ beads: 'across' }) / hi({}))).toFixed(1)} dB near 4 kHz`);
}

// 5c. the page's slow motion (spring/src/spring-motion.js): the engine's own modes played here, a
// sample at a time, hear at the pickup what the engine's tank does; the field along each spring
// at its far end is that spring's share
{
  const P = W({ tank: 'leem' }), tank = tankModes(x, Effect, P), b = springBank(tank, fs);
  const inp = sine(110, fs, 2400, 0.1);
  const v = Effect.native(P), s = scratch(x), n = inp.length;
  s.f64(v.length + n).set([...v, ...inp]);
  x.spring_run(s.at, n);
  const want = Array.from(s.f64(n, 8 * (v.length + n)));
  let err = 0, sig = 0, ends = 0;
  const f = new Float64Array(POINTS);
  for (let i = 0; i < n; i++) {
    b.bank.seek(i + 1, inp);
    const got = b.pickup(); err += (got - want[i]) ** 2; sig += want[i] ** 2;
    if (i % 300 === 299) { let sum = 0; for (let k = 0; k < tank.count; k++) sum += b.field(k, f)[POINTS - 1]; ends = Math.max(ends, Math.abs(sum - got)); }
  }
  check(tank.modes.length === info(P).bank && Math.sqrt(err / sig) < 1e-4, 'The springs (slow motion): the engine\'s own modes, played here, hear at the pickup what the engine\'s tank does', `${tank.modes.length} modes, ${Math.sqrt(err / sig).toExponential(1)} RMS difference (the engine adds in single precision)`);
  check(ends < 1e-12, 'and the springs\' fields at their far ends add up to what the pickup hears', `worst ${ends.toExponential(1)}`);
}

// 6. hygiene
{
  const r = run(D, sine(55, fs, fs, 0.3));
  check(r.ok && r.L.every(Number.isFinite) && peak(r.L) < 3, 'a loud low note: finite and bounded', `peak ${peak(r.L).toFixed(2)} V`);
  check(r.latency === 0 && r.R.every((v, i) => v === r.L[i]), 'no latency, mono out on both sides (the tank has one pickup)');
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

// 7. CPU
if (!CI) {
  const quiet = (pre) => {
    const e = new Effect(fs); e.setParams(D);
    const L = new Float32Array(fs), R = new Float32Array(fs);
    if (pre) { e.process(sine(41.2, fs, fs, 0.3), L, R); for (let k = 0; k < 40; k++) e.process(new Float32Array(fs), L, R); }
    const t0 = performance.now(); for (let k = 0; k < 4; k++) e.process(new Float32Array(fs), L, R); const ms = performance.now() - t0;
    e.destroy(); return ms / 4;
  };
  const rest = Math.min(quiet(false), quiet(false)), after = Math.min(quiet(true), quiet(true));
  check(after < 2 * rest + 1, 'CPU: once the tail has died, silence costs what silence from rest does', `${after.toFixed(1)} ms a second after a note, ${rest.toFixed(1)} ms from rest`);
  const n = 5 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 55 * i) / fs) * Math.exp(-(i % fs) / (0.3 * fs)));
  const e = new Effect(fs); e.setParams(D);
  const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
  e.process(inp, L, R);
  const share = (performance.now() - t0) / 1000 / 5;
  e.destroy();
  check(share < 0.12, 'CPU: the three-spring tank, 2300 modes, under 12 % of a core (WebAssembly)', `${(100 * share).toFixed(1)} %`);
}

done();
