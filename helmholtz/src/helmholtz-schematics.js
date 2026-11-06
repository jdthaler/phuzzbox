// helmholtz-schematics.js — Helmholtz's Resonators' drawing (shared/schematic.js), written to
// helmholtz/schematics/ by tools/gen-schematics.mjs: a glass sphere with its neck towards the sound and
// its second opening at the ear, and the same as a mass on a spring.
import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  sphere() {
    const s = schematic({ w: 34, h: 15, title: 'A Helmholtz resonator: a glass sphere of volume V whose short neck of radius r faces the sound, the air in the neck a mass moving on the spring of the air inside, and a second opening held to the ear; beside it, the same as a mass on a spring driven by the pressure outside' });
    // the sphere, as a ring of short wires
    const cx = 11, cy = 7.5, R = 4.2, pts = [];
    for (let k = 0; k <= 64; k++) {
      const t = (2 * Math.PI * k) / 64;
      if (Math.abs(Math.sin(t)) < 0.2 && Math.cos(t) < 0) { if (pts.length > 1) s.wire(...pts); pts.length = 0; continue; }
      if (Math.abs(Math.sin(t)) < 0.12 && Math.cos(t) > 0) { if (pts.length > 1) s.wire(...pts); pts.length = 0; continue; }
      pts.push([cx + R * Math.cos(t), cy + R * Math.sin(t)]);
    }
    if (pts.length > 1) s.wire(...pts);
    // the neck towards the sound, at the left
    s.wire([cx - R * 0.98, cy - 0.85], [cx - R - 1.2, cy - 0.85]); s.wire([cx - R * 0.98, cy + 0.85], [cx - R - 1.2, cy + 0.85]);
    s.block([cx - R - 1.1, cy - 0.7], 1.2, 1.4, { colour: 'accent' });
    s.label([cx - R - 1.6, cy - 2.4], 'neck: r, ℓ', { size: 11 });
    s.label([cx, cy + 0.2], 'V', { size: 13 });
    s.label([cx, cy + 5.6], 'glass sphere', { size: 11 });
    // the second opening, to the ear
    s.wire([cx + R, cy - 0.5], [cx + R + 1.4, cy - 0.5]); s.wire([cx + R, cy + 0.5], [cx + R + 1.4, cy + 0.5]);
    s.label([cx + R + 1.7, cy + 0.1], 'ear', { anchor: 'start', size: 11 });
    // the sound outside
    for (const dy of [-1.6, 0, 1.6]) s.arrow([1.2, cy + dy], [cx - R - 1.8, cy + dy * 0.5], { colour: 'ink2' });
    s.label([1.2, cy - 2.6], 'pex', { anchor: 'start', size: 11 });
    // the same as a mass on a spring
    const mx = 26;
    s.label([mx + 1, 1.6], 'the same, a mass on a spring', { size: 11 });
    s.block([mx - 1.5, 6.4], 2.2, 2.2, { colour: 'accent' });
    s.label([mx - 0.4, 7.7], 'm', { size: 12 });
    s.label([mx - 0.4, 10.2], 'ρ(ℓ + 2δ)Sn', { size: 10 });
    const coil = [];
    for (let k = 0; k <= 24; k++) coil.push([mx + 0.7 + (3.2 * k) / 24, 7.5 + (k % 2 ? -0.6 : 0.6) * (k > 0 && k < 24 ? 1 : 0)]);
    s.wire(...coil);
    s.wire([mx + 3.9, 5.5], [mx + 3.9, 9.5]);
    s.label([mx + 2.3, 5.6], 'ρc²Sn²/V', { size: 10 });
    s.arrow([mx - 5.5, 7.5], [mx - 1.6, 7.5], { colour: 'ink2' });
    s.label([mx - 5.6, 6.6], 'pex Sn', { anchor: 'start', size: 10 });
    s.label([mx + 1, 13.4], 'ω0² = Sn c²/((ℓ + 2δ) V)', { size: 11 });
    return s.svg();
  },
};
