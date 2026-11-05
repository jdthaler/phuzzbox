// lampvibe-schematics.js — the Lamp Vibe's diagrams (shared/schematic.js), which
// tools/gen-schematics.mjs writes to lampvibe/schematics/ for its README and tour. The parts are
// native/pedals/lampvibe/lampvibe-model.cpp's.

import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  // the whole: the oscillator lights the lamp, the lamp the four cells, the cells set the stages
  vibe() {
    const s = schematic({ w: 42, h: 17, title: 'The Lamp Vibe: an oscillator, a lamp, four photocells and four all-pass stages' });
    const lfo = s.block([1, 1], 6, 2.4, { label: 'oscillator', value: 'Speed' });
    s.wire(lfo.right, [10, 2.2]);
    const lamp = s.block([10, 1], 7, 2.4, { label: 'lamp', value: 'Intensity', accent: true });
    s.label([18, 2.6], 'the filament heats and cools: Stefan–Boltzmann', { anchor: 'start', size: 11 });
    // the light, down to each cell
    const xs = [9, 17, 25, 33];
    for (const x of xs) s.arrow([lamp.bottom[0], 3.4], [x + 2, 7.3], { colour: 'accent', dash: '4 4' });
    // the signal through four stages, each with its cell
    s.terminal([1, 12], 'in', { side: 'above' });
    s.wire([1, 12], [6, 12]);
    xs.forEach((x, k) => {
      const b = s.block([x - 1, 10.8], 5.2, 2.4, { label: `stage ${k + 1}`, value: ['470 nF', '100 nF', '22 nF', '4.7 nF'][k] });
      if (k) s.wire([xs[k - 1] + 4.2, 12], b.left);
      else s.wire([6, 12], b.left);
      s.ldr([x + 2, 7.8], [x + 2, 10.8], { label: `cell`, accent: true });
    });
    // the dry path round to the mix
    s.wire([6, 12], [6, 15.5], [37.5, 15.5], [37.5, 13.1]);
    s.dot([6, 12]);
    s.wire([37.2, 12], [37.5, 12]);
    s.block([37.5, 10.9], 1.6, 2.2, { label: '+' });
    s.label([22, 15.1], 'dry (chorus only)', { size: 11 });
    s.wire([39.1, 12], [40.6, 12]);
    s.terminal([40.6, 12], 'out', { side: 'above' });
    return s.svg();
  },
  // one stage: a phase splitter, its collector through C and its emitter through the cell
  stage() {
    const s = schematic({ w: 26, h: 16, title: 'One stage: a phase splitter, whose two outputs meet through C and the cell' });
    s.terminal([1, 8], 'in', { side: 'above' });
    s.wire([1, 8], [5, 8]);
    const q = s.npn([7, 8], { label: '' });
    // the collector and emitter loads, equal, so the two outputs are −x and +x
    s.resistor([7.4, 1], [7.4, 6], { label: 'Rc', value: 'equal' });
    s.label([7.4, 0.7], '+V', { size: 11 });
    s.resistor([7.4, 10], [7.4, 15], { label: 'Re', value: 'equal' });
    s.ground([7.4, 15]);
    s.label([4.6, 4.4], '−x', { size: 12, colour: 'ink' }).label([4.6, 12.4], '+x', { size: 12, colour: 'ink' });
    s.wire(q.collector, [7.4, 4.5], [12, 4.5]);
    s.capacitor([12, 4.5], [18, 4.5], { label: 'C' });
    s.wire(q.emitter, [7.4, 11.5], [12, 11.5]);
    s.ldr([12, 11.5], [18, 11.5], { label: 'cell R', accent: true });
    s.wire([18, 4.5], [18, 11.5]);
    s.dot([18, 8]).dot([7.4, 4.5]).dot([7.4, 11.5]);
    s.wire([18, 8], [24, 8]);
    s.terminal([24, 8], 'out', { side: 'above' });
    s.label([21, 10.6], '(1 − sRC)/(1 + sRC)', { size: 11 });
    return s.svg();
  },
};
