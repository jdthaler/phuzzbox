// rubens-tour.js — the guided tour of Rubens' Tube's physics (shared/tour.js)
import { tour, riff, sweep, note, run } from '../../shared/tour.js';

export const TOUR = tour('rubens', [
  {
    title: 'A pipe of gas',
    views: ['The response', 'The flames'],
    preset: 'Gardner\'s tube',
    play: [riff({ times: 2 })],
    text: `In 1905 Heinrich Rubens and Otto Krigar-Menzel drilled a row of holes along a pipe, filled it with gas, lit it, and sounded a note into one end: the flames rose and fell with the standing wave inside. This pedal is the pipe, closed by a loudspeaker at one end and a cap at the other, with a microphone inside. It rings where its length holds a whole number of half wavelengths, n c/2L: in this one, 1.524 m of propane, which carries sound at 246.59 m/s, the modes are 80.9 Hz apart, 34 of them below 2779 Hz, where the pipe's first cross mode lets more than plane waves through.

![Rubens' Tube from the side: the speaker, the pipe with its flames, the cap and the microphone](schematics/tube.svg)`,
  },
  {
    title: 'The speaker in the loop',
    views: ['The response', 'Spectrum'],
    preset: 'Gardner\'s tube',
    play: [run('E2 F2 E2 E3 F3 E3', { step: 0.8, dur: 0.7 }), riff({ at: 5 })],
    text: `The walls alone would let the first mode ring with a quality factor of 172. But the pipe pushes back on the speaker's cone, and the cone's coil, shorted through the amplifier, is a damper: Gardner, Gee and Dix found in 2009 that the speaker "greatly decreases the quality factor of the lowest several modes". Here the first five peaks' Q is 14, 42, 87, 154 and 200, and higher up, where the cone is too heavy to follow, the peaks are the pipe's own. Listen: E2 lands on the first peak, 80.9 Hz, and swells; F2, a semitone up, comes through thin.`,
  },
  {
    title: 'Where the microphone listens',
    views: ['The response', 'The flames'],
    preset: 'Gardner\'s tube',
    play: [riff({ times: 2 }), sweep('mic', 100, 50, { dur: 8 })],
    text: `At the cap the microphone hears every mode. Slide it along the pipe and it hears each in proportion to cos(nπ x/L); in the middle it sits on the odd modes' pressure nodes, and the first and third modes come 47 dB and 42 dB down. Listen as the sweep walks it to the middle and the pipe goes up an octave.`,
  },
  {
    title: 'Natural gas',
    views: ['The response', 'Spectrum'],
    preset: 'Natural gas',
    play: [riff({ times: 2 })],
    text: `Methane, natural gas, is lighter than propane and carries sound at 445 m/s, so the same pipe's first peak moves from 80.9 Hz to 147 Hz, the modes almost twice as far apart. It loses more to the walls, too: the pipe's tail rings 1.5 s where propane's rings 4.7 s.`,
  },
  {
    title: 'The flames',
    views: ['The flames', 'The response'],
    preset: 'Gardner\'s tube',
    play: [note('E2', { dur: 4 }), note('E2', { at: 4.5, dur: 4 }), note('E2', { at: 9, dur: 4 }), sweep('pressure', 2000, 100, { at: 0.5, dur: 12, log: true })],
    text: `Bernoulli: the gas leaves each hole at a speed that goes as √(P + p), so where the sound's pressure swings most, at the antinodes, less gas leaves on average and the flames are shortest; at the nodes they stand tallest. That is Ficken and Stephenson's explanation. E2 at 0.3 V from the bass swings 1410 Pa at the cap. As the sweep lowers the gas's pressure the sound cuts deeper, the flames shrinking most, to 84 % of their height, where the swing is 1.55 times the gas's pressure; past 4.3 times it, the gas rushing out on each push wins, and the pattern turns over, as Ficken and Stephenson saw with low gas pressure. The sound itself doesn't change.`,
  },
  {
    title: 'A long pipe',
    views: ['The response', 'Spectrum'],
    preset: 'Long tube',
    play: [riff({ times: 2 })],
    text: `Make the pipe 3.5 m long and it rings first at 34.5 Hz, under the bass's open E, 41.2 Hz, with 78 modes below the cutoff: a resonance near every note, each lifting the harmonics that fall on it, so that every note takes on the pipe's colour.`,
  },
]);
