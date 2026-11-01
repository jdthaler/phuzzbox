// views-tests.mjs — the Scope and the Spectrum every page has (shared/views.js), against closed
// forms: the Blackman window's transform for the spectrum's calibration, and sines whose zero
// crossings are known exactly for the scope's trigger.

import { readFileSync } from 'node:fs';
import { check, done } from './harness.mjs';
import { BLACKMAN_A0, PEAK_DB, trigger, niceRange, sharedScale, scopeView, spectrumView } from '../shared/views.js';
import { PEDALS } from '../shared/registry.js';

const root = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, root), 'utf8');
const dB = (x) => 20 * Math.log10(x);

// ---- the spectrum: the Web Audio specification's analyser, written out here (a Blackman window
// with α = 0.16, then the transform divided by N), at one bin
const fs = 48000, N = 8192;
const blackman = (n) => 0.42 - 0.5 * Math.cos((2 * Math.PI * n) / N) + 0.08 * Math.cos((4 * Math.PI * n) / N);
function binMagnitude(x, k) {
  let re = 0, im = 0;
  for (let n = 0; n < N; n++) { const v = blackman(n) * x[n], p = (2 * Math.PI * k * n) / N; re += v * Math.cos(p); im -= v * Math.sin(p); }
  return Math.hypot(re, im) / N;
}
const sine = (A, f, phase = 0.3) => Float64Array.from({ length: N }, (_, n) => A * Math.sin((2 * Math.PI * f * n) / fs + phase));
const bin = fs / N;

let mean = 0;
for (let n = 0; n < N; n++) mean += blackman(n) / N;
check(Math.abs(mean - BLACKMAN_A0) < 1e-12 && Math.abs(PEAK_DB + dB(BLACKMAN_A0 / 2)) < 1e-12,
  'Spectrum: the calibration is the Blackman window\'s mean, its coherent gain', `a₀ = ${mean.toFixed(6)}, +${PEAK_DB.toFixed(2)} dB`);

{
  const A = 0.3, k = 7, x = sine(A, k * bin); // 41.0 Hz, on bin 7
  const reading = dB(binMagnitude(x, k)) + PEAK_DB;
  check(Math.abs(reading - dB(A)) < 0.001, 'Spectrum: a sine of 0.3 V peak on a bin reads its amplitude in dBV', `${reading.toFixed(3)} dBV, 20 log₁₀ 0.3 = ${dB(A).toFixed(3)}`);
  const mags = [5, 6, 7, 8, 9].map((j) => binMagnitude(x, j));
  check(mags.indexOf(Math.max(...mags)) === 2, 'Spectrum: it lands in bin f / (fs/N)');
}

{
  // half way between bins: the window's transform at half a bin off, in closed form for large N,
  // |W(b)| = |sin πb| / π · |a₀/b − (a₁/2)(1/(b−1) + 1/(b+1)) + (a₂/2)(1/(b−2) + 1/(b+2))|
  const b = 0.5, a0 = 0.42, a1 = 0.5, a2 = 0.08;
  const W = (Math.abs(Math.sin(Math.PI * b)) / Math.PI) * Math.abs(a0 / b - (a1 / 2) * (1 / (b - 1) + 1 / (b + 1)) + (a2 / 2) * (1 / (b - 2) + 1 / (b + 2)));
  const scallop = dB(a0 / W);
  const A = 0.3, x = sine(A, (7 + b) * bin);
  const loss = dB(A) - (dB(binMagnitude(x, 7)) + PEAK_DB);
  check(Math.abs(loss - scallop) < 0.01 && Math.abs(loss - 1.10) < 0.01, 'Spectrum: a sine half way between bins reads the window\'s scalloping loss low', `${loss.toFixed(3)} dB, closed form ${scallop.toFixed(3)} dB`);
}

