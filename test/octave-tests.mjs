// octave-tests.mjs — the Octave Down against physics written here, independently of the C++
// (test/octave-circuit.mjs): the divider's ideal waveforms for a steady sine and their Fourier
// coefficients by Simpson's rule, and the RC sections' bilinear images; then the engine against
// them, its aliasing, each hint, and hygiene.

import { check, done, CI } from './harness.mjs';
import { loadPedal, loadBass } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { amplitudeAt, db, sine, peak } from '../tools/audio-util.mjs';
import { paths, component, SMALL_H, rcBilinear } from './octave-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('octave');
const x = Effect.exports;
const fs = 48000;
// at the output knob's unity setting (its default is set for loudness: tools/loudness.mjs)
const D = { ...defaults(PEDAL.groups), level: 0 };
const W = (over) => ({ ...D, ...over });
const preset = (name, over) => W({ ...PEDAL.presets[name], ...over });

function run(P, input) {
  const e = new Effect(fs);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length), ms = [];
  let ok = true;
  for (let at = 0; at < input.length; at += 4800) {
    const m = Math.min(4800, input.length - at);
    ok = e.process(input.subarray(at, at + m), L.subarray(at, at + m), R.subarray(at, at + m)) && ok;
    for (const q of e.messages()) if (q.type === 1) ms.push({ f: q.values[0], q1: q.values[1], q2: q.values[2] });
  }
  const latency = e.latency();
  e.destroy();
  return { L, R, ms, ok, latency };
}
// the divider's insides for a steady sine (octave-web.cpp): x_f, q₁, q₂, and the two octave paths
function wave(P, f, A, n, stride = 1) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length + 2).set([...v, f, A]);
  x.octave_wave(s.at, n, stride);
  const o = Array.from(s.f64(5 * n, 8 * (v.length + 2)));
  return { xf: o.slice(0, n), q1: o.slice(n, 2 * n), q2: o.slice(2 * n, 3 * n), y1: o.slice(3 * n, 4 * n), y2: o.slice(4 * n) };
}
const steady = (f, a, secs = 2) => sine(f, fs, Math.round(secs * fs), a);
const tail = (y, secs = 1) => y.subarray(y.length - Math.round(secs * fs));
const TB = await loadBass();
const bassNote = (midi, vel, secs = 1.5) => { const b = new TB(fs); b.note(midi, vel); const y = new Float32Array(Math.round(secs * fs)); b.process(y); return y; };

// the amplitude of a steady sinusoid at f in samples at rate r, by least squares (exact for a pure one)
function fitAmp(y, f, r) {
  let ss = 0, cc = 0, sc = 0, ys = 0, yc = 0;
  y.forEach((v, i) => { const s = Math.sin((2 * Math.PI * f * i) / r), c = Math.cos((2 * Math.PI * f * i) / r); ss += s * s; cc += c * c; sc += s * c; ys += v * s; yc += v * c; });
  const det = ss * cc - sc * sc, a = (ys * cc - yc * sc) / det, b = (yc * ss - ys * sc) / det;
  return Math.hypot(a, b);
}

// 1. the tracking filter: two RC sections, each the bilinear image of 1/(1 + jf/ft)
{
  let worst = 0;
  for (const f of [40, 110, 250, 600, 1500]) {
    const w = wave(W({ track: 250 }), f, 0.1, 1500), a = fitAmp(w.xf, f, fs) / 0.1, want = rcBilinear(250, f, fs) ** 2;
    worst = Math.max(worst, Math.abs(db(a) - db(want)));
  }
  check(worst < 0.01, 'model: the tracking filter is two RC low-passes, each the bilinear image of its circuit', `worst ${worst.toFixed(4)} dB, 40 Hz to 1.5 kHz`);
}

