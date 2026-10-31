// testbass-tests.mjs — the test bass against string physics written here: Euler–Bernoulli
// inharmonicity, the nodes a pluck and a pickup put in the spectrum, its losses, its tuning.

import { check, done } from './harness.mjs';
import { loadBass } from '../tools/engine.mjs';
import { amplitudeAt, db, peak } from '../tools/audio-util.mjs';

const TB = await loadBass();
const fs = 48000, SCALE = 0.864;
const cents = (a, b) => 1200 * Math.log2(a / b);
const et = (key) => 440 * 2 ** ((key - 69) / 12);

// 1. inharmonicity: B = π³ E d⁴ / (64 T ℓ²) for a steel core (E = 200 GPa)
{
  const specs = [[1.0e-3, 190], [0.85e-3, 200], [0.65e-3, 190], [0.5e-3, 170]];
  let worst = 0;
  specs.forEach(([d, T], s) => { const B = (Math.PI ** 3 * 200e9 * d ** 4) / (64 * T * SCALE ** 2); worst = Math.max(worst, Math.abs(TB.inharmonicity(s, SCALE) / B - 1)); });
  check(worst < 1e-12, 'inharmonicity is the stiff string\'s B = π³Ed⁴/(64Tℓ²)', `open E: B = ${TB.inharmonicity(0, SCALE).toExponential(2)}`);
}

// 2. partials follow f_n = n f₀ √(1 + B n²)
{
  const b = new TB(fs), ps = b.partials(0, 0), B = TB.inharmonicity(0, SCALE), f0 = ps[0].f / Math.sqrt(1 + B);
  const worst = Math.max(...ps.map((p, i) => Math.abs(cents(p.f, (i + 1) * f0 * Math.sqrt(1 + B * (i + 1) ** 2)))));
  check(worst < 1e-6, 'its partials stretch as n√(1 + Bn²)', `the 20th is ${cents(ps[19].f, 20 * ps[0].f).toFixed(1)} cents sharp of 20 × f₁`);
}

// 3. tuning: every note's first partial is equal temperament's
{
  const b = new TB(fs);
  let worst = 0;
  for (let key = 28; key <= 67; key++) {
    const s = [43, 38, 33, 28].findIndex((o) => key >= o), str = 3 - s, fret = key - [28, 33, 38, 43][str];
    worst = Math.max(worst, Math.abs(cents(b.partials(str, fret)[0].f, et(key))));
  }
  check(worst < 0.01, 'every note E1–G4 tunes its first partial to equal temperament', `worst ${worst.toFixed(4)} cents`);
}

// the strongest frequency near f in a block, by a fine search
function peakNear(x, f, span = 0.01, steps = 400) {
  let best = f, bestA = -1;
  for (let i = 0; i <= steps; i++) { const g = f * (1 - span + (2 * span * i) / steps), a = amplitudeAt(x, g, fs); if (a > bestA) { bestA = a; best = g; } }
  return best;
}

// 4. the engine sounds the model's partials
{
  const b = new TB(fs);
  b.note(28, 0.8);
  const x = new Float32Array(3 * fs);
  b.process(x);
  const ps = b.partials(0, 0), seg = x.subarray(fs / 4, fs / 4 + 2 * fs);
  const e1 = cents(peakNear(seg, ps[0].f), ps[0].f), e5 = cents(peakNear(seg, ps[4].f), ps[4].f);
  check(Math.abs(e1) < 0.5 && Math.abs(e5) < 0.5, 'the engine sounds them where the model puts them', `1st ${e1.toFixed(2)}, 5th ${e5.toFixed(2)} cents`);
}

// 5. a pluck at 1/4 of the string leaves out the 4th harmonic (and 8th…); a pickup at 1/5, the 5th
function partialLevels(set, key, count) {
  const b = new TB(fs);
  for (const [k, v] of Object.entries(set)) b.set(k, v);
  b.note(key, 0.8);
  const x = new Float32Array(2 * fs);
  b.process(x);
  const ps = b.partials(0, key - 28), seg = x.subarray(fs / 10, fs / 10 + fs);
  return ps.slice(0, count).map((p) => db(amplitudeAt(seg, p.f, fs)));
}
{
  const L = partialLevels({ pluckAt: SCALE / 4 }, 28, 6);
  check(L[3] < Math.min(L[2], L[4]) - 30, 'plucked at a quarter of the string, the 4th harmonic is missing', `4th ${(L[3] - L[2]).toFixed(0)} dB under the 3rd`);
  const M = partialLevels({ pickupAt: SCALE / 5 }, 28, 7);
  check(M[4] < Math.min(M[3], M[5]) - 30, 'heard by a pickup at a fifth of the string, the 5th is missing', `5th ${(M[4] - M[3]).toFixed(0)} dB under the 4th`);
}

// 6. losses: the fundamental decays at σ = b₁ + b₃f², its T60 = ln(1000)/σ
{
  const b = new TB(fs);
  b.note(28, 0.8);
  const x = new Float32Array(5 * fs);
  b.process(x);
  const f1 = b.partials(0, 0)[0].f, n = 16384;
  const a1 = amplitudeAt(x.subarray(fs / 2, fs / 2 + n), f1, fs), a2 = amplitudeAt(x.subarray(3.5 * fs, 3.5 * fs + n), f1, fs);
  const sigma = Math.log(a1 / a2) / 3, expect = 1.0 + 4.0e-6 * f1 * f1;
  check(Math.abs(sigma / expect - 1) < 0.05, 'the fundamental decays at σ = b₁ + b₃f²', `T60 ${(Math.log(1000) / sigma).toFixed(2)} s, the model ${(Math.log(1000) / expect).toFixed(2)} s`);
}

// 7. a muting hand stops a note within a tenth of a second
{
  const b = new TB(fs);
  b.note(33, 0.8);
  const x = new Float32Array(fs);
  b.process(x.subarray(0, fs / 2));
  const before = peak(x.subarray(fs / 2 - 4800, fs / 2));
  b.noteOff(33);
  b.process(x.subarray(fs / 2));
  const after = peak(x.subarray(fs / 2 + 4800, fs / 2 + 9600));
  check(db(after / before) < -40, 'muted, a note dies 40 dB in 0.1 s', `${db(after / before).toFixed(0)} dB`);
}

// 8. level: a passive bass gives a few hundred millivolts, and the model is linear in the pluck
{
  const lv = (v) => { const b = new TB(fs); b.note(28, v); const x = new Float32Array(fs); b.process(x); return peak(x); };
  const p7 = lv(0.7), p35 = lv(0.35);
  check(p7 > 0.1 && p7 < 1, 'a firm pluck of the open E peaks at a few hundred millivolts', `${(1000 * p7).toFixed(0)} mV`);
  check(Math.abs(p7 / p35 - 2) < 1e-4, 'twice the pluck, twice the signal (the strings are linear)');
}

// 9. silence after everything dies away, no NaNs
{
  const b = new TB(fs);
  for (const k of [28, 35, 40, 43, 50]) b.note(k, 1);
  const x = new Float32Array(30 * fs);
  b.process(x);
  check(x.every(Number.isFinite) && peak(x.subarray(29 * fs)) < 1e-6, 'every note dies away to silence, with no NaNs');
}

done();
