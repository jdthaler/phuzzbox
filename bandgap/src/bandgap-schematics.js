// bandgap-schematics.js — the Bandgap's circuit diagram (shared/schematic.js), which
// tools/gen-schematics.mjs writes to bandgap/schematics/ for its README and tour. The parts are
// native/pedals/bandgap/bandgap-model.cpp's.

import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  // a non-inverting op-amp stage, then a resistor into diodes to ground
  circuit() {
    const s = schematic({ w: 35, h: 20, title: 'The Bandgap: an op-amp\'s gain, then diodes to ground' });
    // the bass into the + input
    s.terminal([1, 5.4], 'in', { side: 'above' });
    s.wire([1, 5.4], [8, 5.4]);
    const a = s.amp([8, 6], { length: 3 });
    s.label([8.6, 5.75], '+', { size: 12 }).label([8.6, 6.95], '−', { size: 12 });
    s.label([9.5, 4.1], 'op-amp: LM308 · µA741 · TL072', { size: 11 });
    // the feedback from the output to the − input: Drive in parallel with Cf
    s.wire([8, 6.6], [7, 6.6], [7, 10]);
    s.resistor([7, 10], [14, 10], { label: 'Drive', value: '0.1–100 kΩ', accent: true });
    s.wire([7, 10], [7, 13]);
    s.capacitor([7, 13], [14, 13], { label: 'Cf', value: '100 pF', side: 'below' });
    s.wire([14, 13], [14, 10], [14, 6]);
    s.wire(a.out, [14, 6]);
    s.dot([7, 10]).dot([14, 10]).dot([14, 6]);
    // to ground from the − input: 1 kΩ and the low-cut capacitor
    s.wire([7, 10], [4, 10]);
    s.resistor([4, 10], [4, 14], { label: 'Rg', value: '1 kΩ', side: 'left' });
    s.capacitor([4, 14], [4, 18], { label: 'Low cut', value: '10 µF', side: 'left' });
    s.ground([4, 18]);
    // the Filter: a resistor into the diodes, with a capacitor across them
    s.resistor([14, 6], [21, 6], { label: 'Filter', value: '1–101 kΩ' });
    s.capacitor([21, 6], [21, 11], { label: 'Cd', value: '3.3 nF' });
    s.ground([21, 11]);
    s.wire([21, 6], [29, 6]);
    s.diode([25, 6], [25, 11], { label: 'D1', accent: true });
    s.diode([29, 11], [29, 6], { label: 'D2', accent: true });
    s.ground([25, 11]).ground([29, 11]);
    s.dot([21, 6]).dot([25, 6]);
    s.label([27, 13.6], 'Diodes: Ge · Schottky · Si', { size: 11 }).label([27, 14.6], 'red · green · blue LED', { size: 11 });
    // the output, through the Level
    s.wire([29, 6], [33, 6]);
    s.terminal([33, 6], 'out', { side: 'above' });
    return s.svg();
  },
};
