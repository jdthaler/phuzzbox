// ringmod-schematics.js — the Ring Modulator's circuit diagram (shared/schematic.js), which
// tools/gen-schematics.mjs writes to ringmod/schematics/ for its README and tour. The parts are
// native/pedals/ringmod/ringmod-model.cpp's.

import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  // the ring drawn as a square: A (T1's top end) → D1 → C (T2's top) → D2 → B (T1's bottom) → D3 →
  // D (T2's bottom) → D4 → A; the carrier into T1's centre tap, T2's centre tap grounded
  ring() {
    const s = schematic({ w: 35, h: 17, title: 'The Ring Modulator: four diodes in a ring between two centre-tapped transformers' });
    // the bass, through 600 Ω, into T1's primary
    s.terminal([1, 4], 'in', { side: 'above' });
    s.resistor([1, 4], [4, 4], { label: 'Rs', value: '600 Ω' });
    s.inductor([4, 4], [4, 12], {});
    s.ground([4, 12]);
    // T1's secondary, two halves with a centre tap
    s.inductor([6, 4], [6, 8], {}).inductor([6, 8], [6, 12], {});
    s.wire([4.85, 4.6], [4.85, 11.4]).wire([5.15, 4.6], [5.15, 11.4]);
    s.label([5, 2.9], 'T1', { colour: 'ink' });
    // the ring
    s.wire([6, 4], [12, 4]);
    s.diode([12, 4], [20, 4], { label: 'D1', accent: true });
    s.diode([20, 4], [20, 10], { label: 'D2', accent: true });
    s.diode([20, 10], [12, 10], { label: 'D3', accent: true, side: 'below' });
    s.diode([12, 10], [12, 4], { label: 'D4', accent: true, side: 'left' });
    s.label([10.6, 3.4], 'A').label([20.9, 3.4], 'C').label([21, 10.9], 'B').label([11.1, 10.9], 'D');
    s.dot([12, 4]).dot([20, 4]).dot([20, 10]).dot([12, 10]);
    // B back to T1's bottom end, D across to T2's: the one crossing
    s.wire([20, 10], [20, 13], [6, 13], [6, 12]);
    s.wire([12, 10], [12, 12], [24, 12]);
    // the carrier, through 470 Ω, into T1's centre tap
    s.wire([6, 8], [8, 8]);
    s.resistor([8, 8], [8, 12], { label: 'Rc', value: '470 Ω' });
    s.wire([8, 12], [8, 15]);
    s.terminal([8, 15], 'carrier', { side: 'below' });
    // T2: its primary's halves, the centre tap to ground, its secondary into the load
    s.wire([20, 4], [24, 4]);
    s.inductor([24, 4], [24, 8], {}).inductor([24, 8], [24, 12], {});
    s.wire([24, 8], [22.5, 8]);
    s.ground([22.5, 8]);
    s.inductor([26, 4], [26, 12], {});
    s.wire([24.85, 4.6], [24.85, 11.4]).wire([25.15, 4.6], [25.15, 11.4]);
    s.label([25, 2.9], 'T2', { colour: 'ink' });
    s.wire([26, 4], [30, 4]);
    s.resistor([30, 4], [30, 12], { label: 'RL', value: '600 Ω' });
    s.wire([26, 12], [30, 12]);
    s.ground([30, 12]);
    s.wire([30, 4], [33, 4]);
    s.dot([30, 4]);
    s.terminal([33, 4], 'out', { side: 'above' });
    s.label([16, 15.6], 'D1–D4: germanium · Schottky · silicon', { size: 11 });
    return s.svg();
  },
};
