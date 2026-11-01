// phuzz-tour.js — the guided tour of the Phuzz's physics (shared/tour.js)
import { tour, note, riff, sweep } from '../../shared/tour.js';

export const TOUR = tour('phuzz', [
  {
    title: 'Two transistors, clipping',
    views: ['Scope', 'The transistors'],
    preset: 'Full fuzz',
    bypass: true,
    play: [note('E1', { dur: 2.4, vel: 0.85 }), { at: 2.5, bypass: false }, note('E1', { at: 2.6, dur: 2.4, vel: 0.85 }), riff({ at: 5.2 })],
    text: `First the bass straight, then through the Phuzz: two germanium transistors with about **39 dB** of gain between them at 1 kHz. A note that went in round comes out squared off, clipped on both sides.

In **The transistors**, each ring is a transistor's operating point on its load line. Play, and the trail runs from saturation (the left edge) to cut-off (the bottom): Q1 within its first volt, Q2 across nearly the whole battery. That swing is the fuzz.`,
  },
  {
    title: 'The Fuzz knob is feedback',
    views: ['Scope', 'Spectrum'],
    preset: 'Full fuzz',
    play: [riff({ times: 2 }), sweep('fuzz', 1, 0.4, { at: 1, dur: 8 })],
    text: `**Fuzz** is a 1 kΩ pot in Q2's emitter, with a 20 µF capacitor on its wiper. Full up, the capacitor grounds the emitter for the signal and the pair has all its gain. Turning it down puts part of the pot back in the emitter: negative feedback, and by halfway the gain is 25 dB lower. The squared tops round off and the harmonics in the **Spectrum** fall.

The feedback reaches the input too: its impedance falls from about 6 kΩ to a few hundred ohms, and it loads your pickup harder.`,
  },
  {
    title: 'Germanium leaks when warm',
    views: ['The transistors', 'Scope'],
    preset: 'Full fuzz',
    set: { temp: 5 },
    play: [riff({ times: 3 }), sweep('temp', 5, 45, { at: 0.5, dur: 14 })],
    text: `Germanium transistors leak: a current passes whatever the base asks for, and it doubles about every 7 °C. The room now warms from 5 °C to 45 °C.

Q1's leakage takes over from the bias the feedback sets, Q2 is starved of current, and its ring slides down its load line toward the battery's end. At 0 °C its collector sits at −4.5 V, near the middle of its swing, and it clips evenly; at 40 °C it has slid to −7.3 V, and the **Scope** shows it clipping lopsided. Near 50 °C most of the gain is gone, and the pedal sputters.`,
  },
  {
    title: 'A dying battery',
    views: ['Scope', 'The transistors'],
    preset: 'Full fuzz',
    play: [riff(), { at: 5, set: { battery: 7, battR: 200 } }, riff({ at: 5 })],
    text: `A fresh 9 V battery, then one nearly flat: 7 V behind 200 Ω of internal resistance.

Less voltage leaves Q2's collector less room to swing, so the output clips at 0.36 V where it clipped at 0.45 V. The resistance makes the rail sag with each note, by 0.19 V where a fresh battery's sags 2 mV; and since the output is taken from a divider to the rail, the battery's resistance adds to the divider, which by itself would make it about 2 dB louder.`,
  },
  {
    title: 'Trimming the bias',
    views: ['Scope', 'The transistors'],
    preset: 'Leaky first transistor',
    play: [riff(), { at: 5, set: { bias: 20000 } }, riff({ at: 5 })],
    text: `Builders measure their transistors and trim the bias. Here Q1 leaks 150 µA, five times the default: Q2 is starved, and the clipped wave's two sides are 16 % apart.

Halfway, Q2's collector resistor goes from 8.2 kΩ to 20 kΩ, which lifts the collector away from the battery, back toward the middle of its swing. The two sides even out, to 1 % apart, for some level. In **The transistors**, Q2's load line tilts flatter and its ring moves left, away from the battery's end.`,
  },
]);
