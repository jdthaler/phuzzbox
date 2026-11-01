// metronome-tests.mjs — the metronome (shared/metronome.js) against what is independent of it: the
// free-free beam's mode ratios as the textbooks give them (Rossing & Fletcher: 1, 2.756, 5.404,
// 8.933), a bar's first mode from its dimensions in closed form, the struck sound's spectrum and
// decay measured from the samples, the compound pendulum's period by integrating its equation of
// motion, and the beats' times.

import { check, done } from './harness.mjs';
import { beamRoots, modes, strike, contactSpectrum, period, weightAt, beatsBetween, tapTempo, swing, TICK, BELL, PENDULUM, TEMPO, WOOD } from '../shared/metronome.js';
import { readFileSync } from 'node:fs';

const fs = 48000;

// ---- the bars
{
  const r = beamRoots(4), ratio = r.map((x) => (x / r[0]) ** 2);
  const book = [1, 2.756, 5.404, 8.933];
  check(Math.abs(r[0] - 4.7300) < 1e-4 && ratio.every((x, i) => Math.abs(x - book[i]) < 2e-3), 'a free-free bar\'s modes: βL = 4.730, and frequencies in the ratios 1 : 2.756 : 5.404 : 8.933',
    ratio.map((x) => x.toFixed(4)).join(' : '));
  check(r.every((x) => Math.abs(Math.cos(x) * Math.cosh(x) - 1) < 1e-6 * Math.cosh(x)), 'each root satisfies cos βL cosh βL = 1');
  // the first mode of the maple block from its dimensions: f₁ = 22.373 / (2π L²) · t/√12 · √(E/ρ)
  const f1 = (22.3733 / (2 * Math.PI * TICK.L ** 2)) * (TICK.t / Math.sqrt(12)) * Math.sqrt(WOOD.E / WOOD.rho);
  const m = modes(TICK);
  check(Math.abs(m[0].f / f1 - 1) < 1e-4 && Math.abs(m[0].f - 1545) < 5, 'the tick, a maple block 150 × 8 mm, rings at 1545 Hz', `${m[0].f.toFixed(1)} Hz`);
  const b = modes(BELL);
  check(Math.abs(b[0].f - 3243) < 5, 'the bell, a steel bar 80 × 4 mm, at 3243 Hz', `${b[0].f.toFixed(1)} Hz`);
  check(Math.abs(m[0].tau - 1 / (Math.PI * m[0].f * 0.02)) < 1e-12 && Math.abs(m[0].tau * 1000 - 10.3) < 0.1 && Math.abs(b[0].tau - 0.327) < 0.002,
    'each mode decays as its loss factor says: τ = 1/(π f η), 10.3 ms for the maple, 0.33 s for the steel', `${(1000 * m[0].tau).toFixed(2)} ms, ${b[0].tau.toFixed(3)} s`);
  // the beater's half-sine: its spectrum by numerical integration against the closed form
  const T = 0.2e-3, F = (f) => { let re = 0, im = 0; const N = 4000; for (let i = 0; i < N; i++) { const t = ((i + 0.5) / N) * T, s = Math.sin((Math.PI * t) / T); re += s * Math.cos(2 * Math.PI * f * t); im += s * Math.sin(2 * Math.PI * f * t); } return Math.hypot(re, im) / N; };
  const F0 = F(0);
  check([500, 1545, 2500, 4259, 8349].every((f) => Math.abs(F(f) / F0 - contactSpectrum(f, T)) < 1e-4) && Math.abs(contactSpectrum(2500, T) - F(2500) / F0) < 1e-4,
    'the beater\'s contact, a half-sine of force: its spectrum as the closed form cos(πfT)/(1 − (2fT)²)');
  // the sound: its spectrum peaks at the first mode, and its envelope decays with τ₁
  const x = strike(TICK, fs);
  const dft = (f, from, n) => { let re = 0, im = 0; for (let i = from; i < from + n; i++) { const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i - from)) / n); re += w * x[i] * Math.cos((2 * Math.PI * f * i) / fs); im += w * x[i] * Math.sin((2 * Math.PI * f * i) / fs); } return Math.hypot(re, im); };
  let best = 0, at = 0;
  for (let f = 800; f < 6000; f += 5) { const p = dft(f, 0, 2400); if (p > best) { best = p; at = f; } }
  check(Math.abs(at - m[0].f) < 20, 'the tick\'s spectrum peaks at its first mode', `${at} Hz`);
  const a1 = dft(m[0].f, 0, 480), a2 = dft(m[0].f, 480, 480), tau = (480 / fs) / Math.log(a1 / a2);
  check(Math.abs(tau / m[0].tau - 1) < 0.05, 'and the first mode decays in the samples with its τ', `${(1000 * tau).toFixed(2)} ms`);
  check(Math.max(...x.map(Math.abs)) === 1 && x.length < 0.1 * fs && strike(BELL, fs).length === 1.5 * fs, 'each sound peaks at 1; the tick lasts until it is 60 dB down (71 ms), the bell 1.5 s');
}

