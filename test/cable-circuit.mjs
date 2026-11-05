// cable-circuit.mjs — the Transatlantic Cable's physics worked out here independently of the C++:
// the cables' constants from their construction; the continuous line's response from its ABCD
// matrix in complex arithmetic of its own; the ladder's by chaining its sections; the response to
// a step by inverting the line's Laplace transform numerically (Talbot's contour, Abate and Valkó's
// fixed form); and Kelvin's open-ended cable by its Fourier series.

// complex numbers as [re, im]
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const sqrtc = (a) => { const r = Math.hypot(a[0], a[1]), re = Math.sqrt((r + a[0]) / 2), im = Math.sign(a[1] || 1) * Math.sqrt(Math.max(0, (r - a[0]) / 2)); return [re, im]; };
const expc = (a) => { const m = Math.exp(a[0]); return [m * Math.cos(a[1]), m * Math.sin(a[1])]; };
const coshc = (a) => { const e = expc(a), f = expc([-a[0], -a[1]]); return [(e[0] + f[0]) / 2, (e[1] + f[1]) / 2]; };
const sinhc = (a) => { const e = expc(a), f = expc([-a[0], -a[1]]); return [(e[0] - f[0]) / 2, (e[1] - f[1]) / 2]; };
export const abs = (a) => Math.hypot(a[0], a[1]);

const RHO = 1.72e-8, CU = 8960, GP = 980, EPS = 3, EPS0 = 8.8541878128e-12, MU0 = 4e-7 * Math.PI;
// a submarine cable: copper core and gutta-percha, by mass per metre
function submarine(mc, mg) {
  const ac = mc / CU, d = 2 * Math.sqrt(ac / Math.PI), D = 2 * Math.sqrt((mg / GP + ac) / Math.PI), ln = Math.log(D / d);
  return { R: RHO / ac, L: (MU0 / (2 * Math.PI)) * ln, C: (2 * Math.PI * EPS0 * EPS) / ln, G: 0, source: 5 };
}
export const CABLES = {
  atlantic1858: submarine(0.026, 0.064),
  atlantic1866: submarine(0.073, 0.098),
  pair: { R: (2 * RHO) / (Math.PI * 0.2e-3 ** 2), L: 0.6e-6, C: 52e-12, G: 1e-12, source: 600 },
};
export const SPACING = 1828.8, OPEN = 1e6;

// a line's series impedance and shunt admittance per metre at s, γ and Z₀
const zy = (c, s) => [add([c.R, 0], mul([c.L, 0], s)), add([c.G, 0], mul([c.C, 0], s))];
export const gamma = (c, s) => { const [z, y] = zy(c, s); return sqrtc(mul(z, y)); };
export const z0 = (c, s) => { const [z, y] = zy(c, s); return sqrtc(div(z, y)); };
const chain = (m, n) => [add(mul(m[0], n[0]), mul(m[1], n[2])), add(mul(m[0], n[1]), mul(m[1], n[3])), add(mul(m[2], n[0]), mul(m[3], n[2])), add(mul(m[2], n[1]), mul(m[3], n[3]))];
const lineAbcd = (c, len, s) => { const g = mul(gamma(c, s), [len, 0]), z = z0(c, s); return [coshc(g), mul(z, sinhc(g)), div(sinhc(g), z), coshc(g)]; };
// the far end's voltage over the source's, between source and load resistances
const transfer = (m, zs, zl) => div([zl, 0], add(add(mul(m[0], [zl, 0]), m[1]), mul([zs, 0], add(mul(m[2], [zl, 0]), m[3]))));
const jw = (f) => [0, 2 * Math.PI * f];

