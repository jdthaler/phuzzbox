// octave-schematics.js — the Octave Down's circuit (shared/schematic.js), written to
// octave/schematics/ by tools/gen-schematics.mjs.
import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  // the divider: tracking filter, comparator, flip-flops, polarity switches, tone, mix
  circuit() {
    const s = schematic({ w: 30, h: 15, title: 'The Octave Down: a tracking filter, a comparator, two flip-flops, and switches that flip the bass’s polarity' });
    s.terminal([1, 3], 'in', { side: 'above' });
    s.dot([2, 3]);
    // the tracking filter: two buffered RC sections
    s.resistor([1, 3], [4, 3], { label: 'R' });
    s.dot([4, 3]); s.capacitor([4, 3], [4, 5.5], { label: 'C', side: 'left' }); s.ground([4, 5.5]);
    const b1 = s.amp([4, 3], { length: 2, height: 1.8, label: '1' });
    s.resistor(b1.out, [9, 3], { label: 'R' });
    s.dot([9, 3]); s.capacitor([9, 3], [9, 5.5], { label: 'C', side: 'left' }); s.ground([9, 5.5]);
    const b2 = s.amp([9, 3], { length: 2, height: 1.8, label: '1' });
    s.label([6.5, 0.9], 'tracking filter, f_t = 1/(2πRC)', { size: 11 });
    s.dot([12, 3]);
    s.wire(b2.out, [12, 3]);
    // the comparator, with hysteresis ±h, and the flip-flops
    s.wire([12, 3], [13, 3]);
    const cmp = s.amp([13, 3], { length: 2.4, label: '±h', accent: true });
    s.wire(cmp.out, [16.5, 3]);
    const ff1 = s.block([16.5, 2], 3, 2, { label: 'T flip-flop', value: 'q₁', accent: true });
    s.wire(ff1.right, [21.5, 3]);
    const ff2 = s.block([21.5, 2], 3, 2, { label: 'T flip-flop', value: 'q₂', accent: true });
    s.label([15, 5.3], 'rising past +h', { size: 11 });
    // the switches: the filtered bass times ±1
    s.wire([12, 3], [12, 8], [14.5, 8]); s.dot([12, 8]); s.wire([12, 8], [12, 11], [14.5, 11]);
    const sw1 = s.block([14.5, 7], 3, 2, { label: '× q₁', value: 'switch' });
    const sw2 = s.block([14.5, 10], 3, 2, { label: '× q₂', value: 'switch' });
    s.arrow([18, 4], [17.2, 6.9], { colour: 'good' });
    s.arrow([23, 4], [16.6, 9.9], { colour: 'good' });
    s.resistor(sw1.right, [21, 8], { label: 'tone' }); s.dot([21, 8]); s.capacitor([21, 8], [21, 9.6], {}); s.ground([21, 9.6]);
    s.resistor(sw2.right, [21, 11], { label: 'tone', side: 'below' }); s.dot([21, 11]); s.capacitor([21, 11], [21, 12.6], {}); s.ground([21, 12.6]);
    // the mix
    s.wire([21, 8], [24, 8]); s.wire([21, 11], [24, 11]);
    s.wire([2, 3], [2, 13.5], [24, 13.5]);
    const mix = s.block([24, 7], 3, 7, { label: 'mix', value: 'dry, 1, 2' });
    s.wire(mix.right, [28.5, 10.5]);
    s.terminal([29, 10.5], 'out', { side: 'above' });
    s.wire([28.5, 10.5], [29, 10.5]);
    s.label([8, 13.1], 'dry', { size: 11 });
    return s.svg();
  },
};
