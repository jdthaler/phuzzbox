// opto-circuit.mjs — the Opto Compressor's physics, written here independently of the C++: the
// attenuator as a voltage divider, the panel's voltage law, the cell's rate equations (Rose's
// free and trapped electrons) integrated by the classical Runge–Kutta method at a fine step, their
// steady state in closed form, the linearised release as a two-by-two eigenproblem, and the
// quasi-static gain for a steady sine by Simpson's rule over a cycle and the secant method.

export const RS = 47e3, AD = 10000, VREF = 100, N1 = 1, TRAPS = 2, CAPTURE = 1;

export function model(P) {
  const x = Math.min(1, Math.max(0, P.peak));
  return {
    kpr: (81 ** x - 1) / 80, b: P.panelB, tp: P.afterglow, swing: P.swing, litR: P.litR, darkR: P.darkR,
    tau: P.lifetime, tauE: P.trapTime, ff: P.sense === 'input',
  };
}
export const drive = (M, v) => Math.max(-M.swing, Math.min(M.swing, AD * M.kpr * v));
export const emission = (M, v) => (Math.abs(v) < 1e-9 ? 0 : Math.exp(-M.b * (1 / Math.sqrt(Math.abs(v)) - 1 / Math.sqrt(VREF))));
// the divider: Rs over the cell (its dark resistance in parallel with the light's conductance n/Rlit)
export function atten(M, n) { const g = 1 / M.darkR + n / M.litR; return 1 / (1 + RS * g); }
export const nFromAtten = (M, a) => M.litR * ((1 - a) / (a * RS) - 1 / M.darkR);
// the steady state under a constant light: Λ = n(1 + n/n₁) (the traps in balance), and the traps'
// fill where capture equals release, k n (N − m) = m/τe
export function steady(M, light) {
  const n = (N1 / 2) * (Math.sqrt(1 + (4 * light) / N1) - 1);
  return { n, m: (TRAPS * CAPTURE * n * M.tauE) / (1 + CAPTURE * n * M.tauE) };
}
export function rates(M, light, n, m) {
  const cap = CAPTURE * n * (TRAPS - m), rel = m / M.tauE;
  return [light / M.tau - (n / M.tau) * (1 + n / N1) - cap + rel, cap - rel];
}
// integrate the cell under light(t) from (n, m) for T seconds, steps of h (RK4)
export function integrate(M, light, n, m, T, h = 1e-5) {
  const steps = Math.round(T / h);
  for (let s = 0; s < steps; s++) {
    const t = s * h, L0 = light(t), Lh = light(t + h / 2), L1 = light(t + h);
    const k1 = rates(M, L0, n, m), k2 = rates(M, Lh, n + (h / 2) * k1[0], m + (h / 2) * k1[1]);
    const k3 = rates(M, Lh, n + (h / 2) * k2[0], m + (h / 2) * k2[1]), k4 = rates(M, L1, n + h * k3[0], m + h * k3[1]);
    n += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    m += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
  }
  return { n, m };
}
// In the dark and with few electrons (n ≪ n₁, m ≪ N) the rates are linear, d[n m]/dt = A [n m]:
// n(t) as the sum of A's two eigenmodes from (n0, m0)
export function linearRelease(M, n0, m0) {
  const a = -1 / M.tau - CAPTURE * TRAPS, b = 1 / M.tauE, c = CAPTURE * TRAPS, d = -1 / M.tauE;
  const tr = a + d, det = a * d - b * c, disc = Math.sqrt(tr * tr / 4 - det);
  const l1 = tr / 2 + disc, l2 = tr / 2 - disc; // the slow and the fast rate (both negative)
  // n = α e^{l1 t} + β e^{l2 t}; n(0) = n0, n'(0) = a n0 + b m0
  const dn0 = a * n0 + b * m0, al = (dn0 - l2 * n0) / (l1 - l2), be = n0 - al;
  return { n: (t) => al * Math.exp(l1 * t) + be * Math.exp(l2 * t), slow: -1 / l1, fast: -1 / l2 };
}
// the panel's light averaged over a cycle of a sine of amplitude v at the driver (Simpson's rule
// over a whole period: both half cycles, which glow alike)
export function meanLight(M, v) {
  const K = 2000;
  let s = 0;
  for (let k = 0; k <= K; k++) s += (k === 0 || k === K ? 1 : k % 2 ? 4 : 2) * emission(M, drive(M, v * Math.sin((2 * Math.PI * k) / K)));
  return s / (3 * K);
}
// the quasi-static attenuator gain for a steady sine of amplitude A at the input: feed-forward
// directly; feedback by the secant method on f(n) = Λ(a(n) A) − n(1 + n/n₁)
export function quasiStatic(M, A) {
  if (M.ff) return atten(M, steady(M, meanLight(M, A)).n);
  const f = (n) => meanLight(M, atten(M, n) * A) - n * (1 + n / N1);
  if (f(0) <= 0) return atten(M, 0);
  let x0 = 0, x1 = 0.01, f0 = f(x0), f1 = f(x1);
  while (f1 > 0) { x0 = x1; f0 = f1; x1 *= 2; f1 = f(x1); } // bracket
  for (let it = 0; it < 200 && Math.abs(x1 - x0) > 1e-12; it++) { // regula falsi (Illinois)
    const x2 = x1 - (f1 * (x1 - x0)) / (f1 - f0), f2 = f(x2);
    if (f2 * f1 < 0) { x0 = x1; f0 = f1; } else f0 /= 2;
    x1 = x2; f1 = f2;
  }
  return atten(M, x1);
}
