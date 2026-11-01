// motion-tests.mjs — the slow-motion views' shared parts (shared/motion.js), against signals whose
// answers are known: a note's start in silence and in a held note, the slowed clock, and a mode
// bank against the damped sinusoid it samples. Each pedal's own slow motion is checked against its
// engine in that pedal's tests (spring, plate).

import { check, done } from './harness.mjs';
import { noteStarted, onsetNear, slowTime, Bank, SPEEDS, speedName } from '../shared/motion.js';

const fs = 48000;
const note = (n, at, f = 55, a = 0.2, floor = 0) => Float32Array.from({ length: n }, (_, i) => (i >= at ? a * Math.exp(-(i - at) / (0.4 * fs)) * Math.sin((2 * Math.PI * f * (i - at)) / fs) : 0) + floor * Math.sin(i * 1.7));

{
  const n = 8192;
  check(noteStarted(note(n, n - 600), fs), 'a note that began 12 ms ago, out of silence, is seen starting');
  check(!noteStarted(note(n, 0), fs), 'a note held for the whole window is not seen starting again');
  check(!noteStarted(note(n, n - 600, 55, 1e-3), fs), 'nor is one quieter than 2 mV, the hiss of a quiet line');
  const under = note(n, 0, 82, 0.05), over = note(n, n - 500, 55, 0.3);
  check(noteStarted(Float32Array.from(under, (v, i) => v + over[i]), fs), 'a loud note played over a quieter one still ringing is seen starting');
}

{
  const n = 8192;
  for (const at of [1500, 4000, 6500]) {
    const x = note(n, at, 41.2, 0.2, 1e-4), got = onsetNear(x, fs, at + Math.round(0.012 * fs));
    check(got <= at && at - got <= Math.round(0.004 * fs), `a note's start found to within 4 ms before it, from a guess 12 ms late (sample ${at})`, `found ${got}, ${((at - got) / fs * 1000).toFixed(1)} ms early`);
  }
}

{
  const s = 1 / 100, secs = 0.2;
  check(Math.abs(slowTime(1, s, secs) - 0.01) < 1e-12 && Math.abs(slowTime(19.9, s, secs) - 0.199) < 1e-12, 'the clock: one real second at 1/100 speed is 10 ms of the note');
  check(slowTime(20.5, s, secs) === secs && slowTime(21.4, s, secs) === secs, 'it holds at the end for a moment');
  check(Math.abs(slowTime(21.5 + 2, s, secs) - 0.02) < 1e-12, 'and goes round again');
  check(SPEEDS.map(speedName).join() === '1/10,1/30,1/100,1/300,1/1000', 'the speeds offered: 1/10 to 1/1000', SPEEDS.map(speedName).join(', '));
}

{
  // one mode, as the engines tune theirs: p = e^{(−σ + iω_d)T}, c = T w (1 + iσ/ω_d). Its response
  // to a unit impulse is w e^{−σt}(cos ω_d t − (σ/ω_d) sin ω_d t) · T, the impulse invariant
  const f = 440, sigma = 30, w = 2, T = 1 / fs, wd = Math.sqrt((2 * Math.PI * f) ** 2 - sigma ** 2), a = Math.exp(-sigma * T);
  const b = new Bank(Float64Array.of(a * Math.cos(wd * T)), Float64Array.of(a * Math.sin(wd * T)), Float64Array.of(T * w), Float64Array.of((T * w * sigma) / wd));
  const x = new Float32Array(1); x[0] = 1;
  let worst = 0;
  for (const k of [1, 2, 100, 4800, 1000]) { // the last goes back: from rest again
    b.seek(k, x);
    const t = (k - 1) * T, want = T * w * Math.exp(-sigma * t) * (Math.cos(wd * t) - (sigma / wd) * Math.sin(wd * t));
    worst = Math.max(worst, Math.abs(b.zr[0] - want) / (T * w));
  }
  check(worst < 1e-9, 'a bank\'s mode samples the damped resonance exactly, forward and from rest again', `worst ${worst.toExponential(1)} of its first sample`);
  b.reset(); b.seek(100, x, 30);
  check(b.k === 30, 'and a frame advances it at most so far, catching up over the next');
}

done();
