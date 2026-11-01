// echo-tour.js — the guided tour of the Tape Echo's physics (shared/tour.js)
import { tour, note, riff, sweep } from '../../shared/tour.js';

export const TOUR = tour('echo', [
  {
    title: 'Distance over speed',
    views: ['The heads', 'Scope'],
    preset: 'Three heads',
    play: [note('A1', { dur: 0.3, vel: 0.9 }), note('E2', { at: 2.5, dur: 0.3, vel: 0.9 })],
    text: `![A loop of tape past an erase head, a record head and three playback heads](schematics/circuit.svg)

A loop of tape runs past a record head and three playback heads, 4, 8 and 12 cm further on. Each head plays what was recorded the distance over the speed ago: at 19 cm/s, 211, 421 and 632 ms.

Here all three heads play together, so one note makes a rhythm.`,
  },
  {
    title: 'Every repeat darker',
    views: ['The heads', 'Spectrum'],
    preset: 'Dub bass',
    play: [note('A2', { dur: 0.25, vel: 1 }), note('D2', { at: 4, dur: 0.25, vel: 1 })],
    text: `What the heads play is recorded again. Each pass loses what the playback head can't hear of the tape: a wavelength's field falls away 54.6 dB for each wavelength of distance between the head and the tape, so the short ones go first.

At 19 cm/s one pass loses 6.8 dB at 3 kHz. **The heads** shows it, and dashed, the second, third and fourth repeats, each darker.`,
  },
  {
    title: 'Slow tape is dark',
    views: ['The heads'],
    preset: 'Three heads',
    play: [riff({ times: 1 }), { at: 3.5, set: { speed: 0.095 } }, riff({ at: 4.5, times: 1 })],
    text: `The losses depend on the wavelength on the tape, v/f. Halve the speed and every wavelength is half as long, and the heads lose more of it: at 9.5 cm/s a pass loses 13.3 dB at 3 kHz.

Halfway the tape slows to 9.5 cm/s. The echoes come twice as late and much darker, and those already on the tape drop in pitch as the motor slows.`,
  },
  {
    title: 'The tape fills up',
    views: ['The tape', 'Spectrum'],
    preset: 'Dub bass',
    play: [riff({ times: 2 }), sweep('record', 0, 18, { at: 1, dur: 6 })],
    text: `With a good bias the tape keeps the anhysteretic magnetisation, the Langevin function: straight for quiet notes, bending over as the particles line up.

**Record level** climbs here from 0 to 18 dB. **The tape** shows the record head reaching the bend: the echoes compress, and a third harmonic grows (0.13 % at 0 dB for a 0.3 V note, 1.94 % at +12 dB).`,
  },
  {
    title: 'Runaway, and a wobbly capstan',
    views: ['The tape', 'Scope'],
    preset: 'Runaway',
    play: [note('E2', { dur: 0.3, vel: 1 }), { at: 5, set: { repeats: 0.4 } }],
    text: `Past 100 % the loop grows with every pass until the tape's curve holds it at its ceiling: the howl these machines are known for. At 5 s the repeats come down and it dies away.

Listen to the waver too: the capstan is a few micrometres off centre, so the tape speeds and slows once a turn, 12.1 Hz at 19 cm/s.`,
  },
]);
