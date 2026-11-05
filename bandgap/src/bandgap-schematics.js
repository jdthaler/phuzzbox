// bandgap-schematics.js — the Bandgap's circuit diagram (shared/schematic.js), which
// tools/gen-schematics.mjs writes to bandgap/schematics/ for its README and tour. The parts are
// native/pedals/bandgap/bandgap-model.cpp's.

import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  // a non-inverting op-amp stage, then a resistor into diodes to ground
  circuit() {
    const s = schematic({ w: 43, h: 20, title: 'The Bandgap: an op-amp\'s gain, diodes to ground, then the Filter' });
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
    // 1 kΩ into the diodes, with a capacitor across them
    s.resistor([14, 6], [20, 6], { label: 'Rt', value: '1 kΩ' });
    s.capacitor([20, 6], [20, 11], { label: 'Cd', value: '3.3 nF' });
    s.ground([20, 11]);
    s.wire([20, 6], [28, 6]);
    s.diode([24, 6], [24, 11], { label: 'D1', accent: true });
    s.diode([28, 11], [28, 6], { label: 'D2', accent: true });
    s.ground([24, 11]).ground([28, 11]);
    s.dot([20, 6]).dot([24, 6]);
    s.label([26, 13.6], 'Diodes: Ge · Schottky · Si', { size: 11 }).label([26, 14.6], 'red · green · blue LED', { size: 11 });
    // a buffer, then the Filter into its capacitor, and out through the Level
    s.wire([28, 6], [30, 6]);
    const buf = s.amp([30, 6], { length: 2, height: 1.8, label: '1' });
    s.resistor(buf.out, [38, 6], { label: 'Filter', value: '1.5–101.5 kΩ', accent: true });
    s.capacitor([38, 6], [38, 11], { label: 'Ct', value: '3.3 nF' });
    s.ground([38, 11]);
    s.wire([38, 6], [41, 6]);
    s.dot([38, 6]);
    s.terminal([41, 6], 'out', { side: 'above' });
    return s.svg();
  },
};
