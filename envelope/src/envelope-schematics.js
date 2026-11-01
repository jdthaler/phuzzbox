// envelope-schematics.js — the Envelope Filter's circuit (shared/schematic.js), written to
// envelope/schematics/ by tools/gen-schematics.mjs.
import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  // the state-variable filter whose integrators' resistors are photocells, and the follower and
  // LED that light them
  circuit() {
    const s = schematic({ w: 27, h: 15, title: 'The Envelope Filter: a follower lights an LED, and the LED lights the photocells that set the filter’s cutoff' });
    // the filter: a summer, then two integrators, each a photocell and a capacitor
    s.terminal([1, 4], 'in', { side: 'above' });
    s.dot([2, 4]);
    s.resistor([1, 4], [5, 4], { label: '10 kΩ' });
    const sum = s.amp([5, 4], { length: 2.4, label: 'Σ' });
    s.dot([8, 4]);
    s.wire(sum.out, [8, 4]);
    s.ldr([8, 4], [11.5, 4], { label: 'cell', value: 'R(n)', accent: true });
    s.dot([11.5, 4]);
    const i1 = s.amp([12, 4], { length: 2.4, label: '∫' });
    s.wire([11.5, 4], [12, 4]);
    s.wire([11.5, 4], [11.5, 2]); s.capacitor([11.5, 2], [14.4, 2], { label: 'C' }); s.wire([14.4, 2], [14.4, 4]);
    s.dot([15, 4]);
    s.wire(i1.out, [15, 4]);
    s.ldr([15, 4], [18.5, 4], { label: 'cell', value: 'R(n)', accent: true });
    s.dot([18.5, 4]);
    const i2 = s.amp([19, 4], { length: 2.4, label: '∫' });
    s.wire([18.5, 4], [19, 4]);
    s.wire([18.5, 4], [18.5, 2]); s.capacitor([18.5, 2], [21.4, 2], { label: 'C' }); s.wire([21.4, 2], [21.4, 4]);
    s.wire(i2.out, [23, 4]);
    s.terminal([8, 6.6], 'HP', { side: 'below' }); s.wire([8, 4], [8, 6.6]);
    s.terminal([15, 6.6], 'BP', { side: 'below' }); s.wire([15, 4], [15, 6.6]);
    s.terminal([23, 6.6], 'LP', { side: 'below' }); s.wire([23, 4], [23, 6.6]);
    s.arrow([22.5, 4], [22.5, 0.8], { dash: '3 3' });
    s.arrow([22.5, 0.8], [6, 0.8], { dash: '3 3' });
    s.arrow([6, 0.8], [6, 3.2], { dash: '3 3' });
    s.label([14, 0.55], 'LP and k·BP back into the summer (k = 1/Q)', { size: 11 });
    // the follower: a rectifier, the attack resistor, the capacitor with the decay resistor across
    s.wire([2, 4], [2, 10]);
    s.diode([2, 10], [5, 10], { label: '|·|', value: 'rectifier' });
    s.resistor([5, 10], [8.5, 10], { label: 'Ra', value: 'attack' });
    s.dot([8.5, 10]); s.dot([11, 10]);
    s.capacitor([8.5, 10], [8.5, 13], { label: 'Cf', side: 'left' }); s.ground([8.5, 13]);
    s.resistor([11, 10], [11, 13], { label: 'Rd', value: 'decay' }); s.ground([11, 13]);
    s.wire([8.5, 10], [13, 10]);
    const drv = s.amp([13, 10], { length: 2.4, label: 'G' });
    s.wire(drv.out, [16, 10]);
    s.resistor([16, 10], [19.5, 10], { label: '220 Ω' });
    s.diode([19.5, 10], [22.5, 10], { label: 'LED', accent: true, side: 'below' });
    s.ground([22.5, 10]);
    // the LED's light on both cells
    s.arrow([20.8, 9.4], [10.4, 5.2], { colour: 'good' });
    s.arrow([20.8, 9.4], [17.4, 5.2], { colour: 'good' });
    s.label([13.5, 14.3], 'G is the Sensitivity; in Down the LED runs on 5 mA less what the follower gives');
    return s.svg();
  },
};
