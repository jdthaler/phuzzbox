// cabinet-schematics.js — the Speaker Cabinet's equivalent circuit (shared/schematic.js), written to
// cabinet/schematics/ by tools/gen-schematics.mjs.
import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  // one driver and its share of the box, as one circuit: forces as volts and velocities as amps
  circuit() {
    const s = schematic({ w: 40, h: 13, title: 'The Speaker Cabinet as one circuit: the coil, the cone on its suspension, and the air in the box and the port' });
    // the coil, driven by the amp through its output impedance
    s.terminal([1, 3], '', {});
    s.label([1.6, 5.8], 'the amp', { anchor: 'start', colour: 'ink' });
    s.terminal([1, 8], '', {});
    s.resistor([1, 3], [4.5, 3], { label: 'Rg', value: 'amp' });
    s.resistor([4.5, 3], [8, 3], { label: 'Re', value: 'coil' });
    s.inductor([8, 3], [11.5, 3], { label: 'Le', value: 'coil' });
    s.wire([11.5, 3], [12, 3], [12, 4]);
    s.wire([12, 8], [1, 8]);
    s.coupling([12, 4], [12, 8], { gyrator: true, label: 'Bl', accent: true });
    // the cone: its mass, its suspension's springiness and friction, in series (one velocity)
    s.wire([14, 4], [14, 3], [14.5, 3]);
    s.inductor([14.5, 3], [18, 3], { label: 'Mms', value: 'cone' });
    s.capacitor([18, 3], [20.5, 3], { label: 'Cms(x)', value: 'suspension', accent: true });
    s.resistor([20.5, 3], [24, 3], { label: 'Rms', value: 'friction' });
    s.wire([24, 3], [25, 3], [25, 4]);
    s.wire([25, 8], [14, 8]);
    s.coupling([25, 4], [25, 8], { label: 'Sd' });
    // the box's air: a spring, its leaks, and the port's air, all at the box's pressure
    s.wire([27, 4], [27, 3], [38, 3]);
    s.wire([27, 8], [38, 8]);
    s.dot([29, 3]).dot([29, 8]).dot([33, 3]).dot([33, 8]);
    s.capacitor([29, 3], [29, 8], { label: 'Cab', value: 'box air' });
    s.resistor([33, 3], [33, 8], { label: 'Ra', value: 'leaks' });
    s.inductor([38, 3], [38, 8], { label: 'Mp', value: 'port', side: 'left', dash: '4 3' });
    s.label([6, 10], 'electrical: volts, amps');
    s.label([19, 10], 'mechanical: newtons, m/s');
    s.label([32, 10], 'acoustic: pascals, m³/s');
    s.label([20, 11.6], 'Bl(x) weakens as the coil leaves the gap; the microphone hears d/dt of the cones’ and the port’s volume velocities');
    return s.svg();
  },
};
