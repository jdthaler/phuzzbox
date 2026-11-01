// rotary-tests.mjs — the Rotary Speaker against physics written here, independently of the C++
// (test/rotary-circuit.mjs): J1 by its series, the piston's pattern, the retarded time by
// bisection; then the engine: a high note's phase at the microphone against the retarded time (the
// Doppler shift, exactly), its level against the distance and the pattern, the motors' spin-up;
// then each hint, and hygiene.

import { check, done, CI } from './harness.mjs';
import { loadPedal } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { C, piston, retarded, highGain } from './rotary-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('rotary');
const x = Effect.exports;
const fs = 48000;
const D = defaults(PEDAL.groups);
const W = (over) => ({ ...D, ...over });
const R_MAX = 0.25, HALF = Math.ceil(0.2 * fs / 343) + 1; // the patterns' half length (rotary-model.h)

function run(P, input, changes = []) {
  const e = new Effect(fs);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length), ms = [];
  let cur = P, ok = true;
  for (let i = 0; i < input.length; i += 128) {
    for (const [t, over] of changes) if (t >= i && t < i + 128) { cur = { ...cur, ...over }; e.setParams(cur); }
    const m = Math.min(128, input.length - i);
    ok = e.process(input.subarray(i, i + m), L.subarray(i, i + m), R.subarray(i, i + m)) && ok;
    for (const q of e.messages()) if (q.type === 1) ms.push({ t: (i + m) / fs, v: Array.from(q.values) });
  }
  const latency = e.latency();
  e.destroy();
  return { L, R, ms, ok, latency };
}
const tone = (f, n, a = 0.1) => { const y = new Float32Array(n); for (let i = 0; i < n; i++) y[i] = a * Math.sin((2 * Math.PI * f * i) / fs); return y; };
const db = (v) => 20 * Math.log10(v);
// the complex envelope of y against a carrier at f, every hop samples, over win samples
function envelope(y, f, from, win = 96, hop = 48) {
  const out = [];
  for (let i = from; i + win < y.length; i += hop) {
    let re = 0, im = 0;
    for (let k = 0; k < win; k++) { const t = (i + k) / fs; re += y[i + k] * Math.cos(2 * Math.PI * f * t); im -= y[i + k] * Math.sin(2 * Math.PI * f * t); }
    out.push({ t: (i + win / 2) / fs, phase: Math.atan2(im, re), amp: (2 * Math.hypot(re, im)) / win });
  }
  return out;
}
const wrap = (v) => Math.atan2(Math.sin(v), Math.cos(v));

// ---- the model functions against the closed forms written here
{
  const F = [100, 500, 1000, 2000, 4000, 8000, 12000];
  const pattern = (P, which, s) => {
    const sc = scratch(x), v = Effect.native(P);
    sc.f64(v.length + 2 + F.length).set([...v, which, s, ...F]);
    x.rotary_pattern(sc.at, F.length);
    const o = sc.f64(2 * F.length, 8 * (v.length + 2 + F.length));
    return { fir: Array.from(o.subarray(0, F.length)), form: Array.from(o.subarray(F.length)) };
  };
  let worst = 0, firWorst = 0, firAt = '';
  for (const s of [0, 0.3, 0.7, 1]) for (const which of [0, 1]) {
    const a = which ? D.drumA : D.hornA, { fir, form } = pattern(D, which, s);
    F.forEach((f, i) => {
      // the power series is exact in doubles while its terms stay small: x up to 15
      if ((2 * Math.PI * f * a * s) / C <= 15) worst = Math.max(worst, Math.abs(form[i] - piston(f, a, s)));
      const ref = Math.abs(piston(f, a, s));
      if (ref > 0.1 && f <= 8000) { const e = Math.abs(db(fir[i] / ref)); if (e > firWorst) { firWorst = e; firAt = `${which ? 'drum' : 'horn'}, ${f} Hz, sin θ ${s}`; } }
    });
  }
  check(worst < 1e-9, 'the piston\'s pattern, 2 J1(x)/x, agrees with J1 by its power series', worst.toExponential(2));
  check(firWorst < 0.5, 'the patterns as the engine plays them (the piston\'s impulse response) are within 0.5 dB of it to 8 kHz, down to −20 dB', `${firWorst.toFixed(2)} dB, at ${firAt}`);
  // the retarded time against bisection
  let tauWorst = 0;
  for (const [mx, my, r, a0, w] of [[1, 0, 0.15, 0.3, 42], [0.3, 0.1, 0.24, 2, 40], [-2, 1, 0.1, 5, 3]]) {
    const sc = scratch(x);
    sc.f64(5).set([mx, my, r, a0, w]);
    x.rotary_path(sc.at);
    const got = sc.f64(4);
    const ref = retarded(0, { mx, my, r, w, alpha0: a0 });
    tauWorst = Math.max(tauWorst, Math.abs(got[0] + ref.te), Math.abs(got[2] - ref.cosTheta) * 1e-6);
  }
  check(tauWorst < 1e-12, 'the retarded time agrees with bisection', `${tauWorst.toExponential(2)} s`);
}

