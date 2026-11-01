// octave-circuit.mjs — the Octave Down's physics written here, independently of the C++: the
// divider's ideal waveforms for a steady sine, and their Fourier coefficients by Simpson's rule;
// the RC sections' analog responses and their bilinear images.

// the octave paths for a sine of amplitude a (after the tracking filter), as functions of its
// phase θ: the comparator rises where a·sin θ passes +h, at θ₀ = asin(h/a); flip-flop 1 toggles
// there every cycle, flip-flop 2 every other. Over 8π (four cycles):
export function paths(a, h) {
  const t0 = Math.asin(Math.min(1, h / a));
  const k = (th) => Math.floor((th - t0) / (2 * Math.PI)); // rises passed since θ₀ (θ₀ itself the first)
  const q1 = (th) => (((k(th) % 2) + 2) % 2 ? 1 : -1);
  const q2 = (th) => (((Math.floor(k(th) / 2) % 2) + 2) % 2 ? 1 : -1);
  return { one: (th) => a * Math.sin(th) * q1(th), two: (th) => a * Math.sin(th) * q2(th) };
}
// the amplitude of a 2π·P-periodic function's component at the fraction r of θ's frequency
// (r = 1/2 for one octave down), by Simpson's rule over its period P·2π
export function component(fn, r, periods, n = 20000) {
  const T = 2 * Math.PI * periods, h = T / n;
  let c = 0, s = 0;
  for (let i = 0; i <= n; i++) {
    const th = i * h, w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2, y = fn(th);
    c += w * y * Math.cos(r * th); s += w * y * Math.sin(r * th);
  }
  return ((2 / T) * (h / 3)) * Math.hypot(c, s);
}
// h → 0: one octave down's fundamental is 8/(3π) of the sine's amplitude
export const SMALL_H = 8 / (3 * Math.PI);

// an RC low-pass at fc, and its image under the bilinear transform at fs (unwarped): |H| at f
export const rc = (fc, f) => 1 / Math.hypot(1, f / fc);
export const rcBilinear = (fc, f, fs) => rc(fc, (fs / Math.PI) * Math.tan((Math.PI * f) / fs));
