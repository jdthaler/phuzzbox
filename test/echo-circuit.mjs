// echo-circuit.mjs — the Tape Echo's physics written independently of the C++: the playback
// heads' losses, the tape's anhysteretic curve and its harmonics by Simpson's rule, the motor, and
// the capstan's flutter.

export const HEADS = [0.04, 0.08, 0.12], CAPSTAN_R = 2.5e-3, COATING = 8e-6, MOTOR_TAU = 0.25;

// the playback losses at f for tape speed v, head spacing d and gap g (Bertram; Chowdhury 2019):
// spacing e^{−kd}, thickness (1 − e^{−kδ})/(kδ), gap sin(kg/2)/(kg/2), with k = 2πf/v
export function heads(f, v, d, g) {
  const k = (2 * Math.PI * f) / v;
  const thick = k * COATING < 1e-12 ? 1 : (1 - Math.exp(-k * COATING)) / (k * COATING);
  const gap = k * g < 1e-12 ? 1 : Math.sin((k * g) / 2) / ((k * g) / 2);
  return Math.exp(-k * d) * thick * gap;
}

// the anhysteretic magnetisation (the Langevin function), from its definition
export const langevin = (u) => (Math.abs(u) < 1e-4 ? u / 3 : Math.cosh(u) / Math.sinh(u) - 1 / u);
// what the tape keeps of x volts at record gain g, normalised to x for a small x
export const tape = (x, g) => (3 * langevin(g * x)) / g;

// the n-th harmonic's amplitude of tape(A sin θ), by Simpson's rule over a cycle
export function harmonic(A, g, n, N = 2000) {
  let s = 0;
  for (let i = 0; i <= N; i++) {
    const th = (2 * Math.PI * i) / N, w = i === 0 || i === N ? 1 : i % 2 ? 4 : 2;
    s += w * tape(A * Math.sin(th), g) * Math.sin(n * th);
  }
  return ((s * (2 * Math.PI)) / N / 3) / Math.PI;
}

// the motor after a step of the knob from v1 to v2 at t = 0
export const motor = (v1, v2, t) => v2 + (v1 - v2) * Math.exp(-t / MOTOR_TAU);

// the capstan turns once per 2πr of tape, and a head d behind the record head plays tape recorded
// d/r radians of the capstan earlier: the echo's pitch wavers by 2(e/r)|sin(d/2r)| at v/(2πr)
export const flutterRate = (v) => v / (2 * Math.PI * CAPSTAN_R);
export const flutterDepth = (e, d) => 2 * (e / CAPSTAN_R) * Math.abs(Math.sin(d / (2 * CAPSTAN_R)));