// ---- the engine: a high note on the horn, heard at the left microphone
{
  const f = 3000, N = 2 * fs, P = W({ fast: true, balance: 12 });
  const { L, R, ok } = run(P, tone(f, N));
  check(ok, 'plays without going unstable');
  const w = 2 * Math.PI * P.hornFast, off = (P.distance - R_MAX) / C;
  for (const [m, y] of [[0, L], [1, R]]) {
    const ph = (m ? 0.5 : -0.5) * P.spread, mx = P.distance * Math.cos(ph), my = P.distance * Math.sin(ph);
    const env = envelope(y, f, fs / 2);
    const res = [], amp = [], pred = [];
    for (const e of env) {
      // what is heard at t comes out half the pattern's length later
      const r = retarded(e.t - HALF / fs, { mx, my, r: P.hornR, w, alpha0: w / fs });
      res.push(wrap(e.phase + 2 * Math.PI * f * (e.t - r.te - off)));
      const s = r.cosTheta > 0 ? Math.sqrt(1 - r.cosTheta ** 2) : 1;
      const a = 0.1 * 10 ** (12 / 40) * highGain(f, P.crossover) * (P.distance / r.dist) * Math.abs(piston(f, P.hornA, s));
      amp.push(db(e.amp / a)); pred.push(db(a));
    }
    const mean = Math.atan2(res.reduce((s, v) => s + Math.sin(v), 0), res.reduce((s, v) => s + Math.cos(v), 0));
    const rms = Math.sqrt(res.reduce((s, v) => s + wrap(v - mean) ** 2, 0) / res.length);
    const swing = 4 * Math.PI * f * P.hornR / C;
    check(rms < 0.15, `${m ? 'right' : 'left'} microphone: a 3 kHz note's phase follows the retarded time (the Doppler shift)`, `residual ${rms.toFixed(3)} rad against a swing of ${swing.toFixed(1)}`);
    const spread = Math.max(...amp) - Math.min(...amp), range = Math.max(...pred) - Math.min(...pred);
    check(spread < 1.2 && Math.abs(amp.reduce((s, v) => s + v, 0) / amp.length) < 1.5, `${m ? 'right' : 'left'} microphone: its level follows 1/distance and the horn's pattern`, `within ${spread.toFixed(2)} dB, against a swing of ${range.toFixed(1)} dB`);
  }
}

// ---- the motors: each rate follows the switch with its time constant
{
  const N = 6 * fs, kick = new Float32Array(N); kick[0] = 1e-3; // something played, so the rotors spin up
  const { ms } = run(W({ fast: false }), kick, [[fs, { fast: true }]]);
  const at = (t, k) => ms.reduce((b, q) => (Math.abs(q.t - t) < Math.abs(b.t - t) ? q : b)).v[k];
  let worst = 0;
  for (const [k, slow, fast, tau] of [[2, D.hornSlow, D.hornFast, D.hornTau], [3, D.drumSlow, D.drumFast, D.drumTau]]) {
    for (const dt of [0.2, 0.5, 1, 2, 4]) {
      const want = fast + (slow - fast) * Math.exp(-dt / tau);
      worst = Math.max(worst, Math.abs(at(1 + dt, k) / want - 1));
    }
  }
  check(worst < 0.01, 'the horn\'s and the drum\'s rates follow the switch as first-order lags', `${(100 * worst).toFixed(2)} % at worst`);
}

