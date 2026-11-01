// testguitar-tests.mjs — the test guitar (testguitar/README.md) against string physics written here:
// a plain string's tension from its gauge, Euler–Bernoulli inharmonicity, the nodes a pick and a
// pickup put in the spectrum, its losses, its tuning, its pickup's resonance; and the guitar on the
// page: its strings, riff and pickup as shared/instruments.js has them.

import { check, done } from './harness.mjs';
import { loadBass } from '../tools/engine.mjs';
import { amplitudeAt, db, peak } from '../tools/audio-util.mjs';
import { INSTRUMENTS, RIFFS, GUITAR_PICKUP } from '../shared/instruments.js';
import { tune } from '../shared/tuner.js';

const TB = await loadBass();
const fs = 48000, SCALE = 0.648, LB = 4.4482216; // N per pound-force
const cents = (a, b) => 1200 * Math.log2(a / b);
const et = (key) => 440 * 2 ** ((key - 69) / 12);
const OPEN = [40, 45, 50, 55, 59, 64];
// a 10–46 set: [the core's diameter (m), the tension (lb), plain?], low E to high E
const SET = [[0.46e-3, 17.0], [0.40e-3, 19.0], [0.33e-3, 18.4], [0.017 * 0.0254, 16.6, true], [0.013 * 0.0254, 15.4, true], [0.010 * 0.0254, 16.2, true]];
const g = () => new TB(fs, 'guitar');

// 0. what it is: six strings on a 25.5-inch scale, tuned E2 A2 D3 G3 B3 E4
{
  const b = g();
  check(b.get('strings') === 6 && Math.abs(b.get('scale') - 25.5 * 0.0254) < 1e-3, 'six strings on a 25.5-inch (0.648 m) scale');
  const worst = Math.max(...OPEN.map((k, s) => Math.abs(cents(b.partials(s, 0)[0].f, et(k)))));
  check(worst < 0.01 && OPEN.join() === TB.GUITAR_OPEN.join() && OPEN.join() === INSTRUMENTS.guitar.open.join(), 'tuned E2 A2 D3 G3 B3 E4, here, in the class and on the page', `worst ${worst.toFixed(4)} cents`);
}

// 1. a plain string's gauge and tension agree: T = μ(2ℓf)², μ = ρπd²/4 for steel (7850 kg/m³)
{
  const rows = [];
  let worst = 0;
  SET.forEach(([d, lb, plain], s) => {
    if (!plain) return;
    const mu = (7850 * Math.PI * d * d) / 4, T = mu * (2 * SCALE * et(OPEN[s])) ** 2;
    worst = Math.max(worst, Math.abs(T / (lb * LB) - 1));
    rows.push(`${['', '', '', 'G', 'B', 'high E'][s]} ${T.toFixed(1)} N against ${(lb * LB).toFixed(1)}`);
  });
  check(worst < 0.03, 'the plain strings\' listed tensions are what their gauges need at their pitches', rows.join(', '));
}

// 2. inharmonicity: B = π³ E d⁴ / (64 T ℓ²) for a steel core (E = 200 GPa), with the set's tensions
{
  let worst = 0;
  SET.forEach(([d, lb], s) => { const B = (Math.PI ** 3 * 200e9 * d ** 4) / (64 * lb * LB * SCALE ** 2); worst = Math.max(worst, Math.abs(TB.inharmonicity(s, SCALE, 'guitar') / B - 1)); });
  check(worst < 0.005, 'inharmonicity is the stiff string\'s B = π³Ed⁴/(64Tℓ²), from the set\'s gauges and tensions (within the rounding to micrometres and tenths of a newton)',
    `low E ${TB.inharmonicity(0, SCALE, 'guitar').toExponential(2)}, G ${TB.inharmonicity(3, SCALE, 'guitar').toExponential(2)}, high E ${TB.inharmonicity(5, SCALE, 'guitar').toExponential(2)}`);
}

// 3. partials follow f_n = n f₀ √(1 + B n²); the low E's 20th is about 45 cents sharp
{
  const ps = g().partials(0, 0), B = TB.inharmonicity(0, SCALE, 'guitar'), f0 = ps[0].f / Math.sqrt(1 + B);
  const worst = Math.max(...ps.map((p, i) => Math.abs(cents(p.f, (i + 1) * f0 * Math.sqrt(1 + B * (i + 1) ** 2)))));
  const c20 = cents(ps[19].f, 20 * ps[0].f);
  check(worst < 1e-6 && Math.abs(c20 - 45) < 1, 'its partials stretch as n√(1 + Bn²)', `the low E's 20th is ${c20.toFixed(1)} cents sharp of 20 × f₁`);
}