// ---- the scope's trigger: sines whose rising crossings are at ωt + φ = 2πk
{
  const f = 41.2034, w = (2 * Math.PI * f) / fs, phi = 1.1, n = 8192, last = n - 2400 - 1;
  const at = (i) => Math.sin(w * i + phi);
  const k = Math.floor((w * last + phi) / (2 * Math.PI));
  const want = (2 * Math.PI * k - phi) / w;
  const got = trigger(at, last, 0, 0.1);
  check(Math.abs(got - want) < 1e-3, 'Scope: the trigger finds the last rising crossing before the window, to a thousandth of a sample', `${got.toFixed(4)} vs ${want.toFixed(4)}`);
  const lvl = 0.5, wantL = (Math.asin(lvl) + 2 * Math.PI * Math.floor((w * last + phi - Math.asin(lvl)) / (2 * Math.PI)) - phi) / w;
  check(Math.abs(trigger(at, last, lvl, 0.1) - wantL) < 0.05, 'Scope: and at a level off the middle, where sin(ωt + φ) = level', `${trigger(at, last, lvl, 0.1).toFixed(3)} vs ${wantL.toFixed(3)}`);
}
{
  // noise on a slow sine crosses the level many times on each rise; a tenth of the swing of
  // hysteresis lets only one crossing a period through, near the true one
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const f = 41.2034, w = (2 * Math.PI * f) / fs, n = 8192, noise = Float64Array.from({ length: n }, () => 0.1 * (rand() - 0.5));
  const at = (i) => Math.sin(w * i) + noise[i];
  const count = (hyst) => {
    const found = [];
    for (let last = n - 1, t; (t = trigger(at, last, 0, hyst)) >= 0; last = Math.floor(t) - 1) found.push(t);
    return found;
  };
  const periods = Math.floor((w * (n - 1)) / (2 * Math.PI)); // rising crossings at 2πk / ω, k = 1 … periods
  const withH = count(0.2), without = count(0);
  const near = withH.every((t) => { const k = Math.round((w * t) / (2 * Math.PI)); return Math.abs(t - (2 * Math.PI * k) / w) < 15; });
  check(withH.length === periods && near && without.length > periods,
    'Scope: with hysteresis, noise on a slow edge triggers once a period, near the true crossing; without, many times',
    `${withH.length} triggers for ${periods} periods with hysteresis, ${without.length} without`);
}
check(trigger((i) => 0.5 + 0.1 * Math.sin(i / 50), 8000, 0, 0.1) === -1, 'Scope: a wave that never crosses its level gives no trigger (the scope runs free)');

// ---- the scope's volts a division
{
  const cases = [[0.3, 0.5], [0.11, 0.2], [1, 1], [2.01, 5], [0.0049, 0.005], [7, 10]];
  check(cases.every(([x, r]) => Math.abs(niceRange(x) - r) < 1e-12), 'Scope: volts a division are the next 1, 2 or 5 × 10ⁿ', cases.map(([x]) => `${x} → ${niceRange(x)}`).join(', '));
  let ok = true;
  for (let i = 0; i < 1000; i++) {
    const x = 10 ** (-4 + 5 * (i / 1000)), r = niceRange(x), m = r / 10 ** Math.floor(Math.log10(r) + 1e-9);
    if (!(r >= x * (1 - 1e-12) && r < 2.5 * x + 1e-15 && [1, 2, 5].some((d) => Math.abs(m - d) < 1e-9))) ok = false;
  }
  check(ok, 'Scope: never less than the peak needs, and never more than 2.5 times it');
}

check(sharedScale(0.05, 0.1).join() === '0.1,0.1' && sharedScale(0.2, 0.5).join() === '0.5,0.5' && sharedScale(0.05, 0.5).join() === '0.05,0.5' && sharedScale(1, 0.2).join() === '1,0.2',
  'Scope: the traces share a scale within one step of 1, 2, 5 of each other, and part beyond it');

// ---- every page has them: the shell adds both to a pedal that doesn't bring its own
{
  const shell = read('shared/shell.js'), notes = read('shared/notes.js');
  check(/has\('Spectrum'\)[^\n]*spectrumView\(\)/.test(shell) && /has\('Scope'\)[^\n]*scopeView\(\)/.test(shell), 'Every page: the shell adds a Scope and a Spectrum to a pedal that doesn\'t bring its own');
  check(/['"]scope\/['"]/.test(notes) && /['"]spectrum\/['"]/.test(notes), 'Every page: How it works has the scope\'s and the spectrum\'s notes');
  check(scopeView().title === 'Scope' && spectrumView().title === 'Spectrum' && scopeView().about === 'scope' && spectrumView().about === 'spectrum',
    'Every page: the views are titled Scope and Spectrum and open their notes');
  for (const p of PEDALS.filter((x) => x.ready)) {
    const main = read(`${p.id}/src/${p.id}-main.js`);
    const own = [...main.matchAll(/^\s*title:\s*'(Scope|Spectrum)'/gm)].map((m) => m[1]);
    check(!own.length, `${p.name}: its Scope and Spectrum are the shared ones (shared/views.js), with its own captions if any`, own.join(', '));
  }
}

done();
