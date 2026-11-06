// helmholtz-tour.js — the guided tour of Helmholtz's Resonators' physics (shared/tour.js)
import { tour, riff, sweep, note, run } from '../../shared/tour.js';

export const TOUR = tour('helmholtz', [
  {
    title: 'A sphere of air',
    views: ['The resonators', 'Spectrum'],
    preset: 'His largest',
    play: [riff({ times: 2 })],
    text: `In 1863 Hermann von Helmholtz set out to hear the partials a musical tone is made of, and made himself an instrument for it: a hollow glass sphere with a short neck towards the sound and a second opening fitted to his ear. The air in the neck is a mass and the air inside the sphere its spring, and it rings at ω0² = Sn c²/((ℓ + 2δ) V). His largest, 154 mm across, rings at 204.5 Hz with a Q of 105: below that the air inside follows the air outside; at it, the sound inside is 105 times the sound outside.

![A Helmholtz resonator and the same as a mass on a spring](schematics/sphere.svg)`,
  },
  {
    title: 'Hearing a partial',
    views: ['The resonators', 'Scope'],
    preset: 'Tuned to A',
    play: [run('A1 D2 A2 E1', { step: 2.5, dur: 2.2 })],
    text: `"If the proper tone of the resonator is sounded, it brays into the ear most powerfully." Opened a little, to 112.6 %, the largest rings at 220.0 Hz: the fourth harmonic of the open A string, the second of A2, the third of D2, 220.25 Hz. Each of them sets it ringing, and the ring goes on after the note; E1, with no partial near it, only comes through.`,
  },
  {
    title: 'Koenig\'s flames',
    views: ['Koenig\'s flames', 'The resonators'],
    preset: 'His largest',
    play: [riff({ times: 2 })],
    text: `The Paris instrument maker Rudolph Koenig, who made Helmholtz's resonators, showed what they hear: a small gas chamber behind a rubber membrane at the resonator's second opening, its flame leaping as the air inside shakes, seen in a rotating mirror as a row of tongues. With a flame on each of the ten, a note lights the resonators its partials fall on.`,
  },
  {
    title: 'Ten resonators',
    views: ['The resonators', 'Koenig\'s flames'],
    preset: 'His largest',
    play: [riff({ times: 3 }), sweep('glass', 1, 10, { dur: 12, steps: 9 })],
    text: `His ten glass resonators run from 204.5 Hz to 920.2 Hz, from a sphere 154 mm across to one of 43 mm. Their Qs run from 61 to 108: the neck radiates sound back into the room, and its walls drag on the air in it, and most of the energy goes in the radiation. Listen as the sweep passes the riff from resonator to resonator, as Helmholtz did, each picking a different partial out of the notes.`,
  },
  {
    title: 'Narrowing the mouth',
    views: ['The resonators', 'Spectrum'],
    preset: 'His largest',
    play: [riff({ times: 3 }), sweep('opening', 100, 30, { dur: 12, log: true })],
    text: `"Reducing the size of the orifice also deepens the pitch of the resonator", and a narrower mouth rings more sharply: "it is just as in microscopes; the greater the magnifying power, the smaller the field of view." At 70 % of his opening the largest rings at 163 Hz with a Q of 124; narrower still the friction of the neck's walls wins, and at 30 % its Q is 43.`,
  },
  {
    title: 'The other ear',
    views: ['Spectrum', 'Scope'],
    preset: 'His largest',
    play: [riff({ times: 3 }), sweep('ear', 0, -60, { dur: 12 })],
    text: `A resonator plugs one ear and leaves the other open to the room. As the sweep closes the other ear, the bass itself goes, and what is left is what the resonator lets through: the fundamentals under its pitch, and the one partial it rings.`,
  },
]);
