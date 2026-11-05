// openair-circuit.mjs — Open Air's field worked out independently of the C++, for the tests: the
// air's absorption written out from ISO 9613-1's equations; Miki's impedance; the Faddeeva function
// w(z) by integrating its differential equation, w′ = −2zw + 2i/√π from w(0) = 1, by Runge–Kutta
// along the ray to z (and by its asymptotic series far out), rather than by the C++'s rational
// approximation and continued fraction; Weyl and van der Pol's reflection; and the two paths summed.
// Complex numbers are [re, im], with e^(−iωt) as the C++'s model has them.

export const GROUNDS = { snow: 21.2, forest: 40.0, grass: 212.1, dirt: 2828.4, asphalt: 0 }; // kPa·s/m²
// Piercy and Embleton's ranges (1982, Fig. 3), whose geometric middles the grounds take
export const RANGES = { snow: [15, 30], forest: [20, 80], grass: [150, 300], dirt: [2000, 4000] };

const add = (a, b) => [a[0] + b[0], a[1] + b[1]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const sc = (a, s) => [a[0] * s, a[1] * s];
const cexp = (a) => [Math.exp(a[0]) * Math.cos(a[1]), Math.exp(a[0]) * Math.sin(a[1])];
const csqrt = (a) => { const r = Math.hypot(a[0], a[1]), t = Math.atan2(a[1], a[0]) / 2; return [Math.sqrt(r) * Math.cos(t), Math.sqrt(r) * Math.sin(t)]; };
export const C = { add, sub, mul, div, sc, cexp, abs: (a) => Math.hypot(a[0], a[1]) };
const SP = Math.sqrt(Math.PI);

// ISO 9613-1 (1993), eqs. (3)–(5) and Annex B: α in dB/m at f (Hz), T (K), relative humidity hr (%),
// pressure pa (kPa)
export function iso(f, T, hr, pa = 101.325) {
  const pr = 101.325, T0 = 293.15, T01 = 273.16;
  const C1 = -6.8346 * (T01 / T) ** 1.261 + 4.6151;
  const h = (hr * 10 ** C1) / (pa / pr);
  const frO = (pa / pr) * (24 + (4.04e4 * h * (0.02 + h)) / (0.391 + h));
  const frN = (pa / pr) * (T / T0) ** -0.5 * (9 + 280 * h * Math.exp(-4.17 * ((T / T0) ** (-1 / 3) - 1)));
  return 8.686 * f * f * (1.84e-11 * (pa / pr) ** -1 * (T / T0) ** 0.5 + (T / T0) ** -2.5 * (0.01275 * Math.exp(-2239.1 / T) / (frO + (f * f) / frO) + 0.1068 * Math.exp(-3352 / T) / (frN + (f * f) / frN)));
}
export const speed = (T) => 343.2 * Math.sqrt(T / 293.15);

// Miki (1990): Z/ρc = 1 + 9.08 (f/σ)^−0.75 + i 11.9 (f/σ)^−0.73, σ in kPa·s/m² (e^(−iωt))
export const miki = (f, sigma) => [1 + 9.08 * (f / sigma) ** -0.75, 11.9 * (f / sigma) ** -0.73];

// w(z) = e^(−z²) erfc(−iz)
export function faddeeva(z) {
  const r = Math.hypot(z[0], z[1]);
  if (r > 25 && z[1] >= 0) { // i/(√π z) Σ (2k − 1)!!/(2z²)^k
    const q = div([1, 0], mul(z, z));
    let t = [1, 0], s = [1, 0];
    for (let k = 1; k < 30; k++) { t = sc(mul(t, q), (2 * k - 1) / 2); s = add(s, t); if (C.abs(t) < 1e-16) break; }
    return mul(div([0, 1 / SP], z), s);
  }
  const n = Math.ceil(4000 + 400 * r * r);
  let w = [1, 0];
  const h = sc(z, 1 / n), f = (t, w) => mul(h, add(sc(mul(sc(z, t), w), -2), [0, 2 / SP]));
  for (let k = 0; k < n; k++) {
    const t = k / n, d = 1 / n;
    const k1 = f(t, w), k2 = f(t + d / 2, add(w, sc(k1, 0.5))), k3 = f(t + d / 2, add(w, sc(k2, 0.5))), k4 = f(t + d, add(w, k3));
    w = add(w, sc(add(add(k1, sc(k2, 2)), add(sc(k3, 2), k4)), 1 / 6));
  }
  return w;
}

// the field: d along the ground, heights hs and hr, the air at T (K) and rh (%), the ground's σ
export function field({ d, hs, hr, T = 293.15, rh = 50, sigma }) {
  const r1 = Math.hypot(d, hs - hr), r2 = Math.hypot(d, hs + hr);
  return { d, hs, hr, T, rh, sigma, r1, r2, cos: (hs + hr) / r2, c: speed(T) };
}
// the plane wave's reflection coefficient, and the spherical wave's (Weyl–van der Pol)
export function planeWave(f, F) { const Zc = sc(miki(f, F.sigma), F.cos); return div(sub(Zc, [1, 0]), add(Zc, [1, 0])); }
export function reflection(f, F) {
  if (!F.sigma) return [1, 0];
  const k = (2 * Math.PI * f) / F.c, Z = miki(f, F.sigma), Rp = planeWave(f, F);
  const w = mul(csqrt([0, (k * F.r2) / 2]), add(div([1, 0], Z), [F.cos, 0]));
  const Fw = add([1, 0], mul(sc(mul([0, 1], w), SP), faddeeva(w)));
  return add(Rp, mul(sub([1, 0], Rp), Fw));
}
// as heard (e^(+iωt)), the direct sound at its strength a metre out and its delay taken away
export function response(f, F) {
  const a = iso(f, F.T, F.rh), k = (2 * Math.PI * f) / F.c;
  const g1 = 10 ** ((-a * F.r1) / 20), g2 = (F.r1 / F.r2) * 10 ** ((-a * F.r2) / 20);
  const p = add([g1, 0], sc(mul(reflection(f, F), cexp([0, k * (F.r2 - F.r1)])), g2));
  return [p[0], -p[1]];
}
