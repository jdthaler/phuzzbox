// preamp-schematics.js — the Tube Preamp's circuit diagrams (shared/schematic.js), which
// tools/gen-schematics.mjs writes to preamp/schematics/ for its README and tour. The parts are
// native/pedals/preamp/preamp-model.h's: a 1959 Bassman's preamp (5F6-A).

import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  // the three triodes: two gain stages and a cathode follower, which drives the tone stack
  stages() {
    const s = schematic({ w: 41, h: 20, title: 'The Tube Preamp: two gain stages and a cathode follower' });
    s.wire([9, 1.5], [30, 1.5]);
    s.label([8.3, 1.9], 'B+', { anchor: 'end', colour: 'ink' });
    // the input: 1 MΩ to ground, 68 kΩ to V1a's grid
    s.terminal([1, 12], 'in', { side: 'above' });
    s.wire([1, 12], [3, 12]);
    s.resistor([3, 12], [3, 17], { label: '1 MΩ', side: 'left' });
    s.ground([3, 17]);
    s.resistor([3, 12], [7, 12], { label: '68 kΩ' });
    const v1 = s.triode([9, 12], { label: 'V1a', accent: true });
    s.wire(v1.cathode, [9, 15]);
    s.resistor([9, 15], [9, 19], { label: '1.5 kΩ', side: 'left' });
    s.ground([9, 19]);
    s.wire([9, 15], [11, 15]);
    s.capacitor([11, 15], [11, 19], { label: '25 µF' });
    s.ground([11, 19]);
    s.wire(v1.plate, [9, 7]);
    s.resistor([9, 7], [9, 1.5], { label: '100 kΩ', side: 'left' });
    // the coupling capacitor, the Gain pot and the 270 kΩ grid stopper to V2a
    s.capacitor([9, 7], [14, 7], { label: '20 nF' });
    s.wire([14, 7], [15, 7]);
    s.pot([15, 7], [15, 14], [17, 10.5], { label: 'Gain', value: '1 MΩ', accent: true });
    s.ground([15, 14]);
    s.resistor([17, 10.5], [21, 10.5], { label: '270 kΩ' });
    const v2 = s.triode([23, 10.5], { label: 'V2a', accent: true });
    s.resistor(v2.cathode, [23, 16.5], { label: '820 Ω' });
    s.ground([23, 16.5]);
    s.wire(v2.plate, [23, 7]);
    s.resistor([23, 7], [23, 1.5], { label: '100 kΩ', side: 'left' });
    // V2b, a cathode follower, DC-coupled from V2a's plate
    s.wire([23, 7], [26, 7], [26, 9], [28, 9]);
    const v3 = s.triode([30, 9], { label: 'V2b' });
    s.wire(v3.plate, [30, 1.5]);
    s.wire(v3.cathode, [30, 12]);
    s.resistor([30, 12], [30, 17], { label: '100 kΩ', side: 'left' });
    s.ground([30, 17]);
    s.wire([30, 12], [36, 12]);
    s.terminal([36, 12], 'tone stack', { side: 'right' });
    s.dot([3, 12]).dot([9, 15]).dot([9, 7]).dot([23, 7]).dot([30, 12]);
    return s.svg();
  },
  // the tone stack (Yeh and Smith's), and the Master pot after it
  tonestack() {
    const s = schematic({ w: 32, h: 23, title: 'The tone stack and the Master' });
    s.terminal([1, 3]);
    s.label([0.6, 2.1], 'from V2b', { anchor: 'start', colour: 'ink' });
    s.wire([1, 3], [4, 3]);
    s.capacitor([4, 3], [9, 3], { label: '250 pF' });
    s.wire([9, 3], [12, 3]);
    s.pot([12, 3], [12, 11], [15, 7], { label: 'Treble', value: '250 kΩ', accent: true });
    s.resistor([3, 3], [3, 11], { label: '56 kΩ' });
    s.capacitor([3, 11], [12, 11], { label: '20 nF', side: 'below' });
    s.pot([12, 11], [12, 16], [14.5, 13.5], { label: 'Bass', value: '1 MΩ', accent: true });
    s.wire([14.5, 13.5], [14.5, 16], [12, 16]);
    s.pot([12, 16], [12, 21], [8, 18.5], { label: 'Middle', value: '25 kΩ', accent: true });
    s.ground([12, 21]);
    s.wire([3, 11], [3, 18.5]);
    s.capacitor([3, 18.5], [8, 18.5], { label: '20 nF', side: 'below' });
    // the treble pot's wiper is the stack's output, into the Master
    s.wire([15, 7], [24, 7]);
    s.pot([24, 7], [24, 15], [27, 11], { label: 'Master', value: '1 MΩ' });
    s.ground([24, 15]);
    s.wire([27, 11], [30, 11]);
    s.terminal([30, 11], 'out', { side: 'above' });
    s.dot([3, 3]).dot([3, 11]).dot([12, 11]).dot([12, 16]);
    return s.svg();
  },
};
