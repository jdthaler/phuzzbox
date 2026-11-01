// opto-schematics.js — the Opto Compressor's circuit diagram (shared/schematic.js), written to
// opto/schematics/ by tools/gen-schematics.mjs.
import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  // the signal path and the loop that lights the cell
  circuit() {
    const s = schematic({ w: 22, h: 15, title: 'The Opto Compressor: a photocell shunts the signal, a panel the signal drives lights it' });
    s.terminal([1, 4], 'in', { side: 'above' });
    const buf = s.amp([1.5, 4], { length: 2, height: 2, label: '1' });
    s.wire([1, 4], [1.5, 4]);
    s.wire(buf.out, [5, 4]);
    s.resistor([5, 4], [10, 4], { label: 'Rs', value: '47 kΩ' });
    s.dot([10, 4]);
    s.ldr([10, 4], [10, 8], { label: 'cell', value: 'R(n)', accent: true });
    s.ground([10, 8]);
    s.wire([10, 4], [13, 4]);
    s.dot([12, 4]);
    const gain = s.amp([13, 4], { length: 3, label: 'Gain' });
    s.wire(gain.out, [19, 4]);
    s.terminal([19.5, 4], 'out', { side: 'above' });
    s.wire([19, 4], [19.5, 4]);
    // the driver hears what the cell lets through, and lights the panel beside the cell
    s.wire([12, 4], [12, 6.5], [15.5, 6.5], [15.5, 11], [14, 11]);
    const drv = s.amp([14, 11], { left: true, length: 3, label: '×A' });
    s.wire(drv.out, [7, 11], [7, 9.5]);
    s.block([5.5, 6.5], 3, 3, { label: 'panel', value: 'e(v)', accent: true });
    s.label([11, 13.4], 'the driver: 80 dB behind the Peak Reduction pot,');
    s.label([11, 14.3], 'hearing the signal after the cell (Sense) or the input');
    return s.svg();
  },
};