// the configuration a P describes (P in the pedal's own units), as the C++ should build it
export function setup(P) {
  const c = { ...CABLES[P.conductor] }, l = P.length;
  const s = { c, l, zs: c.source, loading: P.loading };
  if (P.loading === 'heaviside') {
    c.L += P.inductance * 1e-3;
    c.G = (c.R * c.C) / c.L;
    s.z0 = Math.sqrt(c.L / c.C);
    s.delay = l * Math.sqrt(c.L * c.C);
    s.loss = Math.exp(-l * Math.sqrt(c.R * c.G));
    s.zl = P.far === 'open' ? OPEN : s.z0;
  } else if (P.loading === 'coils') {
    s.n = Math.max(1, Math.round(l / SPACING));
    const avg = { ...c, L: c.L + P.coil / SPACING };
    s.zl = P.far === 'open' ? OPEN : abs(z0(avg, jw(1000)));
  } else s.zl = P.far === 'open' ? OPEN : abs(z0(c, jw(1000)));
  return s;
}
// the continuous line's response at the complex frequency s (coils between lengths of it)
export function lineAt(P, sc) {
  const s = setup(P);
  if (s.loading === 'coils') {
    let m = [[1, 0], [0, 0], [0, 0], [1, 0]];
    const sec = chain([[1, 0], mul([P.coil, 0], sc), [0, 0], [1, 0]], lineAbcd(s.c, s.l / s.n, sc));
    for (let k = 0; k < s.n; k++) m = chain(m, sec);
    return transfer(m, s.zs, s.zl);
  }
  return transfer(lineAbcd(s.c, s.l, sc), s.zs, s.zl);
}
export const line = (P, f) => lineAt(P, jw(f));
// the ladder of n sections, each a series R + sL and a shunt G + sC, a loading coil in series
// before every per-th (with coils)
export function ladder(P, f, n, per = 1) {
  const s = setup(P), d = s.l / n, sc = jw(f);
  const sec = chain([[1, 0], add([s.c.R * d, 0], mul([s.c.L * d, 0], sc)), [0, 0], [1, 0]], [[1, 0], [0, 0], add([s.c.G * d, 0], mul([s.c.C * d, 0], sc)), [1, 0]]);
  const coil = s.loading === 'coils' ? [[1, 0], mul([P.coil, 0], sc), [0, 0], [1, 0]] : null;
  let m = [[1, 0], [0, 0], [0, 0], [1, 0]];
  for (let k = 0; k < n; k++) m = chain(coil && k % per === 0 ? chain(m, coil) : m, sec);
  return transfer(m, s.zs, s.zl);
}

// the far end's response to a volt switched on at t = 0: the inverse Laplace transform of H(s)/s
// by Talbot's contour, f(t) ≈ (r/M)[½ F(r) e^{rt} + Σ Re(e^{tS} F(S) (1 + iσ))], S = rθ(cot θ + i)
export function stepAt(P, t, M = 32) {
  const r = (2 * M) / (5 * t), F = (s) => div(lineAt(P, s), s);
  let sum = 0.5 * F([r, 0])[0] * Math.exp(r * t);
  for (let k = 1; k < M; k++) {
    const th = (k * Math.PI) / M, cot = 1 / Math.tan(th), S = [r * th * cot, r * th], sigma = th + (th * cot - 1) * cot;
    sum += mul(mul(expc([t * S[0], t * S[1]]), F(S)), [1, sigma])[0];
  }
  return (r / M) * sum;
}

// Kelvin's cable: all R and C, driven by a perfect source, its far end open. The far end's voltage
// after a volt is switched on, v = 1 − (4/π) Σ (−1)ⁿ/(2n + 1) e^{−(2n+1)² π² t / (4 RC ℓ²)}; the
// time it reaches half, in units of RC ℓ²
export function kelvin(tau) {
  let s = 0;
  for (let n = 0; n < 200; n++) s += ((n % 2 ? -1 : 1) / (2 * n + 1)) * Math.exp(-((2 * n + 1) ** 2) * Math.PI ** 2 * tau / 4);
  return 1 - (4 / Math.PI) * s;
}
export function kelvinHalf() {
  let lo = 0.01, hi = 2;
  for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; (kelvin(m) < 0.5 ? (lo = m) : (hi = m)); }
  return (lo + hi) / 2;
}
