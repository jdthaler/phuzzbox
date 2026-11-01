// rotary-schematics.js — the Rotary Speaker's signal path (shared/schematic.js), written to
// rotary/schematics/ by tools/gen-schematics.mjs.
import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  // the crossover, the two rotors, the paths to the two microphones
  circuit() {
    const s = schematic({ w: 32, h: 12, title: 'The Rotary Speaker: a crossover, a horn and a drum turning, two microphones' });
    s.terminal([1, 6], 'in', { side: 'above' });
    s.wire([1, 6], [4, 6]);
    s.block([4, 4.6], 4.4, 2.8, { label: 'crossover', value: '800 Hz' });
    s.wire([8.4, 5.2], [10, 5.2], [10, 2.5], [12, 2.5]);
    s.wire([8.4, 6.8], [10, 6.8], [10, 9.5], [12, 9.5]);
    s.label([10.4, 4.6], 'high', { size: 11, anchor: 'start' });
    s.label([10.4, 7.8], 'low', { size: 11, anchor: 'start' });
    s.block([12, 1.2], 5.6, 2.6, { label: 'horn', value: 'r 15 cm, 400 rpm', accent: true });
    s.block([12, 8.2], 5.6, 2.6, { label: 'drum', value: 'r 18 cm, 340 rpm', accent: true });
    // each rotor's sound to each microphone: the retarded time, the pattern, 1/distance
    for (const y of [2.5, 9.5]) { s.wire([17.6, y], [19, y]); s.dot([19, y]); s.wire([19, y - 0.9], [19, y + 0.9]); s.wire([19, y - 0.9], [21, y - 0.9]); s.wire([19, y + 0.9], [21, y + 0.9]); }
    s.label([23, 0.5], 'delay to the retarded time, pattern, 1/distance', { size: 11 });
    s.block([21, 1.0], 3.6, 1.2, { label: 'to L', value: '' });
    s.block([21, 2.8], 3.6, 1.2, { label: 'to R', value: '' });
    s.block([21, 8.0], 3.6, 1.2, { label: 'to L', value: '' });
    s.block([21, 9.8], 3.6, 1.2, { label: 'to R', value: '' });
    s.wire([24.6, 1.6], [27, 1.6], [27, 4.5]); s.wire([24.6, 8.6], [27, 8.6], [27, 4.5]);
    s.wire([24.6, 3.4], [28.5, 3.4], [28.5, 7.5]); s.wire([24.6, 10.4], [28.5, 10.4], [28.5, 7.5]);
    s.wire([27, 4.5], [30.5, 4.5]); s.terminal([30.5, 4.5], 'L', { side: 'above' });
    s.wire([28.5, 7.5], [30.5, 7.5]); s.terminal([30.5, 7.5], 'R', { side: 'below' });
    return s.svg();
  },
};
