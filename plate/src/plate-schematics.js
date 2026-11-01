// plate-schematics.js — the Plate Reverb's plate from above (shared/schematic.js), written to
// plate/schematics/ by tools/gen-schematics.mjs. Drawn to scale: 12 units to the metre.
import { schematic } from '../../shared/schematic.js';

const U = 12, X0 = 2, Y0 = 2.5;
const at = ([x, y]) => [X0 + U * x, Y0 + U * y];

export const SCHEMATICS = {
  // the plate, the driver, the two pickups, the damper behind
  plate() {
    const s = schematic({ w: 28, h: 18.5, title: 'The Plate Reverb from above: a steel plate 2 m by 1 m, its driver, two pickups and the damper behind it' });
    s.block([X0 + 0.6, Y0 + 0.6], 2 * U, U, { dash: '5 5', colour: 'ink2' });
    s.label([X0 + 0.6 + U, Y0 + U + 1.6], 'the damper behind it: a porous mat (Decay)', { size: 11 });
    s.block([X0, Y0], 2 * U, U, {});
    s.label([X0 + U, Y0 - 0.8], 'steel 2 m × 1 m × 0.5 mm, its edges held', { size: 12, colour: 'ink' });
    const d = at([0.8, 0.415]), l = at([0.2, 0.45]), r = at([1.7, 0.45]);
    s.arrow(d, [l[0] + 0.5, l[1]], { dash: '4 4' });
    s.arrow(d, [r[0] - 0.5, r[1]], { dash: '4 4' });
    s.dot(d); s.dot(l); s.dot(r);
    s.label([d[0], d[1] - 1], 'driver', { colour: 'accent', weight: 600 });
    s.label([l[0], l[1] + 1.6], 'pickup L', { colour: 'ink', weight: 600 });
    s.label([r[0], r[1] + 1.6], 'pickup R', { colour: 'ink', weight: 600 });
    s.label([(d[0] + l[0]) / 2, l[1] + 3.2], '0.60 m', { size: 11 });
    s.label([(d[0] + r[0]) / 2, r[1] + 3.2], '0.90 m', { size: 11 });
    s.label([14, 17.6], 'bending waves: 4 kHz at 277 m/s, 1 kHz at 139 m/s', { size: 11 });
    return s.svg();
  },
};
