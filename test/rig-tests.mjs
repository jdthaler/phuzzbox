// rig-tests.mjs — the rig's units (shared/rig.js) against what is independent of them: each
// section's analog original evaluated at s = jΩ with the bilinear transform's frequency warping
// (Ω = tan(ωT/2) / tan(ω₀T/2), exact for a transform prewarped at ω₀); the notch's −3 dB width in
// closed form; the gate's and the compressor's time constants as exponentials; the compressor's
// static curve (out = T + (in − T)/ratio, in dB). Then the engine against them, with sines and
// steps through Rig.process. Each hint's claim is checked.

import { check, done } from './harness.mjs';
import { Rig, RIG_UNITS, RIG_PARAMS, rigDefaults, rigValues, section, response, ANALOG, Cx, EQ, GATE } from '../shared/rig.js';
import { readFileSync } from 'node:fs';

const fs = 48000;
const dB = (x) => 20 * Math.log10(x);
const hint = (id) => RIG_PARAMS.find((p) => p.id === id).hint;
const run = (R, x) => { const r = new Rig(fs); r.set({ ...rigDefaults(), ...R }); const v = Float32Array.from(x); for (let i = 0; i < v.length; i += 128) r.process(v.subarray(i, i + 128), Math.min(128, v.length - i)); return v; };
const sine = (f, a, seconds) => Float32Array.from({ length: Math.round(seconds * fs) }, (_, i) => a * Math.sin((2 * Math.PI * f * i) / fs));
const peak = (x, from = 0, to = x.length) => { let p = 0; for (let i = from; i < to; i++) p = Math.max(p, Math.abs(x[i])); return p; };
const rms = (x, from = 0, to = x.length) => { let s = 0; for (let i = from; i < to; i++) s += x[i] * x[i]; return Math.sqrt(s / (to - from)); };
const ALL_OFF = { gainOn: false, humOn: false, gateOn: false, eqOn: false, compOn: false };

// ---- the descriptor
{
  const ids = RIG_PARAMS.map((p) => p.id);
  check(new Set(ids).size === ids.length, 'every rig parameter has its own id');
  check(RIG_UNITS.every((u) => u.params.some((p) => p.id === u.on && p.type === 'checkbox')), 'every unit has its switch');
  check(RIG_PARAMS.filter((p) => !p.type).every((p) => p.min < p.max && p.def >= p.min && p.def <= p.max && p.unit !== undefined), 'every knob has a range, its default in it, and a unit');
  check(RIG_PARAMS.filter((p) => p.type !== 'checkbox').every((p) => p.hint && p.hint.length > 30), 'every control says what it does to the sound');
  const v = rigValues({ gain: 99, mains: 'x', eqOn: 'yes', bass: -3 });
  check(v.gain === 24 && v.mains === '60' && v.eqOn === false && v.bass === -3, 'saved values are clamped to their ranges, and nonsense gives the default');
}

// ---- off, and at its defaults, the rig is a wire
{
  const x = sine(110, 0.3, 0.2);
  const y0 = run(ALL_OFF, x), y1 = run({}, x);
  check(y0.every((s, i) => s === x[i]) && y1.every((s, i) => s === x[i]), 'every unit off, and at the defaults (Gain at 0 dB), the rig leaves the signal untouched');
  const y2 = run({ eqOn: true, compOn: false }, x);
  check(Math.max(...y2.map((s, i) => Math.abs(s - x[i]))) < 1e-6, 'the EQ at 0 dB everywhere is flat');
}

// ---- Gain: an ideal amplifier
{
  const x = sine(220, 0.1, 0.1);
  const g = dB(peak(run({ gain: 6 }, x)) / peak(x)), g2 = dB(peak(run({ gain: -12 }, x)) / peak(x));
  check(Math.abs(g - 6) < 1e-3 && Math.abs(g2 + 12) < 1e-3, 'Gain: 6 dB is twice the volts, −12 dB a quarter', `${g.toFixed(4)} dB, ${g2.toFixed(4)} dB`);
  check(/6 dB is twice the volts/.test(hint('gain')) && Math.abs(10 ** (6 / 20) - 2) < 0.01, 'Gain\'s hint: 6 dB is twice the volts (10^(6/20) = 1.995)');
}

