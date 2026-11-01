// doppler-circuit.mjs — the Doppler's physics written independently of the C++
// (native/pedals/doppler): the retarded times found by bisection on the light-cone condition,
// rather than the quadratic; the moving point source's field summed over them; the textbook
// Doppler formulas and the Mach cone's geometry.

export const EAR = 0.0875;
// the speed of sound in dry air from the ideal gas, √(γ R T / M): γ = 1.4, R = 8.314462618, M = 0.0289647 kg/mol
export const sound = (celsius) => Math.sqrt((1.4 * 8.314462618 * (273.15 + celsius)) / 0.0289647);

// Where things are: the source at x_s(τ) = u·t_mid + v (τ − t_mid) on the road (y = d), an ear at
// x = u t + e (y = 0); t measured from the pass's middle, so t_mid = 0.
const xs = (p, tau) => p.v * tau;
const xl = (p, t, e) => p.u * t + e;
// the light-cone condition for sound sent at τ and heard at t: c (t − τ) − |path| (zero on a root)
const F = (p, t, e, tau) => p.c * (t - tau) - Math.hypot(xs(p, tau) - xl(p, t, e), p.d);

// every τ < t with F = 0, by scanning back from t and bisecting each sign change
export function retarded(p, t, e = 0, { back = 30, steps = 60000 } = {}) {
  const out = [];
  let a = t, fa = F(p, t, e, a);
  for (let i = 1; i <= steps; i++) {
    const b = t - (back * i) / steps, fb = F(p, t, e, b);
    if (Math.sign(fa) !== Math.sign(fb)) {
      let lo = b, hi = a, flo = fb;
      for (let k = 0; k < 200 && hi - lo > 1e-15 * Math.max(1, Math.abs(t)); k++) {
        const m = 0.5 * (lo + hi), fm = F(p, t, e, m);
        if (Math.sign(fm) === Math.sign(flo)) { lo = m; flo = fm; } else hi = m;
      }
      out.push(0.5 * (lo + hi));
    }
    a = b; fa = fb;
  }
  return out; // latest first
}

// the field at an ear at time t from a source of strength q(τ): Σ q(τ) d / (R |1 − M_r|), over every
// retarded time, R the path and M_r the source's speed toward the ear over c (the moving point
// source of the wave equation, normalised to q at distance d)
export function field(p, t, e, q, roots = retarded(p, t, e)) {
  let y = 0;
  for (const tau of roots) {
    const dx = xl(p, t, e) - xs(p, tau), R = Math.hypot(dx, p.d), Mr = (p.v * dx) / R / p.c;
    y += (q(tau) * p.d) / (R * Math.abs(1 - Mr));
  }
  return y;
}

// The textbook Doppler shift for sound sent from where the source was at τ: the source moving at v
// and the listener at u along x, each relative to still air, cos θ the direction cosines along x of
// the path from source to listener: f_heard / f_sent = (1 − u cos θ / c) / (1 − v cos θ / c)
export function shift(p, t, e, tau) {
  const dx = xl(p, t, e) - xs(p, tau), cos = dx / Math.hypot(dx, p.d);
  return (1 - (p.u * cos) / p.c) / (1 - (p.v * cos) / p.c);
}

// The Mach cone (v > c): the source is X = d √(M² − 1) past the ear when the cone reaches it
export const coneLag = (p) => (p.d * Math.sqrt((p.v / p.c) ** 2 - 1)) / (p.v - p.u);
