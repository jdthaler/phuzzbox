// transformer-tour.js — the guided tour of the Output Transformer's physics (shared/tour.js)
import { tour, riff, sweep } from '../../shared/tour.js';

export const TOUR = tour('transformer', [
  {
    title: 'Iron with a memory',
    views: ['The core', 'Scope'],
    preset: 'Iron',
    play: [riff({ times: 2 })],
    text: `A valve amplifier can't drive a 4 Ω speaker directly: its output valves want a load of thousands of ohms. The output transformer makes one, 4.2 kΩ on its primary for 4 Ω on its secondary, by winding both on an iron core. The iron carries the flux between them, and iron remembers: its magnetic domains grow and shrink by walls that stick on defects in the metal and jump past them, so the flux density B follows the field H round a loop, never the same way twice. Jiles and Atherton wrote that loop as an equation in 1986. The dots are the core as you play.

![The Output Transformer: the output valves as a source behind their plate resistance, into the transformer's primary; the speaker on its secondary](schematics/stage.svg)`,
  },
  {
    title: 'The low notes need the most flux',
    views: ['The flux', 'Spectrum'],
    preset: 'Iron',
    play: [riff({ times: 2 })],
    text: `The primary's voltage is N A dB/dt, Faraday's law, so a note of peak voltage V swings the flux density by V/(2π f N A): half as much each octave up. With the stock parts a 1 V low E takes the iron to 1.4 T and comes out with an 11 % third harmonic, while a 1 V G two octaves up needs only 0.7 T and keeps it to 3 %. The bass saturates a transformer long before the treble does.`,
  },
  {
    title: 'How big the iron',
    views: ['The flux', 'Scope'],
    preset: 'Big iron',
    play: [riff({ times: 2 }), sweep('area', 3e-3, 3e-4, { dur: 6, log: true })],
    text: `Double the core's area and every note needs half the flux, and the primary's inductance doubles too. At 30 cm² a 0.3 V low E comes out with a 4.7 % third harmonic; at 3 cm², 18 %, and a 1 V low E saturates it outright, 10 dB down with a third harmonic half the note. Listen as the sweep shrinks the core.`,
  },
  {
    title: 'What drives it',
    views: ['The core', 'Scope'],
    preset: 'Stiff source',
    play: [riff({ times: 2 }), sweep('source', 500, 20000, { dur: 6, log: true })],
    text: `The valves drive the primary through their plate resistance. The current that magnetises the core drops a voltage across it, so the stiffer the source, the more the flux simply follows the voltage, and the less of the iron you hear: a 0.3 V low E comes out 0.7 dB down with a 2.4 % third harmonic at 500 Ω, but 15 dB down with 19 % at 20 kΩ, the bass going to ground through the primary's inductance.`,
  },
  {
    title: 'Softer iron',
    views: ['The core', 'Spectrum'],
    preset: 'Permalloy',
    play: [riff({ times: 2 })],
    text: `Alloyed with nickel, the loop narrows. The iron's loop is 390 A/m wide at B = 0; 50 % nickel–iron's is 3.9 A/m, permalloy's 0.57 A/m. A narrow loop is clean until it saturates, but nickel saturates sooner: at 1.2 T, and permalloy at 0.77 T, against the iron's 2.0 T. On a 5 cm² permalloy core a 0.3 V low E already flattens, with a 30 % third harmonic, while the G stays clean.`,
  },
]);
