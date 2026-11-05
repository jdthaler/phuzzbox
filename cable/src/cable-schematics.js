// cable-schematics.js — the Transatlantic Cable's diagrams (shared/schematic.js), which
// tools/gen-schematics.mjs writes to cable/schematics/ for its README and tour. The parts are
// native/pedals/cable/cable-model.cpp's.

import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  // the line as a ladder: the source, one section of cable, the far end and the repeater
  line() {
    const s = schematic({ w: 42, h: 13, title: 'The line: a source, a ladder of sections of cable, the far end and a repeater' });
    s.terminal([1, 4], 'in', { side: 'above' });
    s.resistor([1, 4], [6, 4], { label: 'source', value: '5 Ω or 600 Ω' });
    // one section: dx of the cable's series resistance and inductance, its shunt capacitance and
    // leakance to the return (the sea, or the pair's other wire)
    s.block([6.6, 0.6], 17.4, 10.2, { dash: '5 5' });
    s.label([15.3, 12.1], 'one section: dx of cable', { size: 11 });
    s.resistor([6, 4], [11, 4], { label: 'R dx', accent: true });
    s.inductor([11, 4], [16, 4], { label: 'L dx', accent: true });
    s.capacitor([16, 4], [16, 9], { label: 'C dx', accent: true });
    s.wire([16, 4], [20, 4]);
    s.resistor([20, 4], [20, 9], { label: 'G dx', value: '(leak)', accent: true });
    s.dot([16, 4]).dot([16, 9]);
    s.label([27, 4.4], '… N of them', { size: 12, colour: 'ink' });
    s.wire([20, 4], [24.6, 4]);
    s.wire([29.4, 4], [31, 4]);
    // the far end: matched or open, then the repeater
    s.resistor([31, 4], [31, 9], { label: 'far end', value: 'Z₀ or 1 MΩ' });
    s.dot([31, 4]);
    s.wire([31, 4], [35, 4]);
    const a = s.amp([35, 4], { label: 'rep.' });
    s.wire(a.out, [40.5, 4]);
    s.terminal([40.5, 4], 'out', { side: 'above' });
    // the return
    s.wire([1, 9], [31, 9]);
    s.terminal([1, 9], '', {});
    s.ground([31, 9]);
    return s.svg();
  },
  // a coil-loaded line: a coil every 1.83 km, the cable between
  coils() {
    const s = schematic({ w: 44, h: 10, title: 'Loading coils: one every 1.83 km, the cable between them' });
    s.terminal([1, 4], 'in', { side: 'above' });
    s.resistor([1, 4], [5, 4], { label: 'source' });
    let x = 5;
    for (let k = 0; k < 2; k++) {
      s.inductor([x, 4], [x + 5, 4], { label: 'coil', value: '22–250 mH', accent: true });
      const b = s.block([x + 5.5, 2.8], 7, 2.4, { label: 'cable', value: '1.83 km' });
      s.wire([x + 5, 4], b.left);
      x += 13;
      s.wire(b.right, [x, 4]);
    }
    s.label([x + 2.4, 4.4], '…', { size: 16, colour: 'ink' });
    s.wire([x + 4.4, 4], [x + 7, 4]);
    s.resistor([x + 7, 4], [x + 7, 8], { label: 'far end' });
    s.ground([x + 7, 8]);
    s.dot([x + 7, 4]);
    s.wire([x + 7, 4], [42, 4]);
    s.terminal([42, 4], 'out', { side: 'above' });
    return s.svg();
  },
};
