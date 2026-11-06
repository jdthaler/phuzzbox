// lampvibe-tour.js — the guided tour of the Lamp Vibe's physics (shared/tour.js)
import { tour, note, riff, sweep } from '../../shared/tour.js';

export const TOUR = tour('lampvibe', [
  {
    title: 'A light bulb in the signal path',
    views: ['The lamp', 'The phase'],
    preset: 'Chorus',
    bypass: true,
    play: [note('A1', { dur: 2.4, vel: 0.8 }), { at: 2.5, bypass: false }, note('A1', { at: 2.6, dur: 3, vel: 0.8 }), riff({ at: 5.8 })],
    text: `First the bass straight, then through the vibe. A slow oscillator dims and brightens a small tungsten lamp, and the lamp shines on four photocells. Each cell is the resistor of a stage that passes every frequency at full strength but delays its phase.

![The Lamp Vibe: an oscillator lights a lamp, the lamp four photocells, and each cell sets one of four all-pass stages in the signal's path](schematics/vibe.svg)

Mixed with the dry signal, the stages cancel it wherever they have turned a frequency by 180° or 540°: two notches, at 131 Hz and 3.7 kHz with the lamp at full. As the lamp dims, the cells' resistance climbs and the notches slide down. **The phase** shows them moving.`,
  },
  {
    title: 'The filament is a black body',
    views: ['The glow', 'The lamp'],
    preset: 'Slow throb',
    play: [riff({ times: 2 })],
    text: `The filament glows because it is hot: it is a black body, and its spectrum is Planck's. At 2500 K most of its light is infrared. The cells see only a band of greens around 540 nm (shaded), on the short side of the peak, where the spectrum swells fastest as the filament warms.

From 2000 K to 2500 K the light the cells see grows elevenfold, while the power the filament radiates only triples. A modest swing in temperature becomes a deep swing in light, and in the cells' resistance.`,
  },
  {
    title: 'Heats fast, cools slowly',
    views: ['The lamp', 'Scope'],
    preset: 'Chorus',
    play: [riff({ times: 3 }), sweep('speed', 1, 12, { at: 0.5, dur: 14, log: true })],
    text: `The filament stores heat. Its current warms it, and it cools by radiating, as T⁴ (Stefan–Boltzmann). A hot filament sheds heat fast; a dim one only slowly, so the lamp lingers in the dark part of each cycle. At its rating the pilot lamp settles in 12.9 ms; at half its voltage, two and a half times longer.

Now the oscillator speeds up from 1 Hz to 12. The filament can't keep up: at 1 Hz it swings between 1710 K and 2500 K, at 12 Hz only between 2010 K and 2390 K. Watch **The lamp**'s yellow trace flatten.`,
  },
  {
    title: 'A bigger bulb',
    views: ['The lamp', 'The phase'],
    preset: 'Grain of wheat, quick',
    play: [riff({ times: 2 }), { at: 6, set: { bulb: 'panel' } }],
    text: `A grain-of-wheat lamp, at 6 Hz: its filament is 11 µm thick, settles in 6.2 ms, and keeps up. Halfway, a 5 W panel bulb goes in the socket: a 46 µm filament with more heat to store for the light it gives, settling in 25.5 ms. Its temperature swings far less, and the sweep goes shallow.`,
  },
  {
    title: 'Vibrato: the phase slides, the pitch wavers',
    views: ['The phase', 'Spectrum'],
    preset: 'Vibrato',
    play: [note('A1', { dur: 3.5, vel: 0.8 }), riff({ at: 3.8 })],
    text: `Now the stages alone, without the dry signal. Nothing cancels, so there are no notches, but as the lamp sweeps the cells, each note's phase slides back and forth. A phase that turns is a frequency that moves, by Δf = (1/2π) dφ/dt: the note wavers in pitch, as from a moving source.`,
  },
]);
