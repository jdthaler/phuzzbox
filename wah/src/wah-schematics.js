// wah-schematics.js — the Wah's circuit diagram (shared/schematic.js), which
// tools/gen-schematics.mjs writes to wah/schematics/ for its README and tour. The parts and node
// numbers are native/pedals/wah/wah-model.h's (Holters and Zölzer's Table 1, with this pedal's
// 22 nF sweep capacitor).

import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  // the inductor wah: Q1 drives the rocker's pot, the wiper feeds Q2, whose emitter drives the coil
  // through the sweep capacitor; the coil's current returns to Q1's base through R6
  circuit() {
    const s = schematic({ w: 36, h: 28, title: 'The Wah: an inductor wah' });
    s.wire([12.4, 1.5], [28.4, 1.5]);
    s.label([11.6, 1.9], 'supply', { anchor: 'end', colour: 'ink' });
    // the input and Q1, a common-emitter stage
    s.terminal([1, 13], 'in', { side: 'above' });
    s.resistor([1, 13], [5, 13], { label: 'R1', value: '68 kΩ' });
    s.capacitor([5, 13], [9, 13], { label: 'C1', value: '10 nF' });
    s.wire([9, 13], [10, 13]);
    const q1 = s.npn([12, 13], { label: 'Q1' });
    s.resistor(q1.emitter, [12.4, 18], { label: 'R3', value: '390 Ω' });
    s.ground([12.4, 18]);
    s.wire(q1.collector, [12.4, 8]);
    s.resistor([12.4, 8], [12.4, 1.5], { label: 'R2', value: '22 kΩ' });
    // Q1's collector: the pot through C4, Q2's base through R5, the coil's top through R4
    s.wire([12.4, 8], [25, 8]);
    s.capacitor([18, 8], [18, 12], { label: 'C4', value: '220 nF' });
    s.pot([18, 12], [18, 18], [21, 15], { label: 'Rocker', value: '100 kΩ', accent: true });
    s.ground([18, 18]);
    s.wire([18, 12], [22, 12]);
    s.terminal([22, 12], 'out', { side: 'right' });
    s.capacitor([21, 15], [25, 15], { label: 'C5', value: '220 nF', side: 'below' });
    s.resistor([25, 8], [25, 15], { label: 'R5', value: '470 kΩ' });
    // Q2, an emitter follower
    const q2 = s.npn([28, 15], { label: 'Q2' });
    s.wire([25, 15], q2.base);
    s.resistor(q2.collector, [28.4, 1.5], { label: 'R10', value: '1 kΩ' });
    s.wire(q2.emitter, [28.4, 19], [32, 19]);
    s.resistor([32, 19], [32, 24], { label: 'R9', value: '10 kΩ' });
    s.ground([32, 24]);
    // the sweep capacitor to the coil's foot (node 7); the coil and R7 across it to node 6
    s.wire([28.4, 19], [28.4, 22]);
    s.capacitor([28.4, 22], [20, 22], { label: 'C3 (sweep)', value: '22 nF', accent: true });
    s.inductor([14, 22], [20, 22], { label: 'L1', value: '500 mH', accent: true });
    s.wire([14, 22], [14, 24.5]);
    s.resistor([14, 24.5], [20, 24.5], { label: 'R7 (Q)', value: '33 kΩ', side: 'below' });
    s.wire([20, 24.5], [20, 22]);
    // node 6: R4 from Q1's collector, R8 and C2 to ground
    s.resistor([14, 8], [14, 12], { label: 'R4', value: '470 kΩ' });
    s.wire([14, 12], [14, 22]);
    s.wire([14, 22], [4, 22]);
    s.resistor([10, 22], [10, 26.5], { label: 'R8', value: '82 kΩ' });
    s.ground([10, 26.5]);
    s.capacitor([4, 22], [4, 26.5], { label: 'C2', value: '4.7 µF' });
    s.ground([4, 26.5]);
    // R6: the coil's current back to Q1's base
    s.resistor([9, 13], [9, 20], { label: 'R6', value: '1.5 kΩ', side: 'left' });
    s.wire([9, 20], [20, 20], [20, 22]);
    s.dot([9, 13]).dot([12.4, 8]).dot([14, 8]).dot([18, 8]).dot([18, 12]).dot([25, 15]).dot([28.4, 19]).dot([20, 22]).dot([14, 22]).dot([10, 22]);
    return s.svg();
  },
};
