// rotary-tour.js — the guided tour of the Rotary Speaker's physics (shared/tour.js)
import { tour, note, riff } from '../../shared/tour.js';

export const TOUR = tour('rotary', [
  {
    title: 'Two rotors',
    views: ['The cabinet', 'The pitch'],
    preset: 'Chorale',
    play: [riff({ times: 2 })],
    text: `![A crossover, a horn and a drum turning, two microphones](schematics/circuit.svg)

A crossover at 800 Hz sends the highs to a horn and the lows to a drum, each turning on its own motor: the horn at about 50 rpm, the drum at 40. Two microphones listen from 1 m away.

**The cabinet** shows them from above. The line from the horn to each microphone is red while the horn comes toward it and blue while it goes away.`,
  },
  {
    title: 'The retarded time',
    views: ['The pitch', 'Spectrum'],
    preset: 'Tremolo',
    play: [note('G2', { dur: 4, vel: 0.9 })],
    text: `A microphone hears now what the horn sent when it was |M − X(t_e)| away, that distance over the speed of sound ago. Solve for that moment every sample, read what was sent then, and the Doppler shift comes out by itself: f' = f / (1 + v_r/c).

On Fast the horn's mouth moves at 6.3 m/s, and a note swings ±31.6 cents. **The pitch** shows it at both microphones.`,
  },
  {
    title: 'The horn arrives first',
    views: ['The pitch', 'The cabinet'],
    preset: 'Chorale',
    play: [riff({ times: 3 }), { at: 1.5, set: { fast: true } }, { at: 7.5, set: { fast: false } }],
    text: `Each rotor follows the switch with its own time constant: 0.35 s for the light horn, 1.7 s for the heavy drum. The horn is 95 % of the way to 400 rpm in about a second; the drum takes about five.

At 1.5 s the switch goes to Fast. Watch the horn's swing widen at once and the drum's catch up, and at 7.5 s both slow again.`,
  },
  {
    title: 'Beaming',
    views: ['The patterns', 'Scope'],
    preset: 'Horn only',
    play: [note('G3', { dur: 3, vel: 0.9 }), note('D2', { at: 3.5, dur: 3, vel: 0.9 })],
    text: `Each mouth radiates as a rigid piston, 2 J1(x)/x off its axis. A wavelength much longer than the mouth goes every way; a shorter one beams. Behind the horn, 4 kHz is 12.1 dB down and 300 Hz is within 0.1 dB.

So the high harmonics come and go as the horn turns, and the low ones hardly do. **The patterns** shows the horn's and the drum's.`,
  },
  {
    title: 'Close up, opposite sides',
    views: ['The cabinet', 'Scope'],
    preset: 'Mics up close',
    play: [riff({ times: 2 })],
    text: `With the microphones 35 cm away, the horn's coming and going is a large share of the distance, and the level throbs (at 30 cm, 9.5 dB from near to far; at 3 m, 0.87 dB).

They are on opposite sides now: as the horn comes toward one it goes away from the other. In headphones the pitch rises in one ear as it falls in the other.`,
  },
]);