// 2. the octaves for a steady sine: the waveform's Fourier coefficient, here by Simpson's rule
{
  const fn = paths(1, 1e-9);
  const c1 = component(fn.one, 0.5, 2), c2 = component(fn.two, 0.25, 4);
  check(Math.abs(c1 - SMALL_H) < 1e-6, `model: with the hysteresis small, one octave down's fundamental is 8/(3π) = ${SMALL_H.toFixed(4)} of the sine (Simpson's rule)`, `${c1.toFixed(6)}`);
  let worst = 0;
  const rows = [];
  for (const [f, A, h] of [[110, 0.3, 5e-3], [55, 0.2, 5e-3], [220, 0.05, 20e-3], [82.4, 0.5, 1e-3]]) {
    const P = W({ dry: 0, oct1: 1, oct2: 1, hyst: h, track: 250 }), a = A * rcBilinear(250, f, fs) ** 2;
    const fnh = paths(a, h);
    const want1 = component(fnh.one, 0.5, 2) * rcBilinear(P.tone, f / 2, fs), want2 = component(fnh.two, 0.25, 4) * rcBilinear(P.tone, f / 4, fs);
    const y1 = tail(run({ ...P, oct2: 0 }, steady(f, A, 3)).L, 2), y2 = tail(run({ ...P, oct1: 0 }, steady(f, A, 3)).L, 2);
    const got1 = amplitudeAt(y1, f / 2, fs), got2 = amplitudeAt(y2, f / 4, fs);
    worst = Math.max(worst, Math.abs(got1 / want1 - 1), Math.abs(got2 / want2 - 1));
    rows.push(`${f} Hz: ${(1e3 * got1).toFixed(1)} mV`);
  }
  check(worst < 0.005, 'engine: one and two octaves down are the divider\'s waveforms\' Fourier components, after the tracking and tone filters', `worst ${(100 * worst).toFixed(3)} %; ${rows.join(', ')}`);
  check(c2 > 0.3, 'and two octaves down has a fundamental of its own, a quarter of the frequency', `${c2.toFixed(4)} of the sine`);
}

// 3. the switch flips where the signal is only the hysteresis from zero: small steps, small aliases.
// A 220 Hz sine one octave down: every harmonic of 110 Hz, and the rest (folded back) measured by
// Parseval over 1 s (110 Hz and the folds both land on 10 Hz bins)
{
  const y = tail(run(W({ dry: 0, oct1: 1, tone: 5000, track: 250 }), steady(220, 0.3, 2)).L);
  const N = y.length, total = y.reduce((s, v) => s + v * v, 0) / N;
  let harm = 0;
  for (let k = 1; k * 110 < fs / 2; k++) {
    let re = 0, im = 0; const w = (2 * Math.PI * k * 110) / fs;
    for (let i = 0; i < N; i++) { re += y[i] * Math.cos(w * i); im += y[i] * Math.sin(w * i); }
    harm += 2 * (re * re + im * im) / (N * N);
  }
  const alias = Math.max(1e-30, total - harm);
  check(db(Math.sqrt(alias / total)) < -60, 'the flips come at the zero crossings, so what folds back above Nyquist is far down', `${db(Math.sqrt(alias / total)).toFixed(1)} dB of the octave's power off its harmonics`);
}

