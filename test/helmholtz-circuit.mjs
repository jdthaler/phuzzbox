// helmholtz-circuit.mjs — Helmholtz's resonators worked out independently of the C++, for the tests:
// each one's pitch straight from Helmholtz's own formula, n = 47000 σ^¼/√S (σ in mm², S in mm³), at
// his 332.26 m/s scaled to the air's speed; its radiation's Q as a monopole's, 4π/(k³V) (the power a
// small source radiates against the energy it stores); the walls' Q from Kirchhoff's viscous
// attenuation, k/(2α) of the neck's share of the mass; and the resonator as a driven oscillator.

// Ellis's translation, Appendix II: the sphere's and the orifice's diameters (mm), the volume (cm³)
export const GLASS = [
  [154, 35.5, 1773], [131, 28.5, 1092], [130, 30.2, 1053], [115, 30, 546], [79, 18.5, 235],
  [76, 22, 214], [70, 20.5, 162], [53.5, 8, 74], [46, 15, 49], [43, 15, 37],
];
export const air = (Tc) => { const T = Tc + 273.15; return { c: 343.2 * Math.sqrt(T / 293.15), rho: (1.2041 * 293.15) / T, mu: 1.8205e-5 }; };

// the stock opening: Helmholtz's formula with his measured coefficient
export function pitch([, d, V], Tc = 20) {
  const sigma = Math.PI * (d / 2) ** 2, S = V * 1000;
  return ((47000 * sigma ** 0.25) / Math.sqrt(S)) * (air(Tc).c / 332.26);
}
// the neck's length over its radius that gives it, with δ = 0.85 r at each end
export const NECK = Math.PI / (2 * (47000 / 56174) ** 2) - 1.7;

// a resonator with its opening scaled: f0, Q (and its two shares)
export function resonator(g, scale = 1, Tc = 20) {
  const { c, rho, mu } = air(Tc), r0 = g[1] / 2000, r = r0 * scale, V = g[2] * 1e-6, l = NECK * r0;
  const mass = l + 1.7 * r, Sn = Math.PI * r * r;
  const f0 = (c / (2 * Math.PI)) * Math.sqrt(Sn / (mass * V)), k = (2 * Math.PI * f0) / c;
  const Qrad = (4 * Math.PI) / (k ** 3 * V);
  const alpha = Math.sqrt((Math.PI * f0 * mu) / rho) / (r * c);
  const Qvisc = (k / (2 * alpha)) * (mass / l); // the walls drag on the neck, the whole moving column's inertia stores the energy
  return { f0, Qrad, Qvisc, Q: 1 / (1 / Qrad + 1 / Qvisc) };
}
// the driven oscillator: the pressure inside for a pascal outside, [re, im], e^(−iωt)
export function response(o, f) {
  const w = f / o.f0, a = 1 - w * w, b = -w / o.Q, d = a * a + b * b;
  return [a / d, -b / d];
}
