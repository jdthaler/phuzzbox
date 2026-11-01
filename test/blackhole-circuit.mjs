// blackhole-circuit.mjs — the Black Hole's physics written out independently of the C++
// (native/pedals/blackhole): the modes solved afresh by Leaver's continued fractions
// (test/blackhole-leaver.mjs, Forte's solver), the literature's values, Hod's near-extremal limit,
// the spin-weighted harmonics in closed form, and the merger's amplitude fits.

import { trackQNM } from './blackhole-leaver.mjs';

export const MSUN_S = 4.925490947e-6;
export { trackQNM };

// Leaver's Schwarzschild values (M = 1), and Kerr (2,2,0) at a = 0.9 (Berti, Cardoso & Will)
export const LITERATURE = [
  { l: 2, m: 2, a: 0, re: 0.373672, im: -0.088962 },
  { l: 3, m: 3, a: 0, re: 0.599443, im: -0.092703 },
  { l: 4, m: 4, a: 0, re: 0.809178, im: -0.094164 },
  { l: 2, m: 1, a: 0, re: 0.373672, im: -0.088962 },
  { l: 2, m: 2, a: 0.9, re: 0.671613, im: -0.064869 },
];

// Hod (2008): as a → 1 the l = m modes go to ω → mΩ_H − 2πi T_H (n + ½), with
// Ω_H = a / (r₊² + a²), T_H = √(1 − a²) / 4π r₊, r₊ = 1 + √(1 − a²) (M = 1)
export function hod(m, a, n = 0) {
  const rp = 1 + Math.sqrt(1 - a * a), OmegaH = a / (rp * rp + a * a), TH = Math.sqrt(1 - a * a) / (4 * Math.PI * rp);
  return { re: m * OmegaH, im: -2 * Math.PI * TH * (n + 0.5) };
}

// ₋₂Y_2,±2(θ) = √(5/64π) (1 ± cos θ)²
export const y22 = (theta) => Math.sqrt(5 / (64 * Math.PI)) * (1 + Math.cos(theta)) ** 2;
export const y2m2 = (theta) => Math.sqrt(5 / (64 * Math.PI)) * (1 - Math.cos(theta)) ** 2;

// Gossan, Veitch & Sathyaprakash's Eqs. 5–8, relative to A₂₂
export function amplitudes(q) {
  const nu = q / (1 + q) ** 2, d = Math.max(0, 1 - 4 * nu);
  return { a21: 0.52 * d ** 0.71, a33: 0.44 * d ** 0.45, a44: 5.4 * (nu - 0.22) ** 2 + 0.04 };
}
