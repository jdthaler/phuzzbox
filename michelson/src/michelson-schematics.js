// michelson-schematics.js — the Michelson Interferometer's layout (shared/schematic.js), which
// tools/gen-schematics.mjs writes to michelson/schematics/ for its README and tour.

import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  // the light's two paths: split, reflected, recombined on the detector; one mirror on the actuator
  bench() {
    const s = schematic({ w: 30, h: 19, title: 'The interferometer: a beam split into two arms, one mirror moved by the bass' });
    // the source and the beam to the splitter
    s.block([1, 8.5], 5, 2, { label: 'light' });
    s.arrow([6, 9.5], [12.6, 9.5], { colour: 'accent' });
    // the beam splitter: a half-silvered plate at 45°
    s.wire([12.6, 10.9], [15.4, 8.1]);
    s.label([16.2, 11.6], 'beam splitter', { anchor: 'start', size: 11 });
    // the fixed arm, to the right
    s.arrow([14, 9.5], [24.6, 9.5], { colour: 'accent' });
    s.block([24.8, 7.5], 0.6, 4, {});
    s.label([26.2, 9.9], 'fixed mirror', { anchor: 'start', size: 11 });
    s.label([19.5, 8.8], 'arm 1', { size: 11 });
    // the moving arm, up, its mirror on the actuator your bass drives
    s.arrow([14, 9.5], [14, 3.4], { colour: 'accent' });
    s.block([12, 2.6], 4, 0.6, { accent: true });
    s.block([12, 0.6], 4, 1.6, { label: 'actuator', accent: true });
    s.label([14.8, 6.4], 'arm 2', { anchor: 'start', size: 11 });
    s.label([16.6, 3.2], 'mirror: moves x', { anchor: 'start', size: 11, colour: 'accent' });
    s.terminal([24, 1.4], 'in', { side: 'above' });
    s.wire([24, 1.4], [16, 1.4]);
    // the two beams recombined, down to the detector
    s.arrow([14, 9.5], [14, 14.6], { colour: 'accent' });
    s.block([12, 14.6], 4, 2, { label: 'photodiode' });
    s.wire([16, 15.6], [24, 15.6]);
    s.terminal([24, 15.6], 'out', { side: 'above' });
    s.label([1, 17.9], 'paths differ by 2 (d + x): bright when that is a whole number of wavelengths', { anchor: 'start', size: 11 });
    return s.svg();
  },
};
