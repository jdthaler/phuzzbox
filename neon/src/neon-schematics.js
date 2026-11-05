// neon-schematics.js — the Neon Tremolo's diagram (shared/schematic.js), which
// tools/gen-schematics.mjs writes to neon/schematics/ for its README and tour. The parts are
// native/pedals/neon/neon-model.h's.

import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  // the whole: the relaxation oscillator above, its lamp lighting the cell of the divider below
  tremolo() {
    const s = schematic({ w: 34, h: 22, title: 'The Neon Tremolo: a neon lamp flashing across a capacitor, lighting the photocell of a divider' });
    s.terminal([1, 2], '+Vs', { side: 'above' });
    s.resistor([1, 2], [8, 2], { label: 'R', value: 'Rate' });
    s.wire([8, 2], [17, 2]);
    s.dot([11, 2]);
    s.capacitor([11, 2], [11, 7], { label: 'C', value: '100 nF' });
    s.ground([11, 7]);
    s.resistor([17, 2], [23, 2], { label: 'r', value: '10 kΩ' });
    s.wire([23, 2], [25, 2]);
    s.neon([25, 2], [25, 7], { accent: true });
    s.label([26.4, 4.4], 'neon lamp', { anchor: 'start', colour: 'accent' }).label([26.4, 5.1], 'strikes at Vb', { anchor: 'start', size: 11 });
    s.ground([25, 7]);
    s.arrow([24.4, 5.8], [21.4, 14.4], { colour: 'accent', dash: '4 4' });
    s.label([23.6, 10.2], 'its flashes', { anchor: 'start', size: 11 });
    // the signal through the divider
    s.terminal([1, 13], 'in', { side: 'above' });
    s.resistor([1, 13], [12, 13], { label: 'Rs', value: '100 kΩ' });
    s.wire([12, 13], [31, 13]);
    s.dot([20, 13]);
    s.ldr([20, 13], [20, 17], { label: 'cell', accent: true });
    s.pot([20, 17], [20, 20.4], [22.4, 18.7], { label: 'Depth', value: '1 MΩ' });
    s.ground([20, 20.4]);
    s.terminal([31, 13], 'out', { side: 'above' });
    return s.svg();
  },
};
