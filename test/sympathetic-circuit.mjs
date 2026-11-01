// sympathetic-circuit.mjs — the Sympathetic Strings' physics written out independently of the C++
// (native/pedals/sympathetic): each string tuned by its stress and stiffness, its partials by
// Fletcher's formula, the force its modes put on a moving bridge, the closed form that force sums
// to for a string without stiffness, and the strings' response summed in double precision.

import { SCALES } from '../sympathetic/src/sympathetic-params.js';

export const STEEL = { E: 2e11, rho: 7850 }, STRESS = 600e6, FMAX = 6000;
export const note = (semis) => 440 * 2 ** (semis / 12);

// a string of diameter d whose first partial is f: its length found by bisection on
// f₁ = (c/2L)√(1 + B), c = √(σ/ρ), B = π³Ed⁴/64TL²
export function string(f, d) {
  const A = (Math.PI * d * d) / 4, T = STRESS * A, mu = STEEL.rho * A, EI = (STEEL.E * Math.PI * d ** 4) / 64, c = Math.sqrt(T / mu);
  const B = (L) => (Math.PI ** 3 * STEEL.E * d ** 4) / (64 * T * L * L);
  const f1 = (L) => (c / (2 * L)) * Math.sqrt(1 + B(L));
  let lo = 0.01, hi = 20;
  for (let i = 0; i < 200; i++) { const mid = Math.sqrt(lo * hi); if (f1(mid) > f) lo = mid; else hi = mid; }
  const L = Math.sqrt(lo * hi);
  return { f, L, T, mu, EI, B: B(L), c, partial: (n) => n * (c / (2 * L)) * Math.sqrt(1 + B(L) * n * n) };
}

// the strings for a key (0 = C), scale and octave of the lowest
export function strings({ key, scale, octave, wire }) {
  return SCALES[scale].map((s) => string(note(-45 + 12 * (+octave - 1) + +key + s), wire));
}

// Chaigne and Askenfelt's decay rate b₁ + b₃ω², from a 100 Hz T60 and a 2 kHz one
export function losses(sustain, highs) {
  const w1 = 2 * Math.PI * 100, w2 = 2 * Math.PI * 2000, ln = 3 * Math.log(10);
  const b3 = Math.max(0, (ln / highs - ln / sustain) / (w2 * w2 - w1 * w1));
  return { b1: Math.max(0, ln / sustain - b3 * w1 * w1), b3 };
}

// every partial up to FMAX, with the force per bridge velocity its mode puts on the bridge:
// F_n = −(2/L)(T + EI k_n²) s/(s² + 2a s + ω²) v
export function modes(S, fs = 48000) {
  const top = Math.min(FMAX, fs / 3), out = [];
  S.forEach((s, j) => { for (let n = 1; n <= 64 && s.partial(n) <= top; n++) { const k = (n * Math.PI) / s.L; out.push({ string: j, n, f: s.partial(n), K: (2 / s.L) * (s.T + s.EI * k * k) }); } });
  return out;
}

// For a string without stiffness, the bridge force per bridge displacement: the bridge's own
// −T/L, plus its modes, Σ (2T/L) ω²/(ω_n² − ω²), is −T k cot(kL). This returns both sides at ω,
// the modes summed to n = N and the rest of the sum, Σ_{n>N} 2ω²/(ω_n² − ω²) = Σ 2a²/(n² − a²) with
// a = kL/π, by the Euler–Maclaurin integral a ln((N + ½ + a)/(N + ½ − a)).
export function drivingPoint(s, f, N) {
  const k = (2 * Math.PI * f) / s.c, z = k * s.L, w = 2 * Math.PI * f;
  let sum = 0;
  for (let n = 1; n <= N; n++) { const wn = (n * Math.PI * s.c) / s.L; sum += (2 * w * w) / (wn * wn - w * w); }
  const a = z / Math.PI, rest = a * Math.log((N + 0.5 + a) / (N + 0.5 - a));
  return { modal: -(s.T / s.L) * (1 - sum - rest), closed: -s.T * k / Math.tan(z) };
}

// the pickup's output for a bridge velocity v (the driver's), every mode summed at fs in double
// precision by the impulse invariant
export function response(v, fs, { S, sustain, highs, gain }) {
  const { b1, b3 } = losses(sustain, highs), T = 1 / fs, y = new Float64Array(v.length);
  for (const m of modes(S, fs)) {
    const w = 2 * Math.PI * m.f, a = b1 + b3 * w * w, wd = Math.sqrt(w * w - a * a), r = Math.exp(-a * T);
    const cr = r * Math.cos(wd * T), ci = r * Math.sin(wd * T), c = gain * T * m.K, ea = a / wd;
    let zr = 0, zi = 0;
    for (let i = 0; i < v.length; i++) { const nr = cr * zr - ci * zi + c * v[i], ni = ci * zr + cr * zi; zr = nr; zi = ni; y[i] += zr - ea * zi; }
  }
  return y;
}
