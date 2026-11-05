// neon-circuit.mjs — the Neon Tremolo's physics worked out independently of the C++, for the tests:
// breakdown from Townsend's condition for a self-sustaining discharge, solved numerically; the
// oscillator by Runge–Kutta with each switch found by bisection; the cell's rate equation by
// Runge–Kutta in small steps; the divider from Ohm's law.

// Townsend's constants, A in 1/(cm Torr) and B in V/(cm Torr) (Wang et al., J. Appl. Phys. 132, 073302, Table I)
export const GASES = { ne: { A: 4, B: 100 }, he: { A: 3, B: 34 }, ar: { A: 12, B: 180 } };
export const BALLAST = 5.5e3, HOLD = 50e-6, IREF = 0.5e-3, RLIT = 5e3, RDARK = 1e6, RS = 100e3, POT = 1e6;

// Townsend: an electron leaving the cathode makes e^(αd) − 1 ions across the gap, which knock
// γ (e^(αd) − 1) electrons back out of it; the discharge sustains itself when that is one. With
// α = A p e^(−B p d / V), find the V that makes it so (bisection on the log of the left side, which
// falls as V falls); Infinity if even an enormous voltage can't.
export function breakdown(gas, pd, gamma) {
  const { A, B } = GASES[gas];
  const f = (V) => Math.log(gamma) + Math.log(Math.expm1(A * pd * Math.exp((-B * pd) / V)));
  let hi = 1e7;
  if (!(f(hi) > 0)) return Infinity;
  let lo = 1;
  for (let k = 0; k < 200; k++) { const m = Math.sqrt(lo * hi); if (f(m) > 0) hi = m; else lo = m; }
  return Math.sqrt(lo * hi);
}
// the curve's minimum, found by golden-section search over pd
export function minimum(gas, gamma) {
  let a = Math.log(0.01), b = Math.log(100);
  const g = (x) => breakdown(gas, Math.exp(x), gamma), r = (Math.sqrt(5) - 1) / 2;
  for (let k = 0; k < 200; k++) {
    const c = b - r * (b - a), d = a + r * (b - a);
    if (g(c) < g(d)) b = d; else a = c;
  }
  return { pd: Math.exp((a + b) / 2), V: g((a + b) / 2) };
}

// the lamp's three voltages: it burns from the normal cathode fall, which the simple theory of
// the cathode layer puts at 3/e of the curve's minimum
export function lamp({ gas, pd, gamma }) {
  const Vb = breakdown(gas, pd, gamma), Vm = (3 / Math.E) * minimum(gas, gamma).V;
  return { Vb, Vm, Ve: Vm + BALLAST * HOLD };
}

// the oscillator: C dv/dt = (Vs − v)/R − i, with i = (v − Vm)/r while lit; strikes at Vb, goes out
// when i falls to the hold current. Runge–Kutta in steps of h, each switch located by bisection on
// a step; returns the strike times and the charge through the lamp between successive strikes.
export function oscillate({ Vs, R, C, Vb, Vm, Ve }, v0, seconds, h = 1e-6) {
  let v = v0, lit = false, t = 0, q = 0;
  const strikes = [], charges = [];
  const f = (x, on) => ((Vs - x) / R - (on ? (x - Vm) / BALLAST : 0)) / C;
  const rk = (x, on, dt) => {
    const k1 = f(x, on), k2 = f(x + (dt / 2) * k1, on), k3 = f(x + (dt / 2) * k2, on), k4 = f(x + dt * k3, on);
    return x + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
  };
  while (t < seconds) {
    const next = rk(v, lit, h);
    const crosses = lit ? next < Ve : next > Vb, level = lit ? Ve : Vb;
    if (crosses) {
      let lo = 0, hi = h;
      for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if ((rk(v, lit, m) - level) * (next - level) > 0) hi = m; else lo = m; }
      const dt = (lo + hi) / 2, vx = rk(v, lit, dt);
      if (lit) q += (((v + vx) / 2 - Vm) / BALLAST) * dt;
      t += dt; v = level; lit = !lit;
      if (lit) { if (strikes.length) charges.push(q); strikes.push(t); q = 0; }
      continue;
    }
    if (lit) q += (((v + next) / 2 - Vm) / BALLAST) * h; // the trapezoid: the current is nearly straight over 1 µs
    v = next; t += h;
  }
  return { strikes, charges };
}

// the period in closed form: charging RC ln((Vs − Ve)/(Vs − Vb)), then the flash, toward the
// Thévenin voltage of the supply through R and the lamp through r, with τ = C (R ∥ r)
export function period({ Vs, R, C, Vb, Vm, Ve }) {
  const vi = (Vs * BALLAST + Vm * R) / (R + BALLAST), tau = (C * R * BALLAST) / (R + BALLAST);
  return R * C * Math.log((Vs - Ve) / (Vs - Vb)) + tau * Math.log((Vb - vi) / (Ve - vi));
}

// the cell: dn/dt = (Λ − n(1 + n))/τ, Runge–Kutta in steps of h
export function cellRun(n0, lights, dt, tau, sub = 50) {
  const out = [], h = dt / sub, f = (m, L) => (L - m * (1 + m)) / tau;
  let n = n0;
  for (const L of lights) {
    for (let k = 0; k < sub; k++) {
      const k1 = f(n, L), k2 = f(n + (h / 2) * k1, L), k3 = f(n + (h / 2) * k2, L), k4 = f(n + h * k3, L);
      n += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    }
    out.push(n);
  }
  return out;
}
export const cellR = (n) => 1 / (1 / RDARK + n / RLIT);
// the divider: Rs above, the cell and the Depth pot's (1 − d)² of 1 MΩ below
export const divider = (R, depth) => { const Rd = POT * (1 - depth) ** 2; return (R + Rd) / (RS + R + Rd); };
