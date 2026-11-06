// transformer-schematics.js — the Output Transformer's circuit diagram (shared/schematic.js), which
// tools/gen-schematics.mjs writes to transformer/schematics/ for its README and tour. The parts are
// native/pedals/transformer/transformer-model.h's.

import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  // the output valves as a source behind their plate resistance, the transformer and the speaker
  stage() {
    const s = schematic({ w: 26, h: 13, title: 'The Output Transformer: the output valves as a source behind their plate resistance, into the transformer\'s primary; the speaker on its secondary' });
    s.terminal([1, 3], 'Vs', { side: 'above' });
    s.label([1, 5.4], 'Drive × in', { anchor: 'start', size: 11 });
    s.resistor([1, 3], [8, 3], { label: 'Rs', value: 'Plate resistance' });
    s.wire([8, 3], [12, 3]);
    s.dot([12, 3]);
    s.label([12, 2.3], 'v', { size: 12 });
    s.coupling([12, 5.5], [12, 10], {});
    s.label([16.6, 7.9], 'iron core', { colour: 'accent', size: 12 });
    s.wire([12, 3], [12, 5.5]);
    s.ground([12, 10]);
    s.wire([14, 5.5], [14, 3]).wire([14, 3], [20, 3]);
    s.dot([20, 3]);
    s.resistor([20, 3], [20, 10], { label: 'speaker', value: '4 Ω' });
    s.wire([14, 10], [20, 10]);
    s.ground([20, 10]);
    s.wire([20, 3], [24, 3]);
    s.terminal([24, 3], 'out', { side: 'above' });
    s.label([13, 12.4], '4.2 kΩ : 4 Ω, as Hammond\'s 1750L; 1500 turns on the primary, a 15 cm magnetic path', { size: 11 });
    return s.svg();
  },
};
