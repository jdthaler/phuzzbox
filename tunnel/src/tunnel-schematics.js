// tunnel-schematics.js — the Tunnel Diode's circuit diagram (shared/schematic.js), which
// tools/gen-schematics.mjs writes to tunnel/schematics/ for its README and tour. The parts are
// native/pedals/tunnel/tunnel-model.h's.

import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  // the source through the load (and in the oscillator the inductor) into the diode
  circuit() {
    const s = schematic({ w: 26, h: 13, title: 'The Tunnel Diode: the source through the load, and in the oscillator an inductor, into the diode' });
    s.terminal([1, 3], 'Vs', { side: 'above' });
    s.label([1, 5.4], 'Bias +', { anchor: 'start', size: 11 }).label([1, 6.4], 'Drive × in', { anchor: 'start', size: 11 });
    s.resistor([1, 3], [8, 3], { label: 'R', value: 'Load' });
    s.inductor([8, 3], [15, 3], { label: 'L', value: 'the oscillator\'s' });
    s.wire([15, 3], [24, 3]);
    s.dot([17, 3]);
    s.diode([17, 3], [17, 10], { label: 'D', value: '1 mA Ge', tunnel: true, accent: true });
    s.ground([17, 10]);
    s.dot([21, 3]);
    s.capacitor([21, 3], [21, 10], { label: 'C', value: '5 pF' });
    s.ground([21, 10]);
    s.terminal([24, 3], 'V out', { side: 'above' });
    s.label([12, 12.4], 'Switch: L shorted. Oscillator: L in series, R under 152 Ω.', { size: 11 });
    return s.svg();
  },
};
