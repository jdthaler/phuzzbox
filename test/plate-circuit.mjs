// plate-circuit.mjs — the Plate Reverb's physics written out independently of the C++
// (native/pedals/plate): a Kirchhoff plate, simply supported, its modes counted on the lattice and
// by Weyl's law, its losses from the formulas Willemsen gives (thermoelastic and radiation), its
// bending waves' group velocity, and its response as the sum of its modes, in double precision at
// the full sample rate.

export const PLATE = { Lx: 2, Ly: 1, h: 0.5e-3, E: 2e11, rho: 7850, nu: 0.3 };
export const AIR = { rho: 1.225, c: 343 };
export const THERMO = { R1: 4.94e-3, C1: 2.98e-4 };
export const DRIVE = [0.8, 0.415], PICKS = [[0.2, 0.45], [1.7, 0.45]];
const { Lx, Ly, h, E, rho, nu } = PLATE;

// ω = κ k², κ = √(D / ρh), D = E h³ / 12(1 − ν²)
export const kappa = Math.sqrt((E * h ** 3) / (12 * (1 - nu * nu)) / (rho * h));
export const fCoincidence = (AIR.c * AIR.c) / (2 * Math.PI * kappa);
export const freqOf = (m, n) => (kappa * ((m * Math.PI / Lx) ** 2 + (n * Math.PI / Ly) ** 2)) / (2 * Math.PI);
// the bending waves' group velocity dω/dk = 2κk = 2√(κω)
export const groupVelocity = (f) => 2 * Math.sqrt(kappa * 2 * Math.PI * f);

// every mode (m, n ≥ 1) from fmin to fmax, by walking the lattice
export function lattice(fmin, fmax) {
  const out = [];
  for (let n = 1; freqOf(1, n) <= fmax; n++) for (let m = 1; freqOf(m, n) <= fmax; m++) { const f = freqOf(m, n); if (f >= fmin) out.push({ m, n, f }); }
  return out;
}
// Weyl's law with its edge term: the lattice points m, n ≥ 1 inside the quarter ellipse k² ≤ ω/κ
// number S k²/4π − (Lx + Ly) k/2π, give or take a few
export function weyl(f) { const k = Math.sqrt((2 * Math.PI * f) / kappa); return (Lx * Ly * k * k) / (4 * Math.PI) - ((Lx + Ly) * k) / (2 * Math.PI); }

// the losses (amplitude decay rates, 1/s)
export function thermoelastic(f) { const w = 2 * Math.PI * f, { R1, C1 } = THERMO; return (w * w * R1 * C1) / (2 * (w * w * h * h + (C1 * C1) / (h * h))); }
export function radiation(f) {
  const fc = fCoincidence, p = Math.sqrt(f / fc);
  const g = ((1 - p * p) * Math.log((1 + p) / (1 - p)) + 2 * p) / (1 - p * p) ** 1.5;
  return (1 / (4 * Math.PI ** 2)) * ((AIR.rho * AIR.c) / (rho * h)) * ((2 * (Lx + Ly)) / (Lx * Ly)) * (AIR.c / fc) * g;
}
export const steel = (f) => thermoelastic(f) + radiation(f);
export const LN1000 = 3 * Math.log(10);
// the damper's rate for the Decay knob: a 100 Hz note's T60
export const damper = (decay) => Math.max(0, LN1000 / decay - steel(100));
export const t60 = (f, decay) => LN1000 / (steel(f) + damper(decay));

// The plate's velocity at each pickup for a force x(t) at the driver, as the sum of its modes:
// each (Φ_d Φ_p / M) e^{−αt}(cos ω_d t − (α/ω_d) sin ω_d t), M = ρh Lx Ly / 4, convolved with x by
// the rectangle rule at fs (an exact recursion of the sampled response), in double precision.
export function modalResponse(x, fs, { decay, top, gain }) {
  const modes = lattice(20, top), M = (rho * h * Lx * Ly) / 4, T = 1 / fs, d = damper(decay);
  const L = new Float64Array(x.length), R = new Float64Array(x.length);
  const shape = (m, n, [px, py]) => Math.sin((m * Math.PI * px) / Lx) * Math.sin((n * Math.PI * py) / Ly);
  for (const { m, n, f } of modes) {
    const a = steel(f) + d, w = 2 * Math.PI * f, wd = Math.sqrt(w * w - a * a), r = Math.exp(-a * T);
    const cr = r * Math.cos(wd * T), ci = r * Math.sin(wd * T), c = (gain * T * shape(m, n, DRIVE)) / M, ea = a / wd;
    const sl = shape(m, n, PICKS[0]), sr = shape(m, n, PICKS[1]);
    let zr = 0, zi = 0;
    for (let i = 0; i < x.length; i++) {
      const nr = cr * zr - ci * zi + c * x[i], ni = ci * zr + cr * zi;
      zr = nr; zi = ni;
      const u = zr - ea * zi;
      L[i] += sl * u; R[i] += sr * u;
    }
  }
  return { L, R, count: modes.length };
}
