// sabine-circuit.mjs — Sabine's Room worked out independently of the C++, for the tests: the
// surfaces' coefficients typed again from Hall's Table 15.1; the air's absorption from ISO 9613-1
// (openair-circuit.mjs); Sabine's and Eyring's formulas; and the images, found by mirroring the bass
// in the room's walls again and again (each image in each wall it was not last mirrored in) and
// keeping each place once, rather than by Allen and Berkley's lattice, as the C++ does.

import { iso } from './openair-circuit.mjs';

export const CENTRES = [125, 250, 500, 1000, 2000, 4000];
export const C0 = 343.2; // m/s at 20 °C
export const WALL = {
  concrete: [0.01, 0.01, 0.02, 0.02, 0.02, 0.03],
  block: [0.10, 0.05, 0.06, 0.07, 0.10, 0.10],
  plaster: [0.20, 0.15, 0.10, 0.05, 0.04, 0.05],
  glass: [0.20, 0.06, 0.04, 0.03, 0.02, 0.02],
  drapes: [0.07, 0.30, 0.50, 0.70, 0.70, 0.60],
};
export const FLOOR = {
  wood: [0.40, 0.30, 0.20, 0.20, 0.15, 0.10],
  carpet: [0.02, 0.06, 0.15, 0.40, 0.60, 0.60],
  concrete: [0.01, 0.01, 0.02, 0.02, 0.02, 0.03],
};
export const AUDIENCE = [0.40, 0.60, 0.80, 0.90, 0.90, 0.90];

// the room the knobs make: its size, its surfaces' coefficients (x = 0, x = L, y = 0, y = W, the
// floor, the ceiling) and areas, the air's intensity attenuation per metre, and where the bass and
// you are (README: The room)
export function room(P) {
  const L = P.length, W = P.width, H = P.height, a = P.audience / 100;
  const wall = WALL[P.walls], floor = CENTRES.map((_, b) => a * AUDIENCE[b] + (1 - a) * FLOOR[P.floor][b]);
  const alpha = [wall, wall, wall, wall, floor, wall];
  const area = [W * H, W * H, L * H, L * H, L * W, L * W];
  const m = CENTRES.map((f) => iso(f, 293.15, P.humidity) / (10 * Math.log10(Math.E)));
  const z = Math.min(1.2, H / 2), src = [0.2 * L, 0.42 * W, z];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const rcv = [clamp(src[0] + 0.96 * P.distance, 0.5, L - 0.5), clamp(src[1] + 0.28 * P.distance, 0.5, W - 0.5), z];
  const V = L * W * H, S = area.reduce((s, v) => s + v, 0);
  return { L, W, H, alpha, area, m, src, rcv, V, S, d: Math.hypot(rcv[0] - src[0], rcv[1] - src[1]) };
}

// absorption area A = Σ S α + 4 m V (m²); Sabine's T = 55.26 V/(c A); Eyring's with −S ln(1 − ᾱ)
export const absorbed = (R, b) => R.alpha.reduce((s, a, k) => s + R.area[k] * a[b], 0);
export const A = (R, b) => absorbed(R, b) + 4 * R.m[b] * R.V;
export const sabine = (R, b) => (24 * Math.log(10) * R.V) / (C0 * A(R, b));
export const eyring = (R, b) => (24 * Math.log(10) * R.V) / (C0 * (-R.S * Math.log(1 - absorbed(R, b) / R.S) + 4 * R.m[b] * R.V));
// the critical distance, where the reverberant field (4/A of the power) is as strong as the direct
// sound (1/(4π r²)): √(A/16π)
export const critical = (R, b) => Math.sqrt(A(R, b) / (16 * Math.PI));

// the images within `reach` of you: each [r, order, gains per band]. Mirroring an image in a wall is
// x → 2·wall − x along that wall's axis; the counts of reflections from each surface go with it.
export function images(R, reach) {
  const walls = [[0, 0], [0, R.L], [1, 0], [1, R.W], [2, 0], [2, R.H]];
  const key = (p) => p.map((v) => Math.round(v * 1e6)).join(',');
  const seen = new Map();
  let front = [{ p: R.src, n: [0, 0, 0, 0, 0, 0], last: -1 }];
  seen.set(key(R.src), front[0]);
  const dist = (p) => Math.hypot(p[0] - R.rcv[0], p[1] - R.rcv[1], p[2] - R.rcv[2]);
  // an image further than reach + the room's diagonal can't have a child within reach that some
  // nearer chain doesn't also reach, so it is pruned
  const diag = Math.hypot(R.L, R.W, R.H);
  while (front.length) {
    const next = [];
    for (const im of front) {
      walls.forEach(([axis, at], k) => {
        if (k === im.last) return;
        const p = im.p.slice();
        p[axis] = 2 * at - p[axis];
        const kk = key(p);
        if (seen.has(kk) || dist(p) > reach + 2 * diag) return;
        const n = im.n.slice();
        n[k]++;
        const child = { p, n, last: k };
        seen.set(kk, child);
        next.push(child);
      });
    }
    front = next;
  }
  const out = [];
  for (const im of seen.values()) {
    const r = dist(im.p);
    if (r > reach) continue;
    const gains = CENTRES.map((_, b) => {
      let g = Math.exp(-0.5 * R.m[b] * r) / r;
      im.n.forEach((c, k) => { g *= Math.sqrt(1 - R.alpha[k][b]) ** c; });
      return g;
    });
    out.push([r, im.n.reduce((s, v) => s + v, 0), gains]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

// the diffuse field's power t after the bass sounds, relative to the direct sound's a metre away:
// 4π c/V e^(−13.8 t/T) per second of arrivals (each image 1/(c t)² strong, 4π (c t)² c dt/V of them)
export const diffuse = (R, T, t) => ((4 * Math.PI * C0) / R.V) * Math.exp((-6 * Math.log(10) * t) / T);
