// octave-tour.js — the guided tour of the Octave Down's physics (shared/tour.js)
import { tour, note, riff, sweep } from '../../shared/tour.js';

export const TOUR = tour('octave', [
  {
    title: 'A flip-flop and a switch',
    views: ['The divider', 'Scope'],
    preset: 'Octave under',
    play: [riff({ times: 2 })],
    text: `![A tracking filter, a comparator with hysteresis, two flip-flops and the switches they work](schematics/circuit.svg)

There is no pitch detection here. A comparator watches the filtered bass cross zero, and each time it rises a flip-flop toggles. A switch flips the bass's polarity with it, so every other cycle comes out upside down, and the wave repeats every two cycles: an octave below.

**The divider** shows it on a steady note: the filtered bass with its thresholds, the flip-flops, and the two octave paths.`,
  },
  {
    title: 'The octave alone',
    views: ['The divider', 'Spectrum'],
    preset: 'Octave alone',
    play: [note('A1', { dur: 2, vel: 0.8 }), note('D2', { at: 2.4, dur: 2, vel: 0.8 }), note('E1', { at: 4.8, dur: 2.5, vel: 0.9 })],
    text: `With the dry bass out, you hear only the flipped wave. For a sine, its component at half the frequency is 8/(3π) = 0.849 of the note, 1.4 dB below it, and the flips come at the zero crossings, where they leave almost no step to buzz.

In **Spectrum**, a new line stands at half the note's frequency, and the note itself is gone.`,
  },
  {
    title: 'Tracking: crossing once a cycle',
    views: ['The divider', 'Scope'],
    preset: 'Tracking too high',
    play: [note('E1', { dur: 2.5, vel: 0.9 }), note('A1', { at: 2.8, dur: 2.5, vel: 0.9 }), { at: 5.6, set: { track: 70, hyst: 5e-3 } }, note('E1', { at: 5.6, dur: 2.5, vel: 0.9 }), note('A1', { at: 8.4, dur: 2.5, vel: 0.9 })],
    text: `A bass's low strings have a strong second harmonic. With the tracking filter at 1 kHz it gets through, the wave crosses zero four times a cycle, and the comparator rises twice: the "octave" stutters and jumps up to the note itself.

Halfway, the filter drops to the default 70 Hz. The harmonics are gone before the comparator, it rises once a cycle, and the octave holds steady.`,
  },
  {
    title: 'Two octaves down',
    views: ['The divider', 'Spectrum'],
    preset: 'Sub synth',
    play: [note('E1', { dur: 2, vel: 0.9 }), note('A1', { at: 2.4, dur: 2, vel: 0.9 }), note('D2', { at: 4.8, dur: 2, vel: 0.9 }), note('G2', { at: 7.2, dur: 2, vel: 0.9 })],
    text: `A second flip-flop toggles on the first one's rising edge, at a quarter of the note's frequency. Under a low E that is 10 Hz, felt more than heard. It comes into its own from the A string up.

The **Tone** is down at 400 Hz here, which rounds the octaves into a synthesizer's sub.`,
  },
  {
    title: 'When the note dies',
    views: ['The divider', 'Scope'],
    preset: 'Octave alone',
    play: [note('A1', { dur: 5, vel: 0.5 }), sweep('hyst', 1e-3, 40e-3, { at: 0.2, dur: 6, log: true })],
    text: `The comparator needs the filtered note to swing past ±h, the **Hysteresis**, which grows here from 1 to 40 mV. As the note decays below it, the comparator stops, the flip-flops hold, and the octave path is the note at its own pitch with a fixed polarity.

That last moment of the note at its own pitch, and the octave dropping out on quiet notes, is part of how these boxes sound.`,
  },
]);
