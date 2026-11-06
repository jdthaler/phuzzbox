// rubens-circuit.mjs — Rubens' Tube worked out independently of the C++, for the tests: the pipe as a
// transmission line closed at its far end, in closed form, its wave number Kirchhoff's at every
// frequency, k = ω/c + (1 + i) α(f), rather than the C++'s sum of modes, each with α at its own
// frequency; and the speaker's mechanical impedance loaded by the line's input impedance.
// Complex numbers are [re, im], with e^(−iωt) as the C++'s model has them.

export const GASES = {
  // NIST Chemistry WebBook, 293.15 K and 0.101325 MPa: c (m/s), ρ (kg/m³), μ (Pa·s), Cp, Cv (J/mol·K),
  // k (W/m·K), M (kg/mol)
  propane: { c: 246.59, rho: 1.865, mu: 7.9877e-6, cp: 73.374, cv: 64.422, k: 0.017763, M: 0.0440956 },
  methane: { c: 445.01, rho: 0.66816, mu: 1.0914e-5, cp: 35.625, cv: 27.229, k: 0.033271, M: 0.0160425 },
};
export const gamma = (g) => g.cp / g.cv;
export const prandtl = (g) => (g.mu * (g.cp / g.M)) / g.k;
// Gardner, Gee and Dix (2009), Table I
export const DRIVER = { Re: 5.42, Bl: 6.59, Mms: 9.66e-3, Cms: 482.8e-6, Fs: 73.7, Qms: 3.03 };

const add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const sc = (a, s) => [a[0] * s, a[1] * s];
const cos = (z) => [Math.cos(z[0]) * Math.cosh(z[1]), -Math.sin(z[0]) * Math.sinh(z[1])];
const sin = (z) => [Math.sin(z[0]) * Math.cosh(z[1]), Math.cos(z[0]) * Math.sinh(z[1])];
export const C = { add, mul, div, sc, abs: (a) => Math.hypot(a[0], a[1]) };

// Kirchhoff's attenuation in a pipe of radius a (1/m)
export const kirchhoff = (g, a, f) => (Math.sqrt((Math.PI * f * g.mu) / g.rho) * (1 + (gamma(g) - 1) / Math.sqrt(prandtl(g)))) / (a * g.c);

// the pipe the knobs make
export function pipe(P) { const g = GASES[P.gas], a = P.diameter / 200; return { g, a, L: P.length, St: Math.PI * a * a, xm: (P.mic / 100) * P.length }; }

// pressure at x per unit volume velocity in at x = 0, a rigid cap at L: p = i ρc cos(k(L − x))/(St sin kL)
// (e^(−iωt): the line's input impedance −i ρc cot(kL)/St... with Kirchhoff's k)
export function line(T, f, x) {
  const { g, a, L, St } = T, al = kirchhoff(g, a, f), k = [(2 * Math.PI * f) / g.c + al, al];
  return sc(mul([0, 1], div(cos(sc(k, L - x)), sin(sc(k, L)))), (g.rho * g.c) / St);
}

// the driver loaded by the pipe: the cone's velocity and the pressure at x, per volt
export function response(P, f, x) {
  const T = pipe(P), d = DRIVER, w = 2 * Math.PI * f, iw = [0, -w];
  const z0 = line(T, f, 0), Rms = (2 * Math.PI * d.Fs * d.Mms) / d.Qms;
  let mech = add(sc(iw, d.Mms), [Rms + (d.Bl * d.Bl) / d.Re, 0]);
  mech = add(mech, div([1 / d.Cms, 0], iw));
  const Sd = T.St; // a piston filling the bore
  mech = add(mech, sc(z0, Sd * Sd));
  const v = div([d.Bl / d.Re, 0], mech);
  return { v, p: mul(sc(v, Sd), line(T, f, x ?? T.xm)) };
}

// the gas leaving a hole, by Bernoulli: its speed goes as √(P + p), so over a cycle of p = A sin ωt its
// mean is √P times ⟨√(1 + (A/P) sin ωt)⟩, which falls as the sound grows (Ficken and Stephenson): the
// flames are shortest where the pressure swings most, at the antinodes
export function meanFlow(A, P) {
  let s = 0;
  const n = 256;
  for (let i = 0; i < n; i++) s += Math.sqrt(Math.max(0, 1 + (A / P) * Math.sin((2 * Math.PI * (i + 0.5)) / n)));
  return s / n;
}
