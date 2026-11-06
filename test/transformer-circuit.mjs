// transformer-circuit.mjs — the Output Transformer worked out independently of the C++, for its
// tests: the cores' published Jiles–Atherton parameters, the anhysteretic, and the output stage
// integrated in time by the classical Runge–Kutta method with the JA equation as published, its
// slope dM/dH taken at each stage (the C++ instead steps the flux by the trapezoidal rule and the
// magnetisation in the field by an exact solution of the equation linearised).

export const MU0 = 4e-7 * Math.PI;
// Jiles and Atherton's 1986 form, c as there: Holters & Zölzer (2016) Table 1, column [2]
// (their c = 0.17 converted back to 0.2); Plucinski et al. (2025) Table 1 at 30 °C;
// Szewczyk (2018) Table 1
export const CORES = {
  iron: { name: 'Iron', Ms: 1.6e6, a: 1.1e3, alpha: 1.6e-3, k: 4.0e2, c: 0.2 },
  nickel: { name: '50 % nickel', Ms: 9.70e5, a: 4.040, alpha: 6e-6, k: 4.200, c: 4e-5 },
  permalloy: { name: 'Permalloy', Ms: 6.14e5, a: 1.010, alpha: 2.988e-6, k: 0.588, c: 4e-5 },
};
export const TURNS = 1500, PATH = 0.15, LOAD = 4200;

const L = (x) => (Math.abs(x) < 1e-4 ? x / 3 : 1 / Math.tanh(x) - 1 / x);
const dL = (x) => (Math.abs(x) < 1e-3 ? 1 / 3 - (x * x) / 15 : 1 / (x * x) - 1 / Math.sinh(x) ** 2);

// dM/dH from the JA equation (1986 form): δ the field's direction; the irreversible term only when
// Man − M has δ's sign; dMan/dH = (Ms/a) L′ (1 + α dM/dH), solved for dM/dH; the denominator kept
// from crossing zero as the C++ keeps it
export function slope(p, H, M, d) {
  const cc = p.c / (1 + p.c), x = (H + p.alpha * M) / p.a, w = p.Ms * L(x) - M, lp = (p.Ms / p.a) * dL(x);
  const kap = Math.max((1 + p.c) * (p.k - p.alpha * Math.abs(w)), 1e-6 * (1 + p.c) * p.k);
  const irr = d * w >= 0 ? (d * w) / kap : 0;
  return (irr + cc * lp) / (1 - p.alpha * cc * lp);
}
export const anhysteretic = (p, He) => p.Ms * L(He / p.a);
// the initial susceptibility: at H = M = 0 only the reversible part moves, c/(1 + c) of the
// anhysteretic's slope Ms/3a, with the mean field it adds
export function chi0(p) { const cc = p.c / (1 + p.c), lp = p.Ms / (3 * p.a); return (cc * lp) / (1 - p.alpha * cc * lp); }

// the major loop: from demagnetised to Hmax, then down to −Hmax and back, by RK4 in H in steps of dh
export function loop(p, Hmax, n, dh = 0.002 * p.a) {
  let H = 0, M = 0;
  const walk = (to) => {
    const d = Math.sign(to - H), steps = Math.max(1, Math.ceil(Math.abs(to - H) / dh)), h = (to - H) / steps;
    for (let i = 0; i < steps; i++) {
      const k1 = slope(p, H, M, d), k2 = slope(p, H + h / 2, M + (h / 2) * k1, d), k3 = slope(p, H + h / 2, M + (h / 2) * k2, d), k4 = slope(p, H + h, M + h * k3, d);
      M += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      H += h;
    }
  };
  walk(Hmax);
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = (i + 1) / n;
    walk(Hmax * (u < 0.5 ? 1 - 4 * u : 4 * u - 3));
    out.push([H, MU0 * (H + M)]);
  }
  return out;
}

// The output stage playing a tone from rest, Vth = g sin 2πft behind rp across the primary:
//   N A µ0 (1 + dM/dH) dH/dt = Vth − rp l H/N,  dM/dt = dM/dH dH/dt,
// δ the sign of dH/dt (that of the right side). RK4 in time, `per` steps a period; returns the last
// two periods at n points: the primary's voltage, H and B.
export function tone({ core, A, Rs }, g, f, periods, n, per = 40000) {
  const p = CORES[core], rp = (Rs * LOAD) / (Rs + LOAD), K = TURNS * A * MU0, h = 1 / (f * per);
  const vth = (t) => g * Math.sin(2 * Math.PI * f * t);
  const rhs = (t, H, M) => {
    const v = vth(t) - (rp * PATH * H) / TURNS, s = slope(p, H, M, v >= 0 ? 1 : -1), dH = v / (K * (1 + Math.max(0, s)));
    return [dH, s * dH];
  };
  let H = 0, M = 0;
  const total = periods * per, from = total - 2 * per, every = (2 * per) / n;
  const v = [], Hs = [], B = [];
  for (let i = 0; i < total; i++) {
    const t = i * h;
    const [a1, b1] = rhs(t, H, M), [a2, b2] = rhs(t + h / 2, H + (h / 2) * a1, M + (h / 2) * b1);
    const [a3, b3] = rhs(t + h / 2, H + (h / 2) * a2, M + (h / 2) * b2), [a4, b4] = rhs(t + h, H + h * a3, M + h * b3);
    H += (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
    M += (h / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
    const j = i + 1 - from;
    if (j > 0 && j % every === 0) { v.push(vth((i + 1) * h) - (rp * PATH * H) / TURNS); Hs.push(H); B.push(MU0 * (H + M)); }
  }
  return { v, H: Hs, B };
}
