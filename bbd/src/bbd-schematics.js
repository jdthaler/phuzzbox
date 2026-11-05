// bbd-schematics.js — the Bucket Brigade's diagram (shared/schematic.js), which
// tools/gen-schematics.mjs writes to bbd/schematics/ for its README and tour.

import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  // the filters either side of a chain of capacitors, joined by switches the two clock phases close
  chain() {
    const s = schematic({ w: 40, h: 11, title: 'The Bucket Brigade: a chain of capacitors between two filters, its switches closed by a two-phase clock' });
    s.terminal([1, 4], 'in', { side: 'above' });
    s.wire([1, 4], [3, 4]);
    const aa = s.block([3, 2.5], 5, 3, { label: 'anti-alias', value: 'Butterworth, 3rd' });
    let x0 = 8;
    s.wire(aa.right, [10, 4]);
    // five stages shown: a switch (φ1, φ2 alternately), then a capacitor to ground
    for (let k = 0; k < 5; k++) {
      const sw = s.block([10 + 4 * k, 3.2], 2, 1.6, { label: k % 2 ? 'φ2' : 'φ1', accent: true });
      s.wire(sw.right, [13 + 4 * k, 4]);
      s.capacitor([13 + 4 * k, 4], [13 + 4 * k, 8], { label: k ? '' : 'C', value: k ? '' : 'stage' });
      s.ground([13 + 4 * k, 8]);
      s.dot([13 + 4 * k, 4]);
      if (k < 4) s.wire([13 + 4 * k, 4], [14 + 4 * k, 4]);
      x0 = 13 + 4 * k;
    }
    s.label([22, 1.6], '… N stages: the charge moves two a clock cycle …', { size: 11 });
    s.wire([x0, 4], [31, 4]);
    const rc = s.block([31, 2.5], 6, 3, { label: 'reconstruction', value: 'Butterworth, 3rd' });
    s.wire(rc.right, [39, 4]);
    s.terminal([39, 4], 'out', { side: 'above' });
    return s.svg();
  },
};
