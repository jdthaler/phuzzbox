// blackhole-schematics.js — the Black Hole's signal path (shared/schematic.js), written to
// blackhole/schematics/ by tools/gen-schematics.mjs: the bass drives four quasinormal modes, each
// heard through its spin-weighted harmonic at the inclination, h₊ on the left and h× on the right.
import { schematic } from '../../shared/schematic.js';

// the defaults: 200 suns at a = 0.69 (the engine's own numbers, test/blackhole-tests.mjs)
const MODES = [['(2,2,0)', '85.4 Hz, Q 3.3'], ['(2,1,0)', '73.2 Hz, Q 2.7'], ['(3,3,0)', '135.3 Hz, Q 5.0'], ['(4,4,0)', '183.2 Hz, Q 6.7']];

export const SCHEMATICS = {
  modes() {
    const s = schematic({ w: 34, h: 17, title: 'The Black Hole: your bass drives four of the hole\'s quasinormal modes, each heard through its spin-weighted harmonic, h₊ on the left and h× on the right' });
    s.terminal([1, 8], 'in', { side: 'above' });
    s.wire([1, 8], [2.4, 8]);
    s.block([2.4, 6.6], 5.4, 2.8, { label: 'your bass', value: 'perturbs the hole' });
    s.wire([7.8, 8], [9, 8]);
    s.wire([9, 2.6], [9, 13.6]);
    MODES.forEach(([name, v], k) => {
      const y = 1.5 + 3.7 * k;
      s.wire([9, y + 1.1], [10, y + 1.1]);
      s.block([10, y], 7.6, 2.2, { label: name, value: v, accent: k === 0 });
      s.wire([17.6, y + 1.1], [19.4, y + 1.1]);
    });
    s.label([13.8, 16.4], 'each a ringing e^(−iωt) e^(−γt): Mass and Spin set ω and γ', { size: 11 });
    s.block([19.4, 1.5], 6.4, 13.3, { label: 'its harmonic', value: 'at Inclination ι' });
    s.label([22.6, 4.6], 'each mode through', { size: 11 });
    s.label([22.6, 12.2], 'Mass ratio: how loud', { size: 11 });
    s.wire([25.8, 5], [31, 5]); s.terminal([31, 5], 'h₊: left', { side: 'above' });
    s.wire([25.8, 11.3], [31, 11.3]); s.terminal([31, 11.3], 'h×: right', { side: 'above' });
    return s.svg();
  },
};