// ---- each section against its analog original
{
  let worst = 0;
  for (const [kind, f0, gain, Q] of [['peak', 500, 9, EQ.midQ], ['peak', 2500, -12, EQ.midQ], ['lowShelf', 80, 12, EQ.shelfQ], ['lowShelf', 80, -9, EQ.shelfQ], ['highShelf', 4000, 6, EQ.shelfQ], ['highShelf', 4000, -15, EQ.shelfQ], ['notch', 60, 0, 30]]) {
    const k = section(kind, f0, fs, gain, Q), A = 10 ** (gain / 40), w0 = Math.tan((Math.PI * f0) / fs);
    for (const f of [5, 20, 41, 60, 80, 120, 300, 1000, 3000, 8000, 15000]) {
      const W = Math.tan((Math.PI * f) / fs) / w0;
      const a = ANALOG[kind](new Cx(0, W), A, Q).abs(), d = response(k, f, fs).abs();
      worst = Math.max(worst, Math.abs(a - d) / Math.max(a, 1));
    }
  }
  check(worst < 1e-9, 'every section is its analog original under the bilinear transform prewarped at its frequency', `worst error ${worst.toExponential(1)} of the gain or of 1`);
  // the originals themselves: what a shelf and a bell do at the ends and the middle
  const lo = ANALOG.lowShelf, hi = ANALOG.highShelf, pk = ANALOG.peak, A = 10 ** (12 / 40);
  const at = (H, W) => dB(H(new Cx(0, W), A, Math.SQRT1_2).abs());
  check(Math.abs(at(lo, 1e-4) - 12) < 1e-3 && Math.abs(at(lo, 1e4)) < 1e-3 && Math.abs(at(lo, 1) - 6) < 1e-6
    && Math.abs(at(hi, 1e4) - 12) < 1e-3 && Math.abs(at(hi, 1e-4)) < 1e-3 && Math.abs(dB(pk(new Cx(0, 1), A, 0.9).abs()) - 12) < 1e-9,
  'the originals: a shelf has its full gain at one end, none at the other and half (in dB) at its corner; a bell has its full gain at its centre');
}

// ---- the EQ through the engine, and its hints
{
  const level = (R, f) => { const x = sine(f, 0.1, 0.5), y = run({ eqOn: true, ...R }, x); return dB(rms(y, fs * 0.25) / rms(x, fs * 0.25)); };
  const b = level({ bass: 12 }, 41.2), b2 = level({ bass: 12 }, 1000);
  check(b > 11 && b2 < 0.2, 'Bass: a shelf below 80 Hz, its full boost reaching the low E (41 Hz) and leaving 1 kHz alone', `${b.toFixed(2)} dB at 41 Hz, ${b2.toFixed(2)} dB at 1 kHz`);
  check(/below 80 Hz/.test(hint('bass')) && /reaches the lowest notes/.test(hint('bass')), 'Bass\'s hint says so');
  const m = level({ mid: 9, midFreq: 800 }, 800), m2 = level({ mid: 9, midFreq: 800 }, 100), m3 = level({ mid: -9, midFreq: 800 }, 800);
  check(Math.abs(m - 9) < 0.1 && m2 < 1.5 && Math.abs(m3 + 9) < 0.1, 'Mid: a bell, its full boost or cut at Mid frequency and little three octaves away', `${m.toFixed(2)}, ${m2.toFixed(2)}, ${m3.toFixed(2)} dB`);
  const t = level({ treble: -12 }, 12000), t2 = level({ treble: -12 }, 200);
  check(t < -10 && Math.abs(t2) < 0.1, 'Treble: a shelf above 4 kHz, cutting 12 kHz nearly fully and leaving 200 Hz alone', `${t.toFixed(2)} dB at 12 kHz, ${t2.toFixed(2)} dB at 200 Hz`);
  check(/above 4 kHz/.test(hint('treble')), 'Treble\'s hint says above 4 kHz');
}