// 4. the hints
{
  const n = steady(110, 0.2, 1), y = run(W({ dry: 1, oct1: 0, oct2: 0 }), n).L;
  check(y.every((v, i) => Math.abs(v - n[i]) < 1e-6), 'Dry: the bass as it came in');
  const A = bassNote(33, 0.8, 2), one = tail(run(W({ dry: 0, oct1: 1 }), A).L, 1.2), o1 = amplitudeAt(one, 27.5, fs), o2 = amplitudeAt(one, 55, fs);
  check(o1 > 2 * o2, 'One octave down: the test bass\'s A (55 Hz) comes out at 27.5 Hz', `${(1e3 * o1).toFixed(1)} mV at 27.5 Hz, ${(1e3 * o2).toFixed(1)} mV at 55 Hz`);
  const A2 = bassNote(45, 0.8, 2), two = tail(run(W({ dry: 0, oct1: 0, oct2: 1 }), A2).L, 1.2);
  const lo = amplitudeAt(two, 27.5, fs), mid = amplitudeAt(two, 55, fs);
  check(lo > mid, 'Two octaves down: an A at the 12th fret (110 Hz) comes out at 27.5 Hz', `${(1e3 * lo).toFixed(1)} mV at 27.5 Hz, ${(1e3 * mid).toFixed(1)} mV at 55 Hz`);
  const E = steady(41.2, 0.3, 3), eTwo = tail(run(W({ dry: 0, oct1: 0, oct2: 1 }), E).L, 2);
  check(amplitudeAt(eTwo, 10.3, fs) > 3 * amplitudeAt(eTwo, 41.2, fs), 'and on a low E, 10 Hz', `${(1e3 * amplitudeAt(eTwo, 10.3, fs)).toFixed(1)} mV at 10.3 Hz`);
  // Tracking filter: lower cleans up the low strings but loses high notes; higher warbles on a strong second harmonic
  const high = (track) => amplitudeAt(tail(run(W({ dry: 0, oct1: 1, track }), steady(400, 0.1)).L), 200, fs);
  check(high(60) < 0.2 * high(1000), 'Tracking filter: lower, and high notes come out weaker, lost in its roll-off', `a 400 Hz note's octave: ${(1e3 * high(60)).toFixed(1)} mV at 60 Hz, ${(1e3 * high(1000)).toFixed(1)} mV at 1 kHz`);
  const rich = Float32Array.from({ length: 2 * fs }, (_, i) => 0.2 * Math.sin((2 * Math.PI * 82.4 * i) / fs) + 0.18 * Math.sin((4 * Math.PI * 82.4 * i) / fs));
  const rate = (track) => { const m = run(W({ dry: 0, oct1: 1, track, hyst: 0.5e-3 }), rich).ms.slice(-50).map((q) => q.f); return m.reduce((s, v) => s + v, 0) / m.length; };
  const clean = rate(60), warble = rate(1000);
  check(Math.abs(clean / 82.4 - 1) < 0.01 && warble > 1.5 * 82.4, 'and higher lets a strong second harmonic flip the comparator twice a cycle: the octave warbles', `the comparator at ${clean.toFixed(1)} Hz with 60 Hz, ${warble.toFixed(1)} Hz with 1 kHz, on an 82.4 Hz note with a strong second harmonic`);
  // Hysteresis: a note below it stops the dividers, and the octave path passes it at its own pitch
  const quiet = tail(run(W({ dry: 0, oct1: 1, hyst: 20e-3 }), steady(110, 0.01)).L), m = run(W({ dry: 0, oct1: 1, hyst: 20e-3 }), steady(110, 0.01)).ms.at(-1);
  check(m.f === 0 && amplitudeAt(quiet, 55, fs) < 1e-6 && amplitudeAt(quiet, 110, fs) > 1e-3, 'Hysteresis: a note that never swings past it stops the dividers, and the octave path passes it at its own pitch', `${(1e3 * amplitudeAt(quiet, 110, fs)).toFixed(2)} mV at 110 Hz, nothing at 55 Hz`);
  const flips = (h) => run(W({ dry: 0, oct1: 1, hyst: h, track: 1000 }), Float32Array.from(steady(82.4, 0.2), (v, i) => v + 2e-3 * Math.sin(i * 1.7) * Math.sin(i * 0.31))).ms.slice(-50).map((q) => q.f);
  const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  check(Math.abs(avg(flips(10e-3)) / 82.4 - 1) < 0.01, 'and more of it ignores the hiss on a note', `${avg(flips(10e-3)).toFixed(1)} Hz on an 82.4 Hz note with 2 mV of high hiss at 10 mV, ${avg(flips(0.5e-3)).toFixed(1)} Hz at 0.5 mV`);
  const toneTop = (tone) => { const y = tail(run(W({ dry: 0, oct1: 1, tone }), steady(110, 0.3)).L); return amplitudeAt(y, 1045, fs) / amplitudeAt(y, 55, fs); };
  check(toneTop(150) < 0.2 * toneTop(5000), 'Tone: lower, a rounder octave with less of its edge', `the 19th harmonic of 55 Hz against the fundamental: ${db(toneTop(5000)).toFixed(1)} dB at 5 kHz, ${db(toneTop(150)).toFixed(1)} dB at 150 Hz`);
  const l6 = peak(run(W({ level: 6 }), steady(110, 0.1, 0.5)).L) / peak(run(W({}), steady(110, 0.1, 0.5)).L);
  check(Math.abs(l6 - 10 ** 0.3) < 1e-3, 'Level: +6 dB doubles the output', `× ${l6.toFixed(4)}`);
}

