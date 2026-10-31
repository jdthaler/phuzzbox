// tuner.js — the pitch of the input, for the page's tuner: autocorrelation with parabolic
// interpolation over a bass's range (30–500 Hz), the method the tests use (tools/audio-util.mjs).

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

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

export function noteOf(f, a4 = 440) {
  const m = 69 + 12 * Math.log2(f / a4), k = Math.round(m);
  return { name: `${NAMES[((k % 12) + 12) % 12]}${Math.floor(k / 12) - 1}`, cents: 100 * (m - k), key: k };
}
