// phuzz-schematics.js — the Phuzz's circuit diagram (shared/schematic.js), which
// tools/gen-schematics.mjs writes to phuzz/schematics/ for its README and tour. The parts are
// native/pedals/phuzz/phuzz-model.h's.

import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  // the whole fuzz: two PNP germanium transistors, positive ground, the battery's − the rail
  circuit() {
    const s = schematic({ w: 37, h: 23, title: 'The Phuzz: two germanium PNP transistors' });
    // the rail: the battery's −, its + is ground
    s.wire([12.4, 1.5], [20.4, 1.5]);
    s.label([11.6, 1.9], '−9 V', { anchor: 'end', colour: 'ink' });
    // the input, its coupling capacitor, and Q1
    s.terminal([1, 12], 'in', { side: 'above' });
    s.capacitor([1, 12], [7, 12], { label: 'C1', value: '2.2 µF' });
    s.wire([7, 12], [10, 12]);
    const q1 = s.npn([12, 12], { pnp: true, label: 'Q1', accent: true });
    s.ground(q1.emitter);
    s.wire(q1.collector, [12.4, 8.5]);
    s.resistor([12.4, 8.5], [12.4, 1.5], { label: 'R1', value: '33 kΩ' });
    // Q1's collector drives Q2's base directly
    const q2 = s.npn([20, 12], { pnp: true, label: 'Q2', accent: true });
    s.wire([12.4, 8.5], [16, 8.5], [16, 12], q2.base);
    s.dot([12.4, 8.5]);
    // Q2's collector load: R3, then R2 to the rail, and the output's coupling capacitor from between
    s.wire(q2.collector, [20.4, 9]);
    s.resistor([20.4, 9], [20.4, 5], { label: 'R3', value: '8.2 kΩ' });
    s.resistor([20.4, 5], [20.4, 1.5], { label: 'R2', value: '470 Ω' });
    s.dot([20.4, 5]);
    s.capacitor([20.4, 5], [27, 5], { label: 'C3', value: '10 nF' });
    s.wire([27, 5], [29, 5]);
    s.pot([29, 5], [29, 13], [32, 9], { label: 'Volume', value: '500 kΩ' });
    s.ground([29, 13]);
    s.wire([32, 9], [34, 9]);
    s.terminal([34, 9], 'out', { side: 'above' });
    // Q2's emitter: the Fuzz pot to ground, its wiper bypassed by C2; R4 feeds it back to Q1's base
    s.wire(q2.emitter, [20.4, 15]);
    s.pot([20.4, 15], [20.4, 21], [24, 18], { label: 'Fuzz', value: '1 kΩ', accent: true });
    s.ground([20.4, 21]);
    s.capacitor([24, 18], [24, 21], { label: 'C2', value: '20 µF' });
    s.ground([24, 21]);
    s.wire([7, 12], [7, 17]);
    s.resistor([7, 17], [16, 17], { label: 'R4', value: '100 kΩ', side: 'below' });
    s.wire([16, 17], [17, 17], [17, 15], [20.4, 15]);
    s.dot([7, 12]).dot([20.4, 15]);
    return s.svg();
  },
};
