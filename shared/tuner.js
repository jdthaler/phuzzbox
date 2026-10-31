// tuner.js — the pitch of the input, for the page's tuner. Two steps:
//
// 1. detectPitch: the period, by normalised autocorrelation with parabolic interpolation over a
//    bass's range (30–500 Hz; the method the tests use, tools/audio-util.mjs). It finds the
//    period of the whole waveform, so it is right about the note even when the fundamental is weak.
// 2. refine: the fundamental's own frequency, the peak of a Hann-windowed Fourier transform near
//    that estimate. A real string is stiff: its partials run sharp, f_n = n f₁ √(1 + Bn²), and
//    the waveform's period is a compromise among them, a few cents sharp of f₁ on a low E. A
//    tuner should read f₁, the pitch the string is tuned by, so the peak search reads it directly.
//
// tune() puts them together, on the part of the block since the note began; Tuner smooths its readings for a steady needle.

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
// the open strings of four-, five- and six-string basses: B0 E1 A1 D2 G2 C3
export const OPEN_STRINGS = [23, 28, 33, 38, 43, 48];

export function detectPitch(x, fs, fmin = 30, fmax = 500) {
  const lo = Math.floor(fs / fmax), hi = Math.ceil(fs / fmin), n = x.length - hi - 1;
  if (n < hi) return 0;
  let e = 0;
  for (let i = 0; i < n; i++) e += x[i] * x[i];
  if (e / n < 1e-7) return 0; // too quiet to trust
  const r = new Float32Array(hi + 2);
  let top = 0;
  for (let lag = lo; lag <= hi + 1; lag++) {
    let s = 0, e1 = 0;
    for (let i = 0; i < n; i++) { s += x[i] * x[i + lag]; e1 += x[i + lag] * x[i + lag]; }
    r[lag] = s / Math.sqrt(e * e1 + 1e-30);
    if (lag <= hi && r[lag] > top) top = r[lag];
  }
  if (top < 0.6) return 0;
  for (let lag = lo + 1; lag <= hi; lag++) {
    if (r[lag] > 0.9 * top && r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1]) {
      const a = r[lag - 1], b = r[lag], c = r[lag + 1], d = (a - c) / (2 * (a - 2 * b + c));
      return fs / (lag + d);
    }
  }
  return 0;
}

const hann = new Map();
function window(N) {
  if (!hann.has(N)) { const w = new Float64Array(N); for (let i = 0; i < N; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)); hann.set(N, w); }
  return hann.get(N);
}
// |X(f)|² of the Hann-windowed block, by a rotating phasor
function power(x, w, f, fs) {
  const c = Math.cos((2 * Math.PI * f) / fs), s = Math.sin((2 * Math.PI * f) / fs);
  let pr = 1, pi = 0, re = 0, im = 0;
  for (let i = 0; i < x.length; i++) {
    const y = x[i] * w[i];
    re += y * pr; im -= y * pi;
    const t = pr * c - pi * s; pi = pr * s + pi * c; pr = t;
  }
  return re * re + im * im;
}
// The strongest frequency within ±span of f: a grid, two finer grids, then a parabola through
// the log powers (exact for a Gaussian peak, and within a hundredth of a cent for Hann's).
export function refine(x, fs, f, span = 0.03) {
  const w = window(x.length);
  let c = f, step = (f * span) / 10;
  for (let pass = 0; pass < 3; pass++) {
    let best = c, bp = -1;
    for (let k = -10; k <= 10; k++) { const g = c + k * step, p = power(x, w, g, fs); if (p > bp) { bp = p; best = g; } }
    c = best;
    if (pass < 2) step /= 8;
  }
  const a = Math.log(power(x, w, c - step, fs) + 1e-300), b = Math.log(power(x, w, c, fs) + 1e-300), d = Math.log(power(x, w, c + step, fs) + 1e-300);
  const den = a - 2 * b + d;
  return den < 0 ? c + (step * (a - d)) / (2 * den) : c;
}

// The fundamental of a block: the period for the note, then the fundamental's own peak. The
// period needs only to land within the peak search's ±3 %, so it is found on the newest `coarse`
// samples averaged down to about 12 kHz (a bass's fundamentals are below 500 Hz), sixteen times
// less work than at full rate; the peak search uses every sample.
export function tune(x, fs, { coarse = 8192 } = {}) {
  const D = Math.max(1, Math.floor(fs / 12000)), src = x.length > coarse ? x.subarray(x.length - coarse) : x;
  const y = new Float32Array(Math.floor(src.length / D));
  for (let i = 0; i < y.length; i++) { let s = 0; for (let j = 0; j < D; j++) s += src[i * D + j]; y[i] = s / D; }
  const f = detectPitch(y, fs / D), part = f ? sounding(x, fs) : null;
  return part ? refine(part, fs, f) : 0;
}
// The part of a block since the note began: a block that starts in the silence before a pluck
// puts a step in the window, and the step's spectrum pulls the peak by tens of cents. The part
// kept starts 5 ms after the first sample above a tenth of the block's peak (past the pick's
// scrape); when that leaves under half the block, the note is too new to read, and it waits.
function sounding(x, fs) {
  let top = 0;
  for (let i = 0; i < x.length; i++) top = Math.max(top, Math.abs(x[i]));
  let i0 = 0;
  while (i0 < x.length && Math.abs(x[i0]) < 0.1 * top) i0++;
  if (i0 === 0) return x;
  const start = i0 + Math.round(0.005 * fs);
  return x.length - start >= x.length / 2 ? x.subarray(start) : null;
}

export function noteOf(f, a4 = 440) {
  const m = 69 + 12 * Math.log2(f / a4), k = Math.round(m);
  return { name: `${NAMES[((k % 12) + 12) % 12]}${Math.floor(k / 12) - 1}`, letter: NAMES[((k % 12) + 12) % 12], octave: Math.floor(k / 12) - 1, cents: 100 * (m - k), key: k, target: a4 * 2 ** ((k - 69) / 12) };
}

// Readings smoothed for the needle: the median of the last three (a stray octave or a pluck's
// first scrape is outvoted), then an exponential average of the cents while the note holds.
// A note is held on screen for `hold` seconds after the signal goes, dimmed.
export class Tuner {
  constructor({ a4 = 440, hold = 1.5 } = {}) { this.a4 = a4; this.hold = hold; this.recent = []; this.shown = null; this.lastAt = -Infinity; }
  push(f, t) {
    if (f > 0) this.recent.push(f); else this.recent.length = 0;
    if (this.recent.length > 3) this.recent.shift();
    if (this.recent.length) {
      const m = [...this.recent].sort((a, b) => a - b)[this.recent.length >> 1];
      const n = noteOf(m, this.a4);
      if (this.shown && this.shown.key === n.key) this.shown = { ...n, f: m, cents: this.shown.cents + 0.4 * (n.cents - this.shown.cents), live: true };
      else this.shown = { ...n, f: m, live: true };
      this.lastAt = t;
    } else if (this.shown && t - this.lastAt > this.hold) this.shown = null;
    else if (this.shown) this.shown = { ...this.shown, live: false };
    return this.shown;
  }
}