// ---- the hints
const state = (P, secs = 1) => { const kick = new Float32Array(Math.round(secs * fs)); kick[0] = 1e-3; return run(P, kick).ms.map((q) => q.v); };
const cents = (r) => 1200 * Math.log2(r);
const swingOf = (ms, k) => Math.max(...ms.map((v) => Math.abs(cents(v[k]))));
{
  const fastS = swingOf(state(W({ fast: true })), 4), slowS = swingOf(state(W({ fast: false }), 2), 4);
  check(Math.abs(fastS - 30) < 4 && Math.abs(slowS - 4) < 1, 'Fast: the horn swings a note about ±30 cents fast, ±4 slow', `${fastS.toFixed(1)} and ${slowS.toFixed(1)} cents`);
  const near = state(W({ distance: 0.3 }), 2), far = state(W({ distance: 3 }), 2);
  const throb = (ms) => db(Math.max(...ms.map((v) => v[8])) / Math.min(...ms.map((v) => v[8])));
  check(Math.abs(throb(near) - 9) < 1 && throb(far) < 1, 'Mic distance: the horn\'s level throbs about 9 dB at 30 cm, under 1 dB at 3 m', `${throb(near).toFixed(1)} and ${throb(far).toFixed(2)} dB`);
  check(Math.abs(swingOf(near, 4) / swingOf(far, 4) - 1) < 0.05, 'Mic distance: the pitch swings the same', `${swingOf(near, 4).toFixed(2)} and ${swingOf(far, 4).toFixed(2)} cents`);
  const corr = (ms) => { const a = ms.map((v) => v[4] - 1), b = ms.map((v) => v[5] - 1); const s = (u, v) => u.reduce((t, q, i) => t + q * v[i], 0); return s(a, b) / Math.sqrt(s(a, a) * s(b, b)); };
  const opp = corr(state(W({ fast: true, spread: Math.PI }))), same = corr(state(W({ fast: true, spread: 0 })));
  check(opp < -0.95 && same > 0.999, 'Mic spread: at 180° the pitch rises in one microphone as it falls in the other; at 0 they hear the same', `correlation ${opp.toFixed(3)} and ${same.toFixed(4)}`);
  // the speeds: the rates as set, and a faster horn swings further
  const sl = state(W({ fast: false }), 0.5), fa = state(W({ fast: true }), 0.5);
  const near1 = (a, b) => Math.abs(a / b - 1) < 1e-4;
  check(near1(sl.at(-1)[2], D.hornSlow) && near1(sl.at(-1)[3], D.drumSlow) && near1(fa.at(-1)[2], D.hornFast) && near1(fa.at(-1)[3], D.drumFast), 'Horn and drum, slow and fast: the rotors turn at them (a Leslie\'s 50 and 400, 40 and 340 rpm)');
  check(swingOf(state(W({ fast: true, hornFast: 8 })), 4) > 1.15 * swingOf(fa, 4), 'Horn, fast: faster swings the pitch further');
  // spin-up: 95 % in three time constants
  check(Math.abs(3 * D.hornTau - 1) < 0.1 && Math.abs(3 * D.drumTau - 5) < 0.2, 'Horn and drum spin-up: 95 % of the way in about a second and about five seconds');
  check(swingOf(state(W({ fast: true, hornR: 0.24 })), 4) > 1.5 * swingOf(fa, 4) && swingOf(state(W({ fast: true, drumR: 0.24 })), 6) > 1.25 * swingOf(fa, 6), 'Horn and drum radius: further out swings the pitch further');
  // the patterns, as the C++ has them
  check(Math.abs(db(piston(100, D.drumA, 1))) < 0.1 && piston(600, 0.2, 1) < piston(600, 0.05, 1) - 0.1, 'Drum opening: a bass note hardly beams (100 Hz behind it, within 0.1 dB); wider beams the upper notes more');
  check(Math.abs(db(piston(4000, D.hornA, 1)) + 12.1) < 0.05 && Math.abs(db(piston(2000, D.hornA, 1)) + 2.45) < 0.05, 'the horn\'s pattern behind it: 4 kHz 12.1 dB down, 2 kHz 2.5 dB (its README)');
  check(piston(4000, 0.08, 1) < piston(4000, 0.02, 1) - 0.5 && Math.abs(db(piston(300, D.hornA, 1))) < 0.1, 'Horn mouth: a short wavelength beams, the more the wider the mouth; a long one spreads every way');
}
{
  // Horn and drum: up moves a high note up and a low one down; the crossover: higher keeps more of
  // a low note in the drum
  const N = fs, level = (P, f) => { const { L } = run(P, tone(f, N)); let s = 0; for (let i = N / 2; i < N; i++) s += L[i] * L[i]; return Math.sqrt(s / (N / 2)); };
  const lowUp = db(level(W({ balance: 12 }), 100) / level(W({ balance: -12 }), 100)), highUp = db(level(W({ balance: 12 }), 5000) / level(W({ balance: -12 }), 5000));
  check(lowUp < -10 && highUp > 10, 'Horn and drum: up brings the horn\'s high notes up and the drum\'s low ones down', `100 Hz ${lowUp.toFixed(1)} dB, 5 kHz ${highUp.toFixed(1)} dB`);
  const split = (fc) => db(level(W({ balance: 12, crossover: fc }), 400) / level(W({ balance: -12, crossover: fc }), 400));
  check(split(1600) < split(800) - 2, 'Crossover: higher keeps more of a 400 Hz note in the drum', `balance's swing at 400 Hz: ${split(800).toFixed(1)} dB at 800 Hz, ${split(1600).toFixed(1)} dB at 1.6 kHz`);
  check(Math.abs(db(level(W({ level: 6 }), 200) / level(W({}), 200)) - 6) < 0.01, 'Level: gain in decibels');
}

// ---- hygiene
{
  const { L, latency } = run(W({}), new Float32Array(fs));
  check(L.every((v) => v === 0), 'silence in, silence out');
  check(latency === Math.round(R_MAX / C * fs) + HALF, 'its latency is the flight from the largest rotor and half the longest pattern', `${latency} samples`);
  if (!CI) {
    const e = new Effect(fs); e.setParams(W({ fast: true }));
    const inp = tone(110, 128), L1 = new Float32Array(128), R1 = new Float32Array(128);
    const t0 = performance.now(); for (let i = 0; i < 2000; i++) e.process(inp, L1, R1); const ms = performance.now() - t0;
    const load = ms / ((2000 * 128 * 1000) / fs);
    check(load < 0.15, 'runs in well under a core', `${(100 * load).toFixed(1)} %`);
  }
}
done();
