// sympathetic-tour.js — the guided tour of the Sympathetic Strings' physics (shared/tour.js)
import { tour, note, riff } from '../../shared/tour.js';

export const TOUR = tour('sympathetic', [
  {
    title: 'Strings nobody plays',
    views: ['The strings', 'Scope'],
    preset: 'Halo in E',
    play: [note('E1', { dur: 2, vel: 0.9 })],
    text: `![A driver moves one bridge, twelve strings tuned to E major run from it, and a pickup hears their pull](schematics/frame.svg)

A driver moves a bridge with your bass. Twelve steel strings tuned to E major run from it, each at the same stress, so its length sets its note: E2 is 1.68 m, B3 0.56 m. A pickup under the bridge hears them pull.

**The strings** shows them to scale, each shaking as much as it rings.`,
  },
  {
    title: 'In the key, and out of it',
    views: ['The partials', 'The strings'],
    preset: 'Halo in E',
    play: [note('E1', { dur: 2.5, vel: 0.9 }), note('F1', { at: 3.5, dur: 2.5, vel: 0.9 })],
    text: `A string rings along when a harmonic of your note lands within its partial's bandwidth, 0.36 Hz at the defaults. The open E's harmonics land on E2, B2, E3 and B3. Then an F: its harmonics fall between the strings, and they stay nearly still.

In the tests the E rings the strings 13.6 dB more than the F. **The partials** shows where each string can ring, against your note's harmonics.`,
  },
  {
    title: 'Stiff wire',
    views: ['The partials', 'Spectrum'],
    preset: 'Thick wire',
    play: [note('A1', { dur: 3, vel: 0.9 })],
    text: `Steel is stiff as well as tense, so a string's partials run sharp: f_n = n f₀ √(1 + Bn²), Fletcher's formula. At the same stress B grows as the diameter squared: 6.58 × 10⁻⁶ for E2 at 0.3 mm, 7.31 × 10⁻⁵ at 1 mm.

With 1 mm wire the A1 string's 40th partial rings 43.9 cents above 40 f₀. Listen to the top of the halo.`,
  },
  {
    title: 'The highs die first',
    views: ['Spectrum', 'Scope'],
    preset: 'Dark and short',
    play: [riff({ times: 1 }), { at: 6, set: { highs: 3.5, sustain: 12 } }, riff({ at: 6.2, times: 1 })],
    text: `Each partial dies at b₁ + b₃ω², Chaigne and Askenfelt's form: Sustain sets how long a 100 Hz partial rings, Highs ring a 2 kHz one. At 0.3 s the halo is dark and close.

At 6 s the strings go to Glassy, 12 s and 3.5 s: the same notes leave a long, bright shimmer.`,
  },
  {
    title: 'A drone',
    views: ['The strings', 'The partials'],
    preset: 'Drone on A',
    play: [note('A1', { dur: 3, vel: 0.9 }), note('E2', { at: 3.2, dur: 3, vel: 0.9 })],
    text: `Five strings, A and E in turn, from A2: the most open tuning. An A rings every one of them: each sits on one of its harmonics, or within a fraction of a hertz of one. An E rings the two E strings most.`,
  },
]);
