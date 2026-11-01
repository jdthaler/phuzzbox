// spring-circuit.mjs — the Spring Reverb's physics written independently of the C++: the thin
// spring's standing waves as a 2 × 2 symmetric eigenproblem solved directly (eigenvalue and
// eigenvector), its transition frequency by golden section, Parker and Bilbao's closed forms,
// group delays by central differences, the beads, and the losses.

export const E = 200e9, RHO = 7850, CE = Math.sqrt(E / RHO), MAGNET_RHO = 7300;

// Parker & Bilbao (2009), Appendix A: coil diameter, turns, helix length, magnet length and diameter
export const TANKS = {
  leem: [[4.4e-3, 303, 0.163, 4e-3, 1.5e-3], [4.5e-3, 280, 0.163, 4e-3, 1.5e-3], [4.6e-3, 351, 0.163, 4e-3, 1.5e-3]],
  olson: [[5.4e-3, 148, 0.065, 5e-3, 2.1e-3], [6.1e-3, 133, 0.065, 5e-3, 2.1e-3]],
  one: [[4.4e-3, 303, 0.163, 4e-3, 1.5e-3]],
};

export function spring([D, turns, H, mL, mD], wireD) {
  const R = D / 2, r = wireD / 2, eps = 1 / R;
  const L = Math.sqrt((2 * Math.PI * R * turns) ** 2 + H ** 2);
  const g2 = E / RHO, k2 = (r * r * E) / (4 * RHO);
  // standing waves u = U sin ks (toward the axis), v = V cos ks (along the wire) in
  //   ρA u_tt = −EI(∂² + ε²)²u + EAε(∂v − εu),  ρA v_tt = EA ∂(∂v − εu)
  // give ω²(U, V) = K(U, V) with K symmetric:
  const K = (k) => [k2 * (k * k - eps * eps) ** 2 + g2 * eps * eps, g2 * eps * k, g2 * k * k];
  // the lower eigenvalue and its unit eigenvector, directly
  const solve = (k) => {
    const [a, b, d] = K(k);
    const hi = (a + d) / 2 + Math.sqrt(((a - d) / 2) ** 2 + b * b);
    const lo = (a * d - b * b) / hi;
    // (K − lo)(U, V) = 0: (a − lo)U + bV = 0
    let U = b, V = lo - a;
    const n = Math.hypot(U, V); U /= n; V /= n;
    return { w2: lo, U, V };
  };
  const omega = (k) => Math.sqrt(Math.max(0, solve(k).w2));
  const cg = (k) => { const h = 1e-6 * k; return (omega(k + h) - omega(k - h)) / (2 * h); };
  // the end section turns about the axis by ψ = ∂u/∂s + εv: (kU + εV) at s = 0, a share of the
  // rotation wave's (whose ψR = V = 1)
  const share = (k) => { const { U, V } = solve(k); return ((k * U + eps * V) * R) ** 2; };
  // the transition: golden section for the lower branch's peak
  let a = 0.2 * eps, b = 0.9 * eps;
  const gr = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 100; i++) { const x1 = b - gr * (b - a), x2 = a + gr * (b - a); if (omega(x1) > omega(x2)) b = x2; else a = x1; }
  const kc = (a + b) / 2, Fc = omega(kc) / (2 * Math.PI);
  // the low-frequency speed along the wire: κε, as Parker and Bilbao define T_D with it (the exact
  // slope of the lower root is less by (r/2R)²/2), and that slope, by a small k
  const c0 = Math.sqrt(k2) * eps, slope = omega(1e-3 * eps) / (1e-3 * eps);
  // the beads: magnets on the axis turning about their own axis, against the wire's rotation
  const mb = MAGNET_RHO * Math.PI * (mD / 2) ** 2 * mL, Ib = (mb * (mD / 2) ** 2) / 2;
  const Is = RHO * Math.PI * r * r * L * R * R, mu = Ib / Is;
  return { R, r, L, eps, omega, cg, share, kc, Fc, c0, slope, TD: (2 * L) / c0, mu, fb: c0 / (2 * L) / (Math.PI * mu) };
}

// Parker & Bilbao's closed forms: T_D = 4LR/(r√(E/ρ)) and F_C ≈ 3r√(E/ρ)/(16√5 π R²)
export const tdPB = (s) => (4 * s.L * s.R) / (s.r * CE);
export const fcPB = (s) => (3 * s.r * CE) / (16 * Math.sqrt(5) * Math.PI * s.R * s.R);

// the beads' inertia at both ends, as a velocity filter: 1/(1 + (f/f_b)²)
export const beads = (s, f) => 1 / (1 + (f / s.fb) ** 2);

// the losses: σ = oil + πfη + (ℓ ln10/20)|c_g|/L
export const sigmaOf = (s, f, cg, mounts, eta, oil) => oil + Math.PI * f * eta + ((mounts * Math.LN10) / 20) * Math.abs(cg) / s.L;

// the wavenumbers on the slow branch (below k_c) and the bending branch (above ε) where ω = 2πf, by
// bisection
export function kAt(s, f, branch) {
  const w = 2 * Math.PI * f;
  let a = branch === 'slow' ? 0 : s.eps, b = branch === 'slow' ? s.kc : 2 * s.eps;
  while (branch !== 'slow' && s.omega(b) < w) b *= 2;
  for (let i = 0; i < 200; i++) { const c = (a + b) / 2; if (s.omega(c) < w) a = c; else b = c; }
  return (a + b) / 2;
}
