// tuner-tests.mjs — the page's tuner against tones whose frequencies are known in closed form:
// harmonic series detuned by set amounts, a weak fundamental, a stiff string's stretched partials
// (f_n = n f₁ √(1 + Bn²) / √(1 + B)), then the test bass, whose first partials are equal
// temperament's (checked in testbass-tests.mjs).

import { check, done, CI } from './harness.mjs';
import { loadBass } from '../tools/engine.mjs';
import { tune, detectPitch, noteOf, Tuner, OPEN_STRINGS } from '../shared/tuner.js';

const fs = 48000, N = 16384;
const et = (key, a4 = 440) => a4 * 2 ** ((key - 69) / 12);
const cents = (a, b) => 1200 * Math.log2(a / b);
let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// a sum of partials [frequency, amplitude] with random phases and a string's decay
function tone(partials, n = N, tau = 1.5) {
  const x = new Float32Array(n), ph = partials.map(() => 2 * Math.PI * rand());
  for (let i = 0; i < n; i++) {
    let s = 0;
    partials.forEach(([f, a], k) => { s += a * Math.sin((2 * Math.PI * f * i) / fs + ph[k]); });
    x[i] = 0.1 * s * Math.exp(-i / fs / tau);
  }
  return x;
}
const harmonics = (f, amps) => amps.map((a, k) => [(k + 1) * f, a]);

// 1. detuned harmonic series on every bass's open strings, B0 to C3
{
  let worst = 0, wrong = 0;
  for (const key of OPEN_STRINGS) for (const c of [0, 7.3, -13.9, 31]) {
    const f = et(key) * 2 ** (c / 1200), got = tune(tone(harmonics(f, [1, 0.5, 0.33, 0.25, 0.2, 0.17, 0.14, 0.12])), fs);
    const n = noteOf(got);
    if (n.key !== key) wrong++;
    worst = Math.max(worst, Math.abs(cents(got, f)));
  }
  check(wrong === 0 && worst < 0.1, 'reads B0–C3 detuned by −14 to +31 cents to a tenth of a cent', `worst ${worst.toFixed(3)} cents`);
}

// 2. a weak fundamental: the period still names the note, not the octave above
{
  const f = et(28) * 2 ** (4 / 1200), got = tune(tone(harmonics(f, [0.1, 1, 0.7, 0.4, 0.3])), fs), n = noteOf(got);
  check(n.name === 'E1' && Math.abs(cents(got, f)) < 0.1, 'a low E with its fundamental 20 dB under the octave still reads E1', `${n.name} ${n.cents.toFixed(2)} cents (played +4)`);
}

// 3. a stiff string: the waveform's period is sharp of f₁; the tuner reads f₁
{
  const B = (Math.PI ** 3 * 200e9 * 1.0e-3 ** 4) / (64 * 190 * 0.864 ** 2); // a steel-core low E
  const f1 = et(28), parts = [];
  for (let k = 1; k <= 24; k++) parts.push([(k * f1 * Math.sqrt(1 + B * k * k)) / Math.sqrt(1 + B), 1 / k]);
  const x = tone(parts), period = detectPitch(x.subarray(N - 8192), fs), got = tune(x, fs);
  check(Math.abs(cents(got, f1)) < 0.1 && cents(period, f1) > 1, 'a stiff low E reads its first partial, not the stretched waveform\'s period',
    `B = ${B.toExponential(2)}: period ${cents(period, f1).toFixed(1)} cents sharp, tuner ${cents(got, f1).toFixed(3)}`);
}

// 4. the test bass's open strings, at the pluck, mid-note and late in the decay
{
  const TB = await loadBass();
  let worst = 0, wrong = 0;
  for (const key of [28, 33, 38, 43]) {
    const b = new TB(fs), x = new Float32Array(3 * fs);
    b.note(key, 0.8); b.process(x);
    for (const t of [0.05, 0.5, 2.5]) {
      const got = tune(x.subarray(Math.round(t * fs), Math.round(t * fs) + N), fs);
      if (noteOf(got).key !== key) wrong++;
      worst = Math.max(worst, Math.abs(cents(got, et(key))));
    }
  }
  check(wrong === 0 && worst < 0.2, 'the test bass\'s open strings read in tune, from the pluck to the decay', `worst ${worst.toFixed(3)} cents`);
}

// 4b. just after a pluck the block still holds the silence before it, whose step would pull the
// peak by tens of cents: the tuner waits until the note fills half the block, then reads true
{
  const TB = await loadBass();
  let worst = 0, first = Infinity;
  for (const key of [28, 36, 45]) {
    const b = new TB(fs), x = new Float32Array(N + 1.2 * fs);
    b.note(key, 0.8); b.process(x.subarray(N));
    for (let t = 0.02; t < 1.2; t += 0.02) {
      const e = Math.round(t * fs) + N, got = tune(x.subarray(e - N, e), fs);
      if (got) { first = Math.min(first, t); worst = Math.max(worst, Math.abs(cents(got, et(key)))); }
    }
  }
  check(worst < 0.5 && first < 0.25, 'from the first reading after a pluck, it is in tune to half a cent', `first reading ${(1000 * first).toFixed(0)} ms after the pluck, worst ${worst.toFixed(3)} cents`);
}

// 5. the reference pitch: cents are 1200 log₂(f / f_A4) from the nearest note
{
  const a = noteOf(432, 432), b = noteOf(440, 432), want = cents(440, 432);
  check(a.name === 'A4' && Math.abs(a.cents) < 1e-9 && Math.abs(b.cents - want) < 1e-9 && Math.abs(noteOf(41.2, 440).target - et(28)) < 1e-9,
    'A4 = 432 Hz puts 440 Hz 31.8 cents sharp of A4', `${b.cents.toFixed(2)} cents`);
}

// 6. silence and noise read nothing
{
  const noise = new Float32Array(N).map(() => 0.05 * (rand() - 0.5));
  check(tune(new Float32Array(N), fs) === 0 && tune(noise, fs) === 0, 'silence and white noise read no note');
}

// 7. smoothing: a stray octave is outvoted; a note is held 1.5 s after it ends, then cleared
{
  const T = new Tuner(), f = et(28);
  [f, f, f, 2 * f, f].forEach((g, i) => T.push(g, 0.1 * i));
  const held = T.push(0, 1.0), gone = T.push(0, 2.2);
  check(T.recent.length === 0 && held?.name === 'E1' && !held.live && gone === null, 'one stray octave doesn\'t move the needle; the note holds 1.5 s, then clears');
  const U = new Tuner();
  let shown = null;
  [f, f, f, 2 * f].forEach((g, i) => { shown = U.push(g, 0.1 * i); });
  check(shown.name === 'E1', 'the median of three keeps E1 through an octave reading', shown.name);
}

// 8. it is cheap enough to run ten times a second on the page
if (!CI) {
  const x = tone(harmonics(et(28), [1, 0.5, 0.3])), t0 = performance.now();
  for (let i = 0; i < 10; i++) tune(x, fs);
  const ms = (performance.now() - t0) / 10;
  check(ms < 15, 'one reading of 16384 samples takes under 15 ms', `${ms.toFixed(1)} ms`);
}

done();
