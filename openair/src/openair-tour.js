// openair-tour.js — the guided tour of Open Air's physics (shared/tour.js)
import { tour, riff, sweep } from '../../shared/tour.js';

export const TOUR = tour('openair', [
  {
    title: 'Two paths',
    views: ['The response', 'Scope'],
    preset: 'Across a field',
    play: [riff({ times: 2 })],
    text: `Out of doors your bass reaches a listener twice: straight across, and bounced off the ground, as if from its image beneath it. Over a mirror the two would arrive in phase at the bottom, 6 dB up, and cancel wherever the reflected path is half a wavelength longer, which 100 m away, with the bass 1 m up and the listener 1.6 m, is first at 5.4 kHz. Grass is no mirror. Its reflection comes back shifted in phase, and pulls that null down to 500 Hz, 18 dB deep: the ground effect.

![Open Air: the bass and you over the ground, the direct path and the reflected one](schematics/field.svg)`,
  },
  {
    title: 'Soft ground',
    views: ['The ground', 'The response'],
    preset: 'Fresh snow',
    play: [riff({ times: 2 })],
    text: `What sets the dip is how readily air flows into the ground, its flow resistivity. Fresh snow is mostly air, and puts the dip at 190 Hz, in the middle of the bass; a forest floor at 240 Hz; grass at 500 Hz; a dirt road at 1.6 kHz. Near grazing a plane wave would come back almost whole but turned over, and cancel the direct sound; a real source's wave is spherical, and along soft ground part of it travels as a ground wave, which Weyl and van der Pol's formula adds: at 100 Hz a kilometre over grass the plane wave's reflection is −0.91, but the spherical wave's |Q| is 1.78.`,
  },
  {
    title: 'Walking away',
    views: ['The response', 'Spectrum'],
    preset: 'Across a field',
    play: [riff({ times: 2 }), sweep('distance', 30, 1000, { dur: 8, log: true })],
    text: `Back away across the field and the dip deepens, 18 dB at 100 m and 40 dB at 1 km, as the reflection comes in ever closer to grazing, while the air takes more and more of the treble. Listen as the sweep walks you from 30 m to a kilometre: the bass keeps its fundamental, 6 dB up, and loses its body and its edge.`,
  },
  {
    title: 'What the air takes',
    views: ['The response', 'Spectrum'],
    preset: 'Dry air',
    play: [riff({ times: 2 }), sweep('humidity', 10, 70, { dur: 6 })],
    text: `The air soaks up sound because its oxygen and nitrogen molecules take a moment to pass on the vibration a sound wave gives them, and water vapour hurries them along. ISO 9613-1 writes it down. Over a kilometre at 20 °C, 2 kHz loses 45 dB at 10 % humidity but 10 dB at 50 %, and at 50 %, 4 kHz loses 30 dB at 20 °C but 71 dB at 0 °C. Listen as the sweep makes the dry air humid and the treble comes back.`,
  },
  {
    title: 'A hard ground',
    views: ['The response', 'The ground'],
    preset: 'Car park',
    play: [riff({ times: 2 }), sweep('source', 0.2, 3, { dur: 6 })],
    text: `Asphalt lets no air in: it is a mirror, Q = 1, and the response is the two paths' pure interference, a comb. 30 m across a car park the first null is at 1.6 kHz and the next at three times that, 4.8 kHz. Raise the bass and the reflected path grows longer, and the comb's teeth close up and slide down into the bass's harmonics.`,
  },
]);
