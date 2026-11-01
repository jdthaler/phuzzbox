// plate-motion.js — the Plate Reverb's slow motion (The plate, plate-main.js): the engine's own
// modes (plate-engine.cpp), played here a sample at a time, and the plate's velocity they make
// everywhere on it. Kept apart from the page so test/plate-tests.mjs can check it against the
// engine.
//
// Mode (m, n) is sin(mπx/Lx) sin(nπy/Ly). The engine drives it with b = g T Φ_d / M (M = ρh Lx Ly/4,
// g the transducers' gain, Φ_d its shape at the driver) and reads its velocity as z_r − (α/ω_d) z_i
// (Engine::tune); the plate's velocity at (x, y) is the sum of those times each mode's shape there.
// The engine plays the low modes at a quarter of the sample rate and the rest at half, between
// filters that only delay them (by `delay` samples); here every mode is played at the full rate.

import { scratch } from '../../shared/wasm.js';
import { Bank } from '../../shared/motion.js';

export const LX = 2, LY = 1, MASS = (7850 * 0.5e-3 * LX * LY) / 4; // plate-model.h
export const GX = 192, GY = 96;                                     // the picture's grid

// the modes the engine plays (plate_modes), their decay rates (plate_decay) and the gain (plate_info)
export function plateModes(model, Effect, P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  model.plate_info(s.at);
  const info = Array.from(s.f64(5));
  const modes = [];
  const CH = 2000;
  for (let from = 0; ; from += CH) {
    s.f64(v.length).set(v);
    const count = model.plate_modes(s.at, from, CH);
    const o = s.f64(3 * CH);
    for (let i = 0; i < Math.min(CH, count - from); i++) modes.push({ m: o[3 * i], n: o[3 * i + 1], f: o[3 * i + 2] });
    if (from + CH >= count) break;
  }
  const DC = 1500; // the decay rates: 3 ln 10 / T60 at each mode's frequency
  for (let a = 0; a < modes.length; a += DC) {
    const part = modes.slice(a, a + DC);
    s.f64(v.length + part.length).set([...v, ...part.map((q) => q.f)]);
    model.plate_decay(s.at, part.length);
    const t60 = s.f64(part.length, 8 * (v.length + part.length + 3 * part.length));
    part.forEach((q, i) => { q.alpha = (3 * Math.log(10)) / t60[i]; });
  }
  return { modes, gain: info[4], delay: info[2] };
}

const shapeAt = (q, x, y) => Math.sin((q.m * Math.PI * x) / LX) * Math.sin((q.n * Math.PI * y) / LY);

// The bank at rate fs with the transducers where P has them, and the plate's velocity on the grid.
export function plateBank(plate, fs, P) {
  const T = 1 / fs, { modes } = plate, n = modes.length;
  const pr = new Float64Array(n), pi = new Float64Array(n), cr = new Float64Array(n), ci = new Float64Array(n), e = new Float64Array(n);
  modes.forEach((q, j) => {
    const w = 2 * Math.PI * q.f, wd = Math.sqrt(Math.max(1e-9, w * w - q.alpha * q.alpha)), r = Math.exp(-q.alpha * T);
    pr[j] = r * Math.cos(wd * T); pi[j] = r * Math.sin(wd * T); e[j] = q.alpha / wd;
  });
  const bank = new Bank(pr, pi, cr, ci);
  const wl = new Float64Array(n), wr = new Float64Array(n);
  const place = (Q) => {
    modes.forEach((q, j) => {
      cr[j] = (plate.gain * T * shapeAt(q, Q.driveX, Q.driveY)) / MASS;
      wl[j] = shapeAt(q, Q.leftX, Q.leftY); wr[j] = shapeAt(q, Q.rightX, Q.rightY);
    });
  };
  place(P);
  // the grid's sines, and the modes grouped by m for the separable sum
  const ms = [...new Set(modes.map((q) => q.m))].sort((a, b) => a - b), mIndex = new Map(ms.map((m, i) => [m, i]));
  const sx = ms.map((m) => Float64Array.from({ length: GX }, (_, i) => Math.sin((m * Math.PI * (i + 0.5)) / GX)));
  const nmax = Math.max(1, ...modes.map((q) => q.n));
  const sy = Array.from({ length: nmax + 1 }, (_, nn) => Float64Array.from({ length: GY }, (_, j) => Math.sin((nn * Math.PI * (j + 0.5)) / GY)));
  const rows = ms.map(() => new Float64Array(GY));
  const u = (j) => bank.zr[j] - e[j] * bank.zi[j];
  return {
    bank, place,
    // the plate's velocity at GX × GY points, row by row from the bottom edge up
    field(out) {
      for (const r of rows) r.fill(0);
      for (let j = 0; j < n; j++) {
        const a = u(j);
        if (a === 0) continue;
        const r = rows[mIndex.get(modes[j].m)], s = sy[modes[j].n];
        for (let y = 0; y < GY; y++) r[y] += a * s[y];
      }
      out.fill(0);
      for (let k = 0; k < ms.length; k++) {
        const r = rows[k], s = sx[k];
        for (let y = 0; y < GY; y++) { const ry = r[y]; if (ry === 0) continue; const o = y * GX; for (let x = 0; x < GX; x++) out[o + x] += ry * s[x]; }
      }
      return out;
    },
    // what the pickups hear now, before the engine's filters
    pickups() { let l = 0, r = 0; for (let j = 0; j < n; j++) { const a = u(j); l += wl[j] * a; r += wr[j] * a; } return [l, r]; },
  };
}
