// blackhole-tour.js — the guided tour of the Black Hole's physics (shared/tour.js)
import { tour, note, run, riff } from '../../shared/tour.js';

export const TOUR = tour('blackhole', [
  {
    title: 'A hole that rings',
    views: ['The modes', 'The ringing'],
    preset: 'Bass hole',
    play: [note('E1', { dur: 1.5, vel: 0.9 }), riff({ at: 2 })],
    text: `![Your bass drives four quasinormal modes, each heard through its spin-weighted harmonic, h₊ on the left and h× on the right](schematics/modes.svg)

A black hole, struck, rings in its quasinormal modes, each at one frequency and dying at one rate, set by its mass and spin alone. Your bass strikes this one: 200 suns spinning at a = 0.69, whose loudest mode rings at 85.4 Hz for about 12 ms.

**The modes** shows its four modes; **The ringing**, what one click does to it: h₊ on the left, h× on the right.`,
  },
  {
    title: 'A thud',
    views: ['The ringing', 'Scope'],
    preset: 'Thud: no spin',
    play: [note('E1', { dur: 1.5, vel: 0.9 }), run('A1 D2 G2', { at: 2, step: 0.6, vel: 0.8 })],
    text: `A hole that does not spin, Schwarzschild's: its (2,2,0) mode rings at 60.4 Hz and dies at 90.3 per second, a Q of 2.1. Barely two cycles, and it is gone: the shortest ringing a hole can make.`,
  },
  {
    title: 'Spin it up',
    views: ['The modes', 'The ringing'],
    preset: 'Thud: no spin',
    play: [note('E1', { dur: 1.2, vel: 0.9 }), { at: 1.5, set: { nines: 0.509 } }, note('E1', { at: 1.6, dur: 1.2, vel: 0.9 }),
      { at: 3.2, set: { nines: 2 } }, note('E1', { at: 3.3, dur: 1.2, vel: 0.9 }), { at: 5, set: { nines: 4 } }, note('E1', { at: 5.1, dur: 3, vel: 0.9 })],
    text: `The same E, the hole spun faster each time: none, then a = 0.69, then 0.99, then 0.9999. Its loudest mode climbs, 60.4 Hz, 85.4 Hz, 140.7 Hz, 159.2 Hz, and rings longer: Q 2.1, 3.3, 14.8, then 142.

Watch the dots on **The modes** climb their paths.`,
  },
  {
    title: 'The horizon\'s harmonics',
    views: ['The modes', 'Spectrum'],
    preset: 'Bell: nearly extremal',
    play: [note('E1', { dur: 2.5, vel: 0.9 }), note('A1', { at: 3, dur: 2.5, vel: 0.9 })],
    text: `Near the limit the l = m modes become simple. Hod showed they go to m Ω_H − 2πi T_H (n + ½): harmonics of the horizon's spin, damped by its Hawking temperature, which goes to zero.

So the modes slide onto 2 : 3 : 4, at 200 suns toward 161.6 Hz, 242.3 Hz and 323.1 Hz, and ring on: a bell. The (2,1,0) mode is not one of them and stays short.`,
  },
  {
    title: 'Mass is pitch',
    views: ['The modes', 'Spectrum'],
    preset: 'On the open E',
    play: [note('E1', { dur: 2, vel: 0.9 }), note('F1', { at: 2.5, dur: 2, vel: 0.9 }), { at: 5, set: { mass: 62, nines: 0.481 } }, riff({ at: 5.2 })],
    text: `The ringing goes as one over the mass. 414 suns rings on the open E, 41.2 Hz: the E rings it, the F hardly.

At 5 s the hole becomes GW150914's, LIGO's first: 62 suns at a = 0.67, ringing at 270.9 Hz for 3.7 ms.`,
  },
  {
    title: 'How it was made, where you are',
    views: ['The ringing', 'The modes'],
    preset: 'Lopsided merger',
    play: [riff(), { at: 5, set: { ratio: 1, inclination: 0 } }, note('E1', { at: 5.2, dur: 1.5, vel: 0.9 }), { at: 7, set: { inclination: 90 } }, note('E1', { at: 7.2, dur: 1.5, vel: 0.9 })],
    text: `A merger of holes 8 : 1 rings the (2,1,0) and (3,3,0) modes at 0.36 and 0.35 of the (2,2,0); equal masses leave them silent.

At 5 s, equal masses, heard face-on: h₊ and h× equal and a quarter cycle apart, circularly polarised. At 7 s, edge-on: every mode's h× vanishes, and the ringing leaves the right channel to the dry bass alone.`,
  },
]);