// 4. tuning: every note from the open low E to the high E's 24th fret
{
  const b = g();
  let worst = 0;
  for (let key = 40; key <= 88; key++) {
    const s = [...OPEN].reverse().findIndex((o) => key >= o), str = 5 - s, fret = key - OPEN[str];
    if (fret > 24) continue;
    worst = Math.max(worst, Math.abs(cents(b.partials(str, fret)[0].f, et(key))));
  }
  check(worst < 0.01, 'every note E2–E6 tunes its first partial to equal temperament', `worst ${worst.toFixed(4)} cents`);
}

// 5. a pick 12 cm from the bridge leaves out the partials with a node there; the pickup at 10 cm
// the ones with a node under it. On the open high E (ℓ = 0.648 m), 0.648/0.12 = 5.4 and
// 0.648/0.10 = 6.48: the 5th is weakened by the pick, the 6th–7th by the pickup, against a pick and
// a pickup moved to a quarter and a fifth of the string, which take out the 4th and the 5th exactly
function partialLevels(set, key, string, count) {
  const b = g();
  for (const [k, v] of Object.entries(set)) b.set(k, v);
  b.note(key, 0.8);
  const x = new Float32Array(2 * fs);
  b.process(x);
  const ps = b.partials(string, key - OPEN[string]), seg = x.subarray(fs / 10, fs / 10 + fs);
  return ps.slice(0, count).map((p) => db(amplitudeAt(seg, p.f, fs)));
}
{
  const L = partialLevels({ pluckAt: SCALE / 4 }, 40, 0, 6);
  check(L[3] < Math.min(L[2], L[4]) - 30, 'picked at a quarter of the string, the 4th harmonic is missing', `4th ${(L[3] - L[2]).toFixed(0)} dB under the 3rd`);
  const M = partialLevels({ pickupAt: SCALE / 5 }, 40, 0, 7);
  check(M[4] < Math.min(M[3], M[5]) - 30, 'heard by a pickup at a fifth of the string, the 5th is missing', `5th ${(M[4] - M[3]).toFixed(0)} dB under the 4th`);
}

// 6. a pick is brighter than a finger: the pluck's shape smoothed by its width w is the triangle's
// modes times sinc(kw/2). At the open low E's 60th partial (about 5 kHz, k = 60π/ℓ), a 15 mm
// finger keeps |sinc(k · 7.5 mm)| of it and the guitar's 3 mm pick |sinc(k · 1.5 mm)|; the model's
// partials carry exactly that factor (the pick moved off the bridge so no node falls near it)
{
  const b = g(), sinc = (u) => Math.sin(u) / u, n = 60, k = (n * Math.PI) / SCALE;
  const more = db(Math.abs(sinc(k * 0.0015))) - db(Math.abs(sinc(k * 0.0075)));
  const xp = 0.12, tri = (2 * SCALE ** 2) / (n * n * Math.PI ** 2 * xp * (SCALE - xp)) * Math.sin(k * xp);
  const xu = 0.10, heard = Math.sin(k * xu) * sinc(k * 0.0075), p = b.partials(0, 0)[n - 1];
  const model = p.amp / (tri * 2 * Math.PI * p.f * heard * sinc(k * 0.0015));
  check(b.get('width') === 0.003 && more > 6 && Math.abs(model - 1) < 1e-9, 'a pick\'s 3 mm edge keeps the high partials a 15 mm finger smooths away', `${more.toFixed(1)} dB more of the low E's 60th partial`);
}

// 7. losses: the fundamental decays at σ = b₁ + b₃f², its T60 = ln(1000)/σ (6.7 s for the low E,
// 4.8 s for the high E)
{
  const rows = [];
  let worst = 0;
  for (const [key, s] of [[40, 0], [64, 5]]) {
    const b = g();
    b.note(key, 0.8);
    const x = new Float32Array(5 * fs);
    b.process(x);
    const f1 = b.partials(s, 0)[0].f, n = 16384;
    const a1 = amplitudeAt(x.subarray(fs / 2, fs / 2 + n), f1, fs), a2 = amplitudeAt(x.subarray(3.5 * fs, 3.5 * fs + n), f1, fs);
    const sigma = Math.log(a1 / a2) / 3, expect = 1.0 + 4.0e-6 * f1 * f1;
    worst = Math.max(worst, Math.abs(sigma / expect - 1));
    rows.push(`${key === 40 ? 'low' : 'high'} E T60 ${(Math.log(1000) / sigma).toFixed(2)} s, the model ${(Math.log(1000) / expect).toFixed(2)} s`);
  }
  check(worst < 0.05, 'the fundamentals decay at σ = b₁ + b₃f²', rows.join('; '));
}

