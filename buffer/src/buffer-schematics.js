// buffer-schematics.js — the Buffer's circuit diagram (shared/schematic.js), which
// tools/gen-schematics.mjs writes to buffer/schematics/ for its README and tour.

import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  // the pickup and what it plugs into: EMF e behind the coil's R and L, across C (the coil's own,
  // the cable's, the input's) and Rₗ (the bass's pots and the input it plugs into)
  pickup() {
    const s = schematic({ w: 32, h: 13, title: 'The pickup and what it plugs into' });
    s.label([8.5, 1.2], 'the pickup', { colour: 'ink2' });
    s.label([21.5, 1.2], 'cable and input', { colour: 'ink2' });
    s.block([0.5, 1.8], 15, 9.2, { colour: 'line', dash: '5 4' });
    const e = s.block([2, 5], 2, 3, { label: 'e' });
    s.wire(e.top, [3, 3]);
    s.resistor([3, 3], [8, 3], { label: 'R', value: '10.5 kΩ' });
    s.inductor([8, 3], [14, 3], { label: 'L', value: '3.6 H' });
    s.wire([14, 3], [29, 3]);
    s.wire(e.bottom, [3, 10], [29, 10]);
    s.ground([22, 10]);
    s.capacitor([18, 3], [18, 10], { label: 'C', value: 'coil, cable, input', accent: true });
    s.resistor([25, 3], [25, 10], { label: 'Rₗ', value: 'pots ∥ input' });
    s.dot([18, 3]).dot([25, 3]).dot([18, 10]).dot([25, 10]).dot([22, 10]);
    s.terminal([29, 3], 'v', { side: 'right' });
    s.label([16, 12.4], 'v / e = 1 / (LC s² + (RC + L/Rₗ) s + 1 + R/Rₗ)', { colour: 'ink', size: 12 });
    return s.svg();
  },
};
