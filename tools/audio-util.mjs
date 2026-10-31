// audio-util.mjs — what the tests and tools measure with.

// |X(f)| of a block by a single-bin DFT with a Hann window (exact at any frequency, no FFT size).
export function amplitudeAt(x, f, fs) {
  const n = x.length, w = 2 * Math.PI * f / fs;
  let re = 0, im = 0, wsum = 0;
  for (let i = 0; i < n; i++) {
    const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    re += h * x[i] * Math.cos(w * i);
    im -= h * x[i] * Math.sin(w * i);
    wsum += h;
  }
  return (2 * Math.hypot(re, im)) / wsum;
}
export const db = (x) => 20 * Math.log10(x);
export const peak = (x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
export const rms = (x) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);
export function sine(f, fs, n, a = 0.1) {
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = a * Math.sin((2 * Math.PI * f * i) / fs);
  return x;
}
// Write a mono 16-bit WAV.
export function wav(x, fs) {
  const n = x.length, b = Buffer.alloc(44 + 2 * n);
  b.write('RIFF', 0); b.writeUInt32LE(36 + 2 * n, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(fs, 24);
  b.writeUInt32LE(2 * fs, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(2 * n, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * 32767))), 44 + 2 * i);
  return b;
}
// The pitch of a block by autocorrelation with parabolic interpolation (for the tests' tuning
// checks; the page's tuner uses the same method).
export function pitch(x, fs, fmin = 30, fmax = 500) {
  const lo = Math.floor(fs / fmax), hi = Math.ceil(fs / fmin), n = x.length - hi;
  let best = -1, bestR = -Infinity;
  const r = new Float64Array(hi + 2);
  for (let lag = lo; lag <= hi + 1; lag++) {
    let s = 0, e0 = 0, e1 = 0;
    for (let i = 0; i < n; i++) { s += x[i] * x[i + lag]; e0 += x[i] * x[i]; e1 += x[i + lag] * x[i + lag]; }
    r[lag] = s / Math.sqrt(e0 * e1 + 1e-30);
  }
  // the first strong peak (not the largest, which may be an octave down)
  const top = Math.max(...r.slice(lo, hi + 1));
  for (let lag = lo + 1; lag <= hi; lag++) if (r[lag] > 0.9 * top && r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1]) { best = lag; bestR = r[lag]; break; }
  if (best < 0) return 0;
  const a = r[best - 1], b = bestR, c = r[best + 1], d = (a - c) / (2 * (a - 2 * b + c));
  return fs / (best + d);
}
