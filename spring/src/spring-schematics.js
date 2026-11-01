// spring-schematics.js — the Spring Reverb's tank (shared/schematic.js), written to
// spring/schematics/ by tools/gen-schematics.mjs.
import { schematic } from '../../shared/schematic.js';

// a helical spring seen from the side, from x0 to x1 at height y: a zigzag of `turns` coils
function helix(s, x0, x1, y, turns, o = {}) {
  const pts = [[x0, y]];
  for (let i = 0; i < turns; i++) { const a = x0 + ((x1 - x0) * (i + 0.25)) / turns, b = x0 + ((x1 - x0) * (i + 0.75)) / turns; pts.push([a, y - 0.35], [b, y + 0.35]); }
  pts.push([x1, y]);
  s.wire(...pts);
  if (o.label) s.label([(x0 + x1) / 2, y - 0.7], o.label, { size: 11 });
}

export const SCHEMATICS = {
  // the tank: the driver, the drive coil and bead, the springs, the pickup bead and coil, the mix
  circuit() {
    const s = schematic({ w: 32, h: 14, title: 'The Spring Reverb: a drive coil turns a magnetic bead, the springs carry the twist to a second bead, and its coil hears it' });
    s.terminal([1, 4], 'in', { side: 'above' });
    s.dot([2, 4]);
    const drv = s.amp([2, 4], { length: 2.4, label: 'drive' });
    s.wire(drv.out, [6, 4]);
    s.inductor([6, 4], [6, 8], { label: 'drive coil', side: 'left' });
    s.ground([6, 8]);
    // the beads and the springs between them
    const b0 = s.block([7.5, 3], 1.5, 6, { label: 'bead', accent: true });
    const b1 = s.block([23, 3], 1.5, 6, { label: 'bead', accent: true });
    s.arrow([6.6, 7.5], [7.4, 7.5], { colour: 'good' });
    helix(s, 9, 23, 4, 26, { label: 'spring 1' });
    helix(s, 9, 23, 6, 24, { label: 'spring 2' });
    helix(s, 9, 23, 8, 30, { label: 'spring 3' });
    s.label([16, 10.2], 'waves on the coils: twist in, twist out, slower the higher they are', { size: 11 });
    s.arrow([24.6, 7.5], [25.4, 7.5], { colour: 'good' });
    s.inductor([26, 4], [26, 8], { label: 'pickup coil' });
    s.ground([26, 8]);
    s.wire([26, 4], [27, 4]);
    const rec = s.amp([27, 4], { length: 2.4, label: 'reverb' });
    // the dry path and the mix
    s.wire([2, 4], [2, 12.5], [30.5, 12.5], [30.5, 6.5]);
    s.wire(rec.out, [30.5, 4], [30.5, 6.5]);
    s.dot([30.5, 6.5]);
    s.label([16, 12.1], 'dry', { size: 11 });
    s.terminal([31.5, 6.5], 'out', { side: 'above' });
    s.wire([30.5, 6.5], [31.5, 6.5]);
    return s.svg();
  },
};
