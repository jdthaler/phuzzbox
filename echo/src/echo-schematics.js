// echo-schematics.js — the Tape Echo's tape path (shared/schematic.js), written to echo/schematics/
// by tools/gen-schematics.mjs.
import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  // the loop: erase, record and three playback heads along the tape, the capstan, the repeats
  circuit() {
    const s = schematic({ w: 32, h: 16, title: 'The Tape Echo: a loop of tape past an erase head, a record head and three playback heads' });
    // the heads, the tape running under them, left to right, and round the loop
    const head = (x, label, value, accent) => s.block([x, 7.2], 2.6, 1.8, { label, value, accent });
    head(6, 'erase', '', false);
    head(9.5, 'record', 'Langevin', true);
    head(14.5, 'play 1', '4 cm', false);
    head(19, 'play 2', '8 cm', false);
    head(23.5, 'play 3', '12 cm', false);
    s.wire([5, 9.4], [29, 9.4]);
    s.wire([29, 9.4], [30.3, 10.7], [30.3, 13.3], [29, 14.6], [5, 14.6], [3.7, 13.3], [3.7, 10.7], [5, 9.4]);
    s.arrow([19, 9.4], [21.5, 9.4], { colour: 'good' });
    s.arrow([14, 14.6], [11, 14.6], { colour: 'good' });
    s.label([17, 14.1], 'the tape loop, at v', { size: 11 });
    s.block([27, 9.8], 1.6, 1.6, { label: 'cap', accent: true });
    s.label([27.8, 12.4], 'capstan, e off centre', { size: 11 });
    s.label([17, 11.2], 'spacing, coating and gap losses at the playback heads', { size: 11 });
    // the record path: the input and the repeats
    s.terminal([1, 3.5], 'in', { side: 'above' });
    s.dot([2, 3.5]);
    s.wire([1, 3.5], [10.8, 3.5], [10.8, 7.2]);
    s.dot([10.8, 3.5]);
    // the playback heads to the echo bus, and back as the repeats
    s.wire([15.8, 7.2], [15.8, 5.5]); s.wire([20.3, 7.2], [20.3, 5.5]); s.wire([24.8, 7.2], [24.8, 5.5]);
    s.wire([13, 5.5], [27, 5.5]);
    s.dot([15.8, 5.5]); s.dot([20.3, 5.5]);
    s.wire([13, 5.5], [13, 3.5], [10.8, 3.5]);
    s.label([13.6, 4.9], '× repeats', { size: 11, anchor: 'start' });
    const amp = s.amp([27, 5.5], { length: 1.8, height: 1.4, label: '' });
    s.label([27.6, 7.0], 'echo', { size: 11 });
    // the mix
    s.wire([2, 3.5], [2, 1.5], [30.3, 1.5], [30.3, 3.5]);
    s.label([16, 1.1], 'dry', { size: 11 });
    s.wire(amp.out, [30.3, 5.5], [30.3, 3.5]);
    s.dot([30.3, 3.5]);
    s.wire([30.3, 3.5], [31.3, 3.5]);
    s.terminal([31.3, 3.5], 'out', { side: 'above' });
    return s.svg();
  },
};
