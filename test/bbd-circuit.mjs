// bbd-circuit.mjs — the Bucket Brigade's chain worked out independently of the C++: the Butterworth
// filters from their poles, the transfer loss as the sum over its negative binomial terms (each
// computed from logarithms), the sample-and-hold, and the sampling theorem's aliases.

const TAU = 2 * Math.PI;
export const cx = { mul: ([a, b], [c, d]) => [a * c - b * d, a * d + b * c], abs: ([a, b]) => Math.hypot(a, b), arg: ([a, b]) => Math.atan2(b, a), div: ([a, b], [c, d]) => { const m = c * c + d * d; return [(a * c + b * d) / m, (b * c - a * d) / m]; } };

// a third-order Butterworth low-pass: poles evenly round the left half of the circle of radius
// 2π fc, at angles 2π/3, π and 4π/3; H = Π (−p_k) / (s − p_k), 1 at DC
export function butterworth(f, fc) {
  let H = [1, 0];
  for (const th of [(2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3]) {
    const p = [Math.cos(th), Math.sin(th)]; // over 2π fc
    H = cx.mul(H, cx.div([-p[0], -p[1]], [-p[0], f / fc - p[1]]));
  }
  return H;
}
// the chance a charge arrives m clock cycles late after N transfers, each leaving ε behind
export function lateBy(N, eps, m) {
  if (eps === 0) return m === 0 ? 1 : 0;
  let log = N * Math.log1p(-eps) + m * Math.log(eps);
  for (let j = 1; j <= m; j++) log += Math.log((N + j - 1) / j);
  return Math.exp(log);
}
// the transfer loss's response at f, the clock fc: Σ_m p_m e^(−iωmT)
export function transfer(N, eps, f, fc, terms = 200) {
  let re = 0, im = 0;
  for (let m = 0; m < terms; m++) { const p = lateBy(N, eps, m), a = (-TAU * f * m) / fc; re += p * Math.cos(a); im += p * Math.sin(a); }
  return [re, im];
}
// the chip from the input to the held output's smooth part: anti-aliasing, the hold's sinc(f/fc)
// half a cycle late, the transfer loss, N/2 cycles, reconstruction
export function chip({ N, eps, corner, clock }, f) {
  const x = (Math.PI * f) / clock, sinc = x ? Math.sin(x) / x : 1, t = (0.5 + N / 2) / clock;
  let H = cx.mul(butterworth(f, corner), butterworth(f, corner));
  H = cx.mul(H, transfer(N, eps, f, clock));
  return cx.mul(H, [sinc * Math.cos(-TAU * f * t), sinc * Math.sin(-TAU * f * t)]);
}
// the sampling theorem: a tone at f, sampled at fc, is indistinguishable from one at its alias,
// the distance from f to the nearest multiple of fc
export const alias = (f, fc) => Math.abs(f - fc * Math.round(f / fc));