// 8. the pickup's circuit (the test bass's, discretised by the bilinear transform prewarped at the
// resonance): the page's guitar pickup (shared/instruments.js), and its resonance
// 1/(2π√(LC)) with the coil's 100 pF and 3 m of 100 pF/m cable, about 5.0 kHz. Against the same
// string through an active bass's flat preamp, each partial comes out |v/e| as loud, with
//   v/e = 1 / (1 + R/R_sh − LCω² + jω(RC + L/R_sh)),   R_sh = 125 kΩ ∥ 1 MΩ
{
  const b = g();
  check(b.get('inductance') === GUITAR_PICKUP.pickupL && b.get('resistance') === GUITAR_PICKUP.pickupR
    && Math.abs(b.get('capacitance') - GUITAR_PICKUP.pickupC) < 1e-18 && b.get('pots') === GUITAR_PICKUP.pots,
  'its pickup is the one the pedals start from for a guitar', `${GUITAR_PICKUP.pickupL} H, ${GUITAR_PICKUP.pickupR / 1e3} kΩ`);
  const L = 2.5, R = 6000, C = 400e-12, Rsh = 1 / (1 / 125e3 + 1 / 1e6), fr = 1 / (2 * Math.PI * Math.sqrt(L * C));
  const H = (f) => { const w = 2 * Math.PI * f; return 1 / Math.hypot(1 + R / Rsh - L * C * w * w, w * (R * C + L / Rsh)); };
  const play = (active) => { const c = g(); if (active) c.set('active', 1); c.note(64, 0.8); const x = new Float32Array(4096); c.process(x); return x; };
  const passive = play(false), flat = play(true), ps = b.partials(5, 0);
  let worst = 0;
  const rows = [];
  for (const p of ps.filter((q) => q.f < 6000)) {
    const got = db(amplitudeAt(passive, p.f, fs) / amplitudeAt(flat, p.f, fs)), want = db(H(p.f) / (1 / (1 + 1000 / 1e6)));
    worst = Math.max(worst, Math.abs(got - want));
    if (Math.abs(p.f - fr) < 330 / 2 || p === ps[0]) rows.push(`${p.f.toFixed(0)} Hz ${got.toFixed(2)} dB`);
  }
  check(worst < 0.2, 'every partial to 6 kHz comes through the pickup as the circuit says, lifted near its 5.0 kHz resonance (above, the bilinear transform\'s warping takes off a decibel by 8 kHz)', `worst ${worst.toFixed(3)} dB; ${rows.join(', ')}; resonance ${(fr / 1e3).toFixed(2)} kHz`);
}

// 9. level: a firm pick of the open low E peaks around 120 mV, the high E around 450 mV; linear
{
  const lv = (k, v) => { const b = g(); b.note(k, v); const x = new Float32Array(fs); b.process(x); return peak(x); };
  const lo = lv(40, 0.7), hi = lv(64, 0.7);
  check(Math.abs(lo - 0.12) < 0.02 && Math.abs(hi - 0.45) < 0.05, 'a firm pick peaks at a passive single coil\'s level', `open low E ${(1000 * lo).toFixed(0)} mV, high E ${(1000 * hi).toFixed(0)} mV`);
  check(Math.abs(lv(40, 0.7) / lv(40, 0.35) - 2) < 1e-4, 'twice the pick, twice the signal (the strings are linear)');
}

// 10. the riff: every note of the guitar's lies on its neck, an octave above the bass's
{
  const b = g();
  const ok = RIFFS.guitar.every(([k]) => !k || b.note(k, 0.5) >= 0);
  check(ok && RIFFS.guitar.every(([k, beats], i) => beats === RIFFS.bass[i][1] && (k === 0 ? RIFFS.bass[i][0] === 0 : k === RIFFS.bass[i][0] + 12)), 'the guitar\'s riff is the bass\'s an octave up, and every note is on its neck');
}

// 11. the tuner reads the test guitar in tune, on every open string and the high E's 12th fret
{
  let worst = 0;
  const rows = [];
  for (const key of [...OPEN, 76]) {
    const b = g();
    b.note(key, 0.8);
    const x = new Float32Array(fs);
    b.process(x);
    const f = tune(x.subarray(fs / 2 - 16384, fs / 2), fs, INSTRUMENTS.guitar.tuner), c = cents(f, et(key));
    worst = Math.max(worst, Math.abs(c));
    rows.push(`${key} ${c >= 0 ? '+' : ''}${c.toFixed(2)}`);
  }
  check(worst < 0.2, 'the tuner, set for a guitar, reads its open strings and the high E\'s 12th fret in tune', rows.join(', '));
}

// 12. becoming a guitar or a bass silences what rings, and nothing is left but zeros
{
  const b = g();
  for (const k of [40, 52, 64, 71]) b.note(k, 1);
  const x = new Float32Array(fs / 10);
  b.process(x);
  b.use('bass');
  b.process(x);
  const y = new Float32Array(30 * fs);
  b.use('guitar');
  for (const k of [40, 47, 55, 64, 76]) b.note(k, 1);
  b.process(y);
  check(peak(x) === 0 && b.get('strings') === 6 && y.every(Number.isFinite) && peak(y.subarray(29 * fs)) < 1e-6,
    'switching instrument silences it; every note dies away to silence, with no NaNs');
}

done();
