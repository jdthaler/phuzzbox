// sabine-tour.js — the guided tour of Sabine's Room's physics (shared/tour.js)
import { tour, riff, sweep } from '../../shared/tour.js';

export const TOUR = tour('sabine', [
  {
    title: 'Sabine\'s law',
    views: ['The decay', 'Spectrum'],
    preset: 'Empty hall',
    play: [riff({ times: 2 })],
    text: `In 1895 Harvard asked a young physicist, Wallace Sabine, why no one could follow a lecture in the Fogg Art Museum's new lecture room. With an organ pipe, a chronograph and his own ears he timed how long a note took to die away there, and in room after room, and found the rule: the time goes as the room's volume over its absorption, T = 55.3 V/(c A), 0.161 V/A in metres, with A every surface's area times the fraction of the sound striking it that it absorbs. This room, 18 by 12 by 6 m, plaster walls on a wooden floor, rings 2.6 s at 1 kHz but 0.9 s at 125 Hz, where the plaster and the floor absorb the most.

![Sabine's Room seen from above: the bass, you, the direct path and a reflection off a side wall](schematics/room.svg)`,
  },
  {
    title: 'A full house',
    views: ['The decay', 'The echogram'],
    preset: 'Empty hall',
    play: [riff({ times: 2 }), sweep('audience', 0, 100, { dur: 8 })],
    text: `Sabine's absorber for his experiments was the seat cushions of Harvard's Sanders Theatre, carried into the lecture room by the armful: each added length of them shortened the reverberation as its absorbing area said it should, and they absorb much as an audience does. People are the best absorbers in most halls. Listen as the sweep fills this one: the reverberation at 1 kHz falls from 2.6 s to 0.8 s, and the room goes from cavernous to clear.`,
  },
  {
    title: 'Images in the walls',
    views: ['The echogram', 'Scope'],
    preset: 'Empty hall',
    play: [riff({ times: 2 })],
    text: `Before the reverberation come the room's first reflections, one by one. Allen and Berkley's image method finds them: mirror the bass in each wall, and those mirror images in the walls again, and every image is a path a reflection takes, as long as the image is far, weakened by √(1 − α) at each bounce. Standing 6 m from the bass, you hear the floor's reflection 1.3 ms after the direct sound. The pedal plays the first 64, and from 62 ms on, when they come too thick to tell apart, the diffuse field, 4π c/V of the bass's energy a second, dying away in Eyring's time.`,
  },
  {
    title: 'Near and far',
    views: ['The echogram', 'The decay'],
    preset: 'Empty hall',
    play: [riff({ times: 2 }), sweep('distance', 1, 20, { dur: 8, log: true })],
    text: `The direct sound falls as 1/d; the reverberation is the same everywhere in the room. Where they are equal is the critical distance, √(A/16π): in this room at 1 kHz just 1.2 m, 2.1 m with a full house. Nearer, you hear the bass; farther, the room. At 6 m the two together are 14 dB over the bass alone. Listen as the sweep walks you back from 1 m to 20.`,
  },
  {
    title: 'Live and dead',
    views: ['The decay', 'Spectrum'],
    preset: 'Drawing room',
    play: [riff({ times: 2 })],
    text: `Hang drapes and lay a carpet in a small room, 7 by 5 by 3 m, and it goes dead: at 1 kHz it rings 0.12 s by Eyring's formula, 0.19 s by Sabine's. Sabine's treats absorption as a steady drain; Eyring saw in 1930 that a sound loses its share 1 − ᾱ at each reflection, striking the walls c S/4V times a second, so that T = 55.3 V/(−c S ln(1 − ᾱ)), which agrees with Sabine's when the walls absorb little and not when they absorb much. Drapes and carpet barely touch the bass's lowest octave, though: at 125 Hz the room still rings 2.0 s.`,
  },
  {
    title: 'The air',
    views: ['The decay', 'Spectrum'],
    preset: 'Cathedral',
    play: [riff({ times: 2 }), sweep('humidity', 10, 90, { dur: 8 })],
    text: `In a big stone room the air itself becomes an absorber, ISO 9613-1's absorption over every metre a sound travels between reflections: 4 m V of absorption area, m the air's attenuation. In this cathedral, 60 by 25 by 20 m, the air does 61 % of the absorbing at 4 kHz, and the treble dies in 3.5 s while 250 Hz rings 16 s. Dry air takes the most: at 10 % humidity 4 kHz rings 1.3 s, at 90 %, 4.3 s. Listen as the sweep moistens the air and the treble comes back.`,
  },
]);