// the default tracks every open string and the 12th fret of the E string on the test bass: the
// comparator rises once a cycle, at the note's own frequency, while the note sounds
{
  const rows = [];
  let worst = 1;
  for (const midi of [28, 33, 38, 43, 40]) {
    const f0 = 440 * 2 ** ((midi - 69) / 12), ms = run(D, bassNote(midi, 0.8, 2)).ms.filter((m) => m.f > 0);
    const share = ms.filter((m) => Math.abs(m.f / f0 - 1) < 0.03).length / ms.length;
    worst = Math.min(worst, share); rows.push(`${f0.toFixed(1)} Hz ${(100 * share).toFixed(0)} %`);
  }
  check(worst > 0.95, 'the default 70 Hz tracking filter follows the test bass: the comparator rises once a cycle on every open string and the E string\'s 12th fret', rows.join(', '));
}

// 5. hygiene
{
  const r = run(D, new Float32Array(fs));
  check(peak(r.L) === 0, 'silence in, silence out');
  const e = new Effect(fs);
  e.setParams(D);
  const bad = new Float32Array(128); bad[5] = NaN;
  const L = new Float32Array(4096), R = new Float32Array(4096);
  const ok = e.process(bad, L.subarray(0, 128), R.subarray(0, 128));
  e.process(sine(100, fs, 4096, 0.1), L, R);
  check(!ok && L.every(Number.isFinite) && peak(L) > 0.01, 'a NaN in comes out as a silent block, and the pedal recovers');
  e.destroy();
  check(r.latency === 0 && r.R.every((v, i) => v === r.L[i]), 'no latency, mono out on both sides');
  const ids = new Map(PEDAL.groups.flatMap((g) => g.params).map((p) => [p.id, p]));
  const badP = Object.entries(PEDAL.presets).flatMap(([n, v]) => Object.entries(v).filter(([id, val]) => !ids.has(id) || (typeof val === 'number' && (val < ids.get(id).min || val > ids.get(id).max))).map(([id]) => `${n}: ${id}`));
  check(!badP.length, 'every preset sets real parameters inside their ranges', badP.join(', '));
}

// 6. CPU
if (!CI) {
  const quiet = (pre) => {
    const e = new Effect(fs); e.setParams(D);
    const L = new Float32Array(fs), R = new Float32Array(fs);
    if (pre) { e.process(sine(41.2, fs, fs, 0.3), L, R); for (let k = 0; k < 30; k++) e.process(new Float32Array(fs), L, R); }
    const t0 = performance.now(); for (let k = 0; k < 4; k++) e.process(new Float32Array(fs), L, R); const ms = performance.now() - t0;
    e.destroy(); return ms / 4;
  };
  const rest = Math.min(quiet(false), quiet(false)), after = Math.min(quiet(true), quiet(true));
  check(after < 2 * rest + 1, 'CPU: the silence after a note costs what silence from rest does (no denormals)', `${after.toFixed(1)} ms a second after a note, ${rest.toFixed(1)} ms from rest`);
  const n = 10 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 55 * i) / fs) * Math.exp(-(i % fs) / (0.3 * fs)));
  const e = new Effect(fs); e.setParams(preset('Sub synth'));
  const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
  e.process(inp, L, R);
  const share = (performance.now() - t0) / 1000 / 10;
  e.destroy();
  check(share < 0.01, 'CPU: under 1 % of a core (WebAssembly)', `${(100 * share).toFixed(2)} %`);
}

done();
