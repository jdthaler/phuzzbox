// michelson-circuit.mjs — the Michelson Interferometer's physics worked out here independently of
// the C++: the light on the detector by integrating each source's spectrum numerically,
//
//   I(OPD) = ∫ S(k) (1 + cos k·OPD) dk / (2 ∫ S(k) dk),
//
// with S(k) a sum of Gaussian lines in wavenumber (no closed form for the visibility used); the
// mirror's travel from its equation of motion as a complex response; Bessel functions by their
// integral, J_n(β) = (1/π) ∫₀^π cos(nτ − β sin τ) dτ, for what a sine on the mirror makes
// (Jacobi–Anger: cos(φ + β sin ωt) = Σ J_n(β) cos(φ + nωt)).

// the sources' lines: wavelength (m), weight, FWHM (m). The sodium D lines are NIST's.
export const LINES = {
  hene: [[632.8e-9, 1, 0.002e-9]],
  green: [[532e-9, 1, 0.1e-9]],
  violet: [[405e-9, 1, 1e-9]],
  sodium: [[588.995e-9, 2, 0.005e-9], [589.592e-9, 1, 0.005e-9]],
  white: [[450e-9, 0.4, 20e-9], [565e-9, 1, 110e-9]],
};
export const CENTRE = { hene: 632.8e-9, green: 532e-9, violet: 405e-9, sodium: 589.3e-9, white: 560e-9 };
export const MOUNTS = { piezo: { f0: 20000, Q: 8 }, speaker: { f0: 80, Q: 0.8 } };
export const FULL_SCALE = 1; // V, dark to bright

// the light on the detector at path difference opd, 0–1: each line's spectrum, a Gaussian in
// wavenumber of FWHM Δk = 2π Δλ / λ², summed over ±8 standard deviations by Simpson's rule, in
// steps fine enough that the cosine turns by under 0.2 rad each
export function intensity(light, opd) {
  let num = 0, den = 0;
  for (const [lambda, weight, width] of LINES[light]) {
    const k0 = (2 * Math.PI) / lambda, dk = (2 * Math.PI * width) / (lambda * lambda), sd = dk / (2 * Math.sqrt(2 * Math.LN2));
    const steps = 2 * Math.ceil(Math.max(200, (16 * sd * Math.abs(opd)) / 0.4)), a = k0 - 8 * sd, h = (16 * sd) / steps;
    let s = 0, n = 0;
    for (let i = 0; i <= steps; i++) {
      const k = a + i * h, c = i === 0 || i === steps ? 1 : i % 2 ? 4 : 2, S = Math.exp(-((k - k0) ** 2) / (2 * sd * sd));
      s += c * S * (1 + Math.cos(k * opd));
      n += c * S;
    }
    num += weight * s / n; den += weight;
  }
  return num / (2 * den);
}
// the fringes' contrast near opd: (max − min)/(max + min) of the light over the centre wavelength
// around it (for a broad source, whose envelope changes within a wavelength, only roughly)
export function contrast(light, opd, samples = 256) {
  const l0 = CENTRE[light];
  opd -= l0 / 2;
  let mx = -Infinity, mn = Infinity;
  for (let i = 0; i < samples; i++) { const v = intensity(light, opd + (l0 * i) / samples); mx = Math.max(mx, v); mn = Math.min(mn, v); }
  return (mx - mn) / (mx + mn);
}
// the paths' difference at rest: the micrometer to the nearest whole centre wavelength, plus the
// Fringe knob's fraction of one
export const rest = (P) => Math.round((2 * P.arm) / CENTRE[P.light]) * CENTRE[P.light] + (P.fringe / 360) * CENTRE[P.light];

// the mirror's travel per volt at f, from m x'' + c x' + k x = k s v
export function mount(P, f) {
  const { f0, Q } = MOUNTS[P.mount], w0 = 2 * Math.PI * f0, w = 2 * Math.PI * f;
  const re = w0 * w0 - w * w, im = (w * w0) / Q, m = re * re + im * im;
  return { re: (P.stroke * w0 * w0 * re) / m, im: (-P.stroke * w0 * w0 * im) / m, abs: (P.stroke * w0 * w0) / Math.sqrt(m) };
}
// the detector's coupling capacitor: a 5 Hz high-pass
export const coupling = (f) => f / Math.hypot(f, 5);

// Bessel's J_n(β), by its integral (Simpson's rule)
export function besselJ(n, b, steps = 2000) {
  let s = 0;
  const h = Math.PI / steps;
  for (let i = 0; i <= steps; i++) {
    const t = i * h, c = i === 0 || i === steps ? 1 : i % 2 ? 4 : 2;
    s += c * Math.cos(n * t - b * Math.sin(t));
  }
  return (s * h) / 3 / Math.PI;
}
