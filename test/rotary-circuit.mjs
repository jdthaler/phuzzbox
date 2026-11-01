// rotary-circuit.mjs — the Rotary Speaker's physics written out independently of the C++
// (native/pedals/rotary): J1 by its power series, the piston's pattern, the retarded time by
// bisection, and the Linkwitz–Riley crossover's closed form.

export const C = 343;

// J1(x) = Σ (−1)^m (x/2)^(2m+1) / (m! (m+1)!)
export function j1(x) {
  let term = x / 2, sum = term;
  for (let m = 1; m < 80; m++) { term *= -(x * x) / 4 / (m * (m + 1)); sum += term; if (Math.abs(term) < 1e-17 * Math.abs(sum)) break; }
  return sum;
}
// a rigid circular piston of radius a in a baffle, at sin θ = s off its axis: 2 J1(x)/x, x = k a s
export const piston = (f, a, s) => { const x = (2 * Math.PI * f * a * s) / C; return x < 1e-9 ? 1 : (2 * j1(x)) / x; };

// The retarded time: a source on a circle of radius r at angle alpha(t) = alpha0 + w t heard at a
// microphone at (mx, my) at time t: the te < t with t − te = |M − X(te)| / c, by bisection.
export function retarded(t, { mx, my, r, w, alpha0 = 0 }) {
  const gap = (te) => { const a = alpha0 + w * te; return t - te - Math.hypot(mx - r * Math.cos(a), my - r * Math.sin(a)) / C; };
  let lo = t - (Math.hypot(mx, my) + r + 1) / C, hi = t;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (gap(mid) > 0) lo = mid; else hi = mid; }
  const te = (lo + hi) / 2, a = alpha0 + w * te;
  const dx = mx - r * Math.cos(a), dy = my - r * Math.sin(a), dist = Math.hypot(dx, dy);
  return { te, dist, cosTheta: (dx * Math.cos(a) + dy * Math.sin(a)) / dist };
}

// The Linkwitz–Riley crossover's halves, second order: low 1/(1 + s/(Q wc))…: |L|² = |H|² where
// each is a Butterworth first order squared, so |low| = 1/(1 + (f/fc)²) and |high| = (f/fc)²/(1 + (f/fc)²)
export const lowGain = (f, fc) => 1 / (1 + (f / fc) ** 2);
export const highGain = (f, fc) => (f / fc) ** 2 / (1 + (f / fc) ** 2);
