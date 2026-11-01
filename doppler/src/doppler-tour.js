// doppler-tour.js — the guided tour of the Doppler's physics (shared/tour.js)
import { tour, note, riff } from '../../shared/tour.js';

export const TOUR = tour('doppler', [
  {
    title: 'A car goes by',
    views: ['The road', 'The pitch'],
    preset: 'Car at 90 km/h',
    play: [note('A1', { dur: 7.5, vel: 0.9 })],
    text: `![The source on a straight road d from you, what you hear now sent from where it was D earlier, along a path c D long](schematics/road.svg)

Your bass rides past you at 25 m/s, 4 m away, every 4 s. Hold one note: it comes in 131 cents high and leaves 122 cents low, a fall of 2.5 semitones.

What you hear now was sent D ago, from where the source was then: c² D² = (X − v D)² + d², a quadratic, solved exactly for each ear.`,
  },
  {
    title: 'Bunched ahead, spread behind',
    views: ['The road', 'Spectrum'],
    preset: 'Race car',
    play: [riff(), note('E2', { at: 5, dur: 4, vel: 0.9 })],
    text: `At 90 m/s, 6 m away: each wavefront spreads from where the source was when it sent it, so they bunch up ahead of it and spread out behind. **The road** shows them.

Coming it is 527 cents high, going 403 cents low: 930 cents, more than three quarters of an octave, in a moment.`,
  },
  {
    title: 'Close and far',
    views: ['The pitch', 'Scope'],
    preset: 'Car at 90 km/h',
    play: [note('D2', { dur: 3.8, vel: 0.9 }), { at: 4, set: { distance: 40, period: 8 } }, note('D2', { at: 4, dur: 11, vel: 0.9 })],
    text: `The same car with the road 4 m away, then 40 m. Close, the middle of the fall takes 180 ms and the level swells 23 times as it passes; far, 1660 ms, a slow glide, and only 2.5 times.`,
  },
  {
    title: 'Who moves through the air',
    views: ['The pitch', 'The road'],
    preset: 'You ride past',
    play: [note('A1', { dur: 3.8, vel: 0.9 }), { at: 4, set: { speed: 25, listener: 0 } }, note('A1', { at: 4.2, dur: 7.6, vel: 0.9 })],
    text: `First you ride at 25 m/s past a source standing still: 122 cents high as you come, 131 cents low as you go. Then the source passes you at 25 m/s: 131 cents high, 122 low.

The fall is the same, but it sits in a different place: what counts is who moves through the air, not only how fast you close.`,
  },
  {
    title: 'A jet',
    views: ['The road', 'The pitch'],
    preset: 'Jet, low pass',
    play: [note('E1', { dur: 6, vel: 0.9 }), riff({ at: 6.2 })],
    text: `250 m/s, Mach 0.73, 60 m up. Its sound arrives squeezed into a scream, 2257 cents high, almost two octaves, and drops 3204 cents as it passes.`,
  },
  {
    title: 'The boom',
    views: ['The road', 'The pitch'],
    preset: 'Mach 2',
    play: [note('A1', { dur: 6, vel: 0.9 }), note('A1', { at: 6, dur: 6, vel: 0.9 })],
    text: `Mach 2, 100 m away. The source outruns its sound: nothing, until the Mach cone, its half-angle 30°, sweeps over you 0.2523 s after it has passed. Everything it sent around one moment arrives at once: the boom.

Then two sounds: what it sends now, falling away, and what it sent as it came, backwards (dashed on **The pitch**). The boom is far louder than the pass, so the preset turns Level down by 24 dB.`,
  },
]);