// ---- the hum filter
{
  // the analog notch's −3 dB points are f0 (√(1 + 1/4Q²) ± 1/2Q): their difference is f0/Q, the Width
  const f0 = 60, W = 2, Q = f0 / W;
  const lo = f0 * (Math.sqrt(1 + 1 / (4 * Q * Q)) - 1 / (2 * Q)), hiF = f0 * (Math.sqrt(1 + 1 / (4 * Q * Q)) + 1 / (2 * Q));
  const k = section('notch', f0, fs, 0, Q);
  const g = (f) => response(k, f, fs).abs();
  check(Math.abs(hiF - lo - W) < 1e-9 && Math.abs(g(lo) - Math.SQRT1_2) < 1e-4 && Math.abs(g(hiF) - Math.SQRT1_2) < 1e-4,
    'Width is the notch\'s width between its −3 dB points', `${lo.toFixed(3)}–${hiF.toFixed(3)} Hz: ${dB(g(lo)).toFixed(3)}, ${dB(g(hiF)).toFixed(3)} dB`);
  // through the engine: hum at the first six harmonics is gone, a note between them barely touched
  const hum = (fm, n) => Float32Array.from({ length: 2 * fs }, (_, i) => { let s = 0; for (let h = 1; h <= n; h++) s += (0.01 / h) * Math.sin((2 * Math.PI * h * fm * i) / fs + h); return s; });
  for (const fm of [60, 50]) {
    const x = hum(fm, 6), y = run({ humOn: true, mains: String(fm), harmonics: 6, humWidth: 2 }, x);
    const cut = dB(rms(y, fs) / rms(x, fs)); // after the notches' ringing (τ = 1/(π Width), 0.16 s) has gone
    check(cut < -40, `${fm} Hz mains: its first six harmonics come down by more than 40 dB`, `${cut.toFixed(1)} dB`);
  }
  const note = sine(73.42, 0.2, 1), y = run({ humOn: true, mains: '60', harmonics: 6, humWidth: 2 }, note);
  const kept = dB(rms(y, fs / 2) / rms(note, fs / 2));
  check(kept > -0.5, 'a note between the harmonics (D2, 73 Hz) passes within half a decibel', `${kept.toFixed(2)} dB`);
  const b1 = run({ humOn: true, mains: '60', harmonics: 6, humWidth: 2 }, sine(61.74, 0.2, 1)), b1dB = dB(rms(b1, fs / 2) / (0.2 / Math.SQRT2));
  check(b1dB > -1.5 && b1dB < -1, 'B1 (61.7 Hz), beside the 60 Hz notch, loses about a decibel and a quarter (README)', `${b1dB.toFixed(2)} dB`);
  // more harmonics: a buzz up through the 12th is cut only when they are notched
  const buzz = hum(60, 12), few = run({ humOn: true, harmonics: 3 }, buzz), many = run({ humOn: true, harmonics: 12 }, buzz);
  check(rms(many, fs / 2) < 0.1 * rms(few, fs / 2), 'Harmonics: notching twelve rather than three takes out a buzz that reaches up through many', `${dB(rms(many, fs / 2) / rms(few, fs / 2)).toFixed(1)} dB`);
  check(/60 Hz in North America, 50 Hz in Europe/.test(hint('mains')), 'Mains\' hint names the two mains frequencies');
}

// ---- the gate
{
  const thr = 0.01;
  // a note, then silence but for hiss below half the threshold
  const n = fs, x = new Float32Array(n);
  let seed = 3;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
  for (let i = 0; i < n; i++) x[i] = (i < fs / 4 ? 0.2 * Math.sin((2 * Math.PI * 110 * i) / fs) : 0) + 0.002 * noise();
  const y = run({ gateOn: true, gateThreshold: thr, gateRelease: 0.1 }, x);
  check(Math.abs(peak(y, 2000, fs / 4 - 100) / peak(x, 2000, fs / 4 - 100) - 1) < 0.01, 'the gate passes a note above Threshold untouched');
  check(rms(y, fs * 0.9) < 0.01 * rms(x, fs * 0.9), 'and silences the hiss below half of it once the note has gone', `${dB(rms(y, fs * 0.9) / rms(x, fs * 0.9)).toFixed(1)} dB`);
  // Release: the gain's time constant once the gate closes. A steady tone dropped below half the
  // threshold: the gate closes when the detector (50 ms) falls below it, and the gain decays as e^(−t/τ)
  for (const tau of [0.03, 0.3]) {
    const r = new Rig(fs);
    r.set({ ...rigDefaults(), gateOn: true, gateThreshold: thr, gateRelease: tau });
    const v = new Float32Array(1);
    let closedAt = -1, g1 = null;
    for (let t = 0; t < 3 * fs; t++) {
      v[0] = t < fs / 2 ? 0.1 : 0.003;
      r.process(v, 1);
      if (closedAt < 0 && t > fs / 2 && !r.gateOpen) closedAt = t;
      if (closedAt > 0 && g1 === null && t >= closedAt + tau * fs) g1 = r.gateGain;
    }
    check(closedAt > 0 && Math.abs(g1 - Math.exp(-1)) < 0.03, `Release ${tau * 1000} ms: the gate's gain falls to 1/e (a third) in that long`, `${g1?.toFixed(3)}`);
  }
  check(/half of it/.test(hint('gateThreshold')) && GATE.hysteresis === 0.5 && /falls to a third/.test(hint('gateRelease')), 'the gate\'s hints: it closes below half the threshold, and its level falls to a third in Release');
}

