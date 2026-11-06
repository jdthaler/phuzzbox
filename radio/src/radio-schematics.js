// radio-schematics.js — the Crystal Radio's circuit diagram (shared/schematic.js), which
// tools/gen-schematics.mjs writes to radio/schematics/ for its README and tour. The parts are
// native/pedals/radio/radio-model.cpp's.

import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  // the antenna into the tuned circuit, the diode, and the earphone with its bypass capacitor
  set() {
    const s = schematic({ w: 27, h: 15, title: 'The Crystal Radio: a tuned circuit, a point-contact diode and an earphone' });
    // the antenna
    s.wire([2, 1.5], [3, 3], [4, 1.5]).wire([3, 3], [3, 4]);
    s.label([5, 2], 'antenna', { anchor: 'start', colour: 'ink' });
    // the tuned circuit: the coil and the variable capacitor
    s.inductor([3, 4], [3, 11], { label: 'L', side: 'left' });
    s.wire([3, 4], [8, 4]);
    s.capacitor([8, 4], [8, 11], { label: 'C', value: 'tuning' });
    s.arrow([6.6, 9.4], [9.4, 5.6]);
    s.wire([3, 11], [8, 11]);
    s.ground([5.5, 11]);
    s.dot([8, 4]);
    s.label([5.5, 14.4], 'the tuned circuit', { size: 11 });
    // the detector
    s.wire([8, 4], [10, 4]);
    s.diode([10, 4], [15, 4], { label: 'D', accent: true });
    s.label([12.5, 6.4], 'the crystal', { size: 11 });
    // the earphone and its bypass capacitor
    s.dot([16, 4]);
    s.wire([15, 4], [16, 4]);
    s.capacitor([16, 4], [16, 11], { label: 'C', value: '1 nF' });
    s.wire([16, 4], [21, 4]);
    s.resistor([21, 4], [21, 11], { label: 'R', value: '100 kΩ' });
    s.wire([16, 11], [21, 11]);
    s.ground([18.5, 11]);
    s.dot([21, 4]);
    s.wire([21, 4], [25, 4]);
    s.terminal([25, 4], 'V', { side: 'above' });
    s.label([18.5, 14.4], 'the earphone', { size: 11 });
    return s.svg();
  },
};