// ---- the pendulum
{
  // integrate θ'' = −(g (M r_M − m r_m) / I) sin θ for a small swing and time its period
  const timed = (rm) => {
    const P = PENDULUM, I = P.M * P.rM ** 2 + P.m * rm ** 2, k = (P.g * (P.M * P.rM - P.m * rm)) / I, dt = 1e-5;
    let th = 1e-3, w = 0, t = 0, last = null, crossings = [];
    while (crossings.length < 3 && t < 30) {
      // velocity Verlet
      const a = -k * Math.sin(th);
      th += w * dt + 0.5 * a * dt * dt;
      const a2 = -k * Math.sin(th);
      const w2 = w + 0.5 * (a + a2) * dt;
      if (last !== null && w > 0 && w2 <= 0) crossings.push(t + dt * (w / (w - w2)));
      last = w; w = w2; t += dt;
    }
    return crossings[2] - crossings[1];
  };
  let worst = 0;
  for (const bpm of [TEMPO.min, 60, 100, 160, TEMPO.max]) {
    const rm = weightAt(bpm);
    worst = Math.max(worst, Math.abs(timed(rm) / (120 / bpm) - 1), Math.abs(period(rm) / (120 / bpm) - 1));
  }
  check(worst < 1e-4, 'the weight sits where the pendulum swings twice a beat: its period by integrating its motion, at 30 to 250 a minute', `worst ${worst.toExponential(1)}`);
  const lo = weightAt(TEMPO.min), hi = weightAt(TEMPO.max);
  check(lo > hi && hi > 0 && lo < 0.12, 'slower is the weight higher up the rod', `${(1000 * hi).toFixed(0)} mm at ${TEMPO.max}, ${(1000 * lo).toFixed(0)} mm at ${TEMPO.min}`);
  check(Math.abs(swing(1.5, 0.9, 100) + 1) < 1e-9 && Math.abs(swing(0.9, 0.9, 100) - 1) < 1e-12, 'the pendulum is at an end of its swing on each beat, the other end each next one');
}

// ---- the beats
{
  const b = beatsBetween(10, 120, 4, 10, 12.01);
  check(b.length === 5 && b.map((x) => x.beat).join() === '0,1,2,3,0' && Math.abs(b[4].t - 12) < 1e-12, 'at 120 a minute, four a bar: a beat each half second, the bell on the first of each bar');
  const c = [...beatsBetween(0, 97, 3, 0, 1), ...beatsBetween(0, 97, 3, 1, 2), ...beatsBetween(0, 97, 3, 2, 3)];
  check(c.length === beatsBetween(0, 97, 3, 0, 3).length && new Set(c.map((x) => x.t)).size === c.length, 'scheduled a window at a time, no beat is missed or played twice');
  check(beatsBetween(0, 60, 0, 0, 3).every((x) => x.beat === 1), 'with no bar, every beat is a tick');
  check(tapTempo([0, 0.5, 1, 1.5, 2]) === 120 && tapTempo([0, 0.6]) === null && tapTempo([0, 0.75, 1.5, 2.25]) === 80, 'tapping: the tempo from the intervals, once there are two');
}

// ---- the page
{
  const card = readFileSync(new URL('../shared/metronome-card.js', import.meta.url), 'utf8');
  check(/strike\(bar/.test(card) && /make\(TICK\)/.test(card) && /make\(BELL\)/.test(card) && /beatsBetween\(/.test(card) && /weightAt\(/.test(card), 'the card plays the struck bars on the beats and draws the weight where the tempo puts it');
}

done();
