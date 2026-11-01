// spring-motion.js — the Spring Reverb's slow motion (The springs, spring-main.js): the engine's
// own modes (spring-engine.cpp), played here a sample at a time, and the field they make along
// each spring. Kept apart from the page so test/spring-tests.mjs can check it against the engine.
//
// Mode m of spring s is a standing wave k = nπ/L whose share of the far bead's angular velocity is
// Re z_m (its weight carries the far end's sign (−1)ⁿ). The wire's cross-section turns as
// cos(ks) along it (spring-model.h: u ∝ sin ks, v ∝ cos ks, ψ = ∂ₛu + εv), so at s along the
// spring mode m turns it at Re z_m · (−1)ⁿ cos(nπs/L), which at s = L is Re z_m again: the
// pickup hears the sum of every spring's field at its far end.

import { scratch } from '../../shared/wasm.js';
import { Bank } from '../../shared/motion.js';

export const POINTS = 121; // along each spring

// the tank as the engine builds it: its springs (spring_info) and every mode (spring_modes)
export function tankModes(model, Effect, P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  model.spring_info(s.at);
  const o = Array.from(s.f64(26, 8 * v.length)), springs = [];
  for (let k = 0; k < 3; k++) { const q = o.slice(1 + 8 * k, 9 + 8 * k); springs.push({ L: q[0], TD: q[3], Fc: q[4], c0: q[5] }); }
  const count = o[0], total = o[25], modes = [];
  const CH = 1000;
  for (let m0 = 0; m0 < total; m0 += CH) {
    s.f64(v.length + 1).set([...v, m0]);
    model.spring_modes(s.at, CH);
    const out = s.f64(1 + 6 * CH, 8 * (v.length + 1));
    for (let i = 0; i < CH && m0 + i < total; i++) {
      modes.push({ spring: out[1 + i], n: out[1 + CH + i], f: out[1 + 2 * CH + i], w: out[1 + 4 * CH + i], sigma: out[1 + 5 * CH + i] });
    }
  }
  return { count, springs, modes };
}

// The bank at rate fs, as the engine tunes it (Engine::tune): the impulse invariant of each mode,
// p = e^{(−σ + iω_d)T}, c = T w (1 + iσ/ω_d); and the field along spring k at POINTS points.
export function springBank(tank, fs) {
  const T = 1 / fs, live = tank.modes.filter((q) => q.sigma < 2 * Math.PI * q.f);
  const n = live.length, pr = new Float64Array(n), pi = new Float64Array(n), cr = new Float64Array(n), ci = new Float64Array(n);
  live.forEach((q, j) => {
    const w = 2 * Math.PI * q.f, wd = Math.sqrt(w * w - q.sigma * q.sigma), a = Math.exp(-q.sigma * T);
    pr[j] = a * Math.cos(wd * T); pi[j] = a * Math.sin(wd * T);
    cr[j] = T * q.w; ci[j] = (T * q.w * q.sigma) / wd;
  });
  const bank = new Bank(pr, pi, cr, ci);
  // each spring's modes, and their shapes (−1)ⁿ cos(nπs/L) at the points
  const of = Array.from({ length: tank.count }, () => []);
  live.forEach((q, j) => of[q.spring]?.push(j));
  const shapes = of.map((js) => {
    const t = new Float64Array(js.length * POINTS);
    js.forEach((j, r) => { const nn = live[j].n, sign = nn % 2 ? -1 : 1; for (let i = 0; i < POINTS; i++) t[r * POINTS + i] = sign * Math.cos((Math.PI * nn * i) / (POINTS - 1)); });
    return t;
  });
  return {
    bank,
    // how fast the wire of spring k turns at each point, from the drive bead (0) to the pickup's (POINTS − 1)
    field(k, out) {
      out.fill(0);
      const js = of[k], t = shapes[k], zr = bank.zr;
      for (let r = 0; r < js.length; r++) { const a = zr[js[r]]; if (a === 0) continue; const o = r * POINTS; for (let i = 0; i < POINTS; i++) out[i] += a * t[o + i]; }
      return out;
    },
    // what the pickup hears now: every mode at the far end
    pickup() { let y = 0; for (const a of bank.zr) y += a; return y; },
  };
}