// ---- the compressor
{
  // its static curve: a steady sine over the threshold comes out T + (L − T)/ratio, in dB of peak
  const curve = (L, T, ratio) => (L > T ? T + (L - T) / ratio : L);
  let worst = 0;
  for (const [a, thr, ratio] of [[0.5, 0.1, 4], [0.8, 0.05, 10], [0.2, 0.1, 2], [0.05, 0.1, 4]]) {
    const y = run({ compOn: true, compThreshold: thr, ratio, attack: 0.001, release: 0.5 }, sine(220, a, 1));
    const out = dB(peak(y, fs / 2)), want = curve(dB(a), dB(thr), ratio);
    worst = Math.max(worst, Math.abs(out - want));
  }
  check(worst < 0.2, 'the compressor\'s static curve: a peak L over Threshold T comes out T + (L − T)/ratio', `worst ${worst.toFixed(3)} dB`);
  const thr = 0.1, a = thr * 10 ** (12 / 20), y = run({ compOn: true, compThreshold: thr, ratio: 4, attack: 0.001, release: 0.5 }, sine(220, a, 1));
  const over = dB(peak(y, fs / 2) / thr);
  check(Math.abs(over - 3) < 0.15 && /12 dB over comes out 3 dB over/.test(hint('ratio')), 'Ratio\'s hint: at 4 : 1 a note 12 dB over comes out 3 dB over', `${over.toFixed(2)} dB over`);
  const y1 = run({ compOn: true, compThreshold: 0.1, ratio: 1 }, sine(220, 0.5, 0.3));
  check(Math.abs(dB(peak(y1, fs / 10) / 0.5)) < 1e-3, 'at 1 : 1 it does nothing');
  // Attack: a step over the threshold; the detector charges toward it as 1 − e^(−t/τ)
  for (const tau of [0.001, 0.02]) {
    const r = new Rig(fs);
    r.set({ ...rigDefaults(), compOn: true, compThreshold: 0.01, attack: tau, release: 1 });
    const v = new Float32Array(Math.round(tau * fs)).fill(0.5);
    r.process(v, v.length);
    check(Math.abs(r.compEnv / 0.5 - (1 - Math.exp(-1))) < 0.01, `Attack ${tau * 1000} ms: the detector reaches 63 % of a new note's peak in that long`, `${(100 * r.compEnv / 0.5).toFixed(1)} %`);
  }
  // so a short attack catches the pluck and a long one lets it through
  const pluck = Float32Array.from({ length: fs / 4 }, (_, i) => 0.6 * Math.sin((2 * Math.PI * 98 * i) / fs) * Math.exp(-i / fs / 0.5));
  const first = (attack) => peak(run({ compOn: true, compThreshold: 0.05, ratio: 8, attack, release: 0.2 }, pluck), 0, fs / 50);
  check(first(0.05) > 1.5 * first(0.0005), 'a long Attack lets the pluck through before it squeezes; a short one catches it', `${dB(first(0.05) / first(0.0005)).toFixed(1)} dB more of the first 20 ms`);
  // Release: the detector lets go of a note that stops as e^(−t/τ)
  {
    const r = new Rig(fs);
    r.set({ ...rigDefaults(), compOn: true, compThreshold: 0.01, attack: 1e-4, release: 0.2 });
    const v = new Float32Array(fs / 10).fill(0.5);
    r.process(v, v.length);
    const v2 = new Float32Array(Math.round(0.2 * fs));
    r.process(v2, v2.length);
    check(Math.abs(r.compEnv / 0.5 - Math.exp(-1)) < 0.01, 'Release: the detector lets go to 1/e of the note\'s peak in that long', `${(r.compEnv / 0.5).toFixed(3)}`);
  }
  const mk = run({ compOn: true, compThreshold: 1, makeup: 6 }, sine(220, 0.1, 0.2));
  check(Math.abs(dB(peak(mk) / 0.1) - 6) < 1e-3, 'Makeup turns everything up by its decibels');
}

// ---- the order and the rest
{
  const big = Float32Array.from({ length: 1024 }, () => NaN);
  const r = new Rig(fs); r.set({ ...rigDefaults(), compOn: true, eqOn: true, bass: 6 });
  r.process(big, 1024);
  const v = sine(110, 0.2, 0.02); r.process(v, v.length);
  check(big.every((s) => s === 0) && v.every(Number.isFinite), 'a NaN at the input is silenced and the rig carries on');
  const worklet = readFileSync(new URL('../shared/worklet.js', import.meta.url), 'utf8');
  check(/this\.source === 'bass'\) this\.bass\.process[\s\S]{0,400}this\.rig\.process/.test(worklet), 'the worklet runs the rig on the interface\'s input only, not the test instrument');
}

done();
