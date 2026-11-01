// opto-tour.js — the guided tour of the Opto Compressor's physics (shared/tour.js)
import { tour, note, riff, sweep } from '../../shared/tour.js';

export const TOUR = tour('opto', [
  {
    title: 'A light and a photocell',
    views: ['The cell', 'Scope'],
    preset: 'Even fingerstyle',
    play: [riff({ times: 2 })],
    text: `Nothing in the signal path is an amplifier that changes its gain. The bass goes through a 47 kΩ resistor, and a photocell shunts it to ground: the brighter the cell is lit, the lower its resistance and the more it takes away.

What lights it is an electroluminescent panel, a phosphor that glows when there is voltage across it. A driver amplifies the signal coming out of the cell onto the panel. So the louder you play, the brighter the panel, and the lower the cell's resistance: the bass levels itself. **The cell** shows how far it is turned down (orange), and the panel's light (green).`,
  },
  {
    title: 'Catching a note',
    views: ['The cell', 'Scope'],
    preset: 'Even fingerstyle',
    play: [note('E1', { dur: 2.5, vel: 1 }), note('A1', { at: 3, dur: 2.5, vel: 0.5 })],
    text: `The panel's brightness rises steeply with voltage, as exp(−b/√V) for a powder phosphor. So a hard note lights it brightly at once, before the cell has done anything.

The cell's electrons pile up while it is lit, and its resistance falls as they do. Within about 10 ms the note is turned down. The panel only ever sees what the cell lets through, so as the cell acts, the panel dims to just enough to hold the note there. Watch the Scope: the front of the note gets through, then it settles.`,
  },
  {
    title: 'Letting go, with memory',
    views: ['The cell'],
    preset: 'Even fingerstyle',
    play: [note('A1', { dur: 0.3, vel: 1 }), note('A1', { at: 3, dur: 4, vel: 1 })],
    text: `When the light goes, the free electrons recombine within their lifetime, and half the gain comes back in under a tenth of a second. But while the cell was lit, some electrons fell into traps, defects in the crystal that hold them. Once it is dark, the traps let them go slowly, and each one has to recombine all over again.

The first note is short, and its traps barely fill (blue): the cell lets go almost at once. The second is held for four seconds. The traps fill, and the last few decibels take seconds to come back. That is the classic leveler's program-dependent release, and it is the photocell's physics, not a circuit.`,
  },
  {
    title: 'Peak Reduction and the curve',
    views: ['The curve', 'The cell'],
    preset: 'Even fingerstyle',
    play: [riff({ times: 3 }), sweep('peak', 0.3, 0.85, { at: 0.5, dur: 10 })],
    text: `**Peak Reduction** is a pot ahead of the panel's driver. **The curve** shows what a steady note comes out at, against what goes in.

As it turns up, the curve bends over sooner: quieter notes light the panel too. Above the bend, it keeps climbing slowly. Feedback can't turn the bass down to nothing, because the panel needs some signal to stay lit. That gentle, self-limiting ratio is the leveler's sound.`,
  },
  {
    title: 'Listening before the cell',
    views: ['The curve', 'Scope'],
    preset: 'Feed-forward punch',
    play: [riff({ times: 3 })],
    text: `Flip **Sense** to before the cell, and the panel hears the bass itself, not what the cell has done to it.

Two things change. Nothing holds the panel back, so the cell settles onto a note more slowly, and the front of every note gets through: punch. And the panel's light rises faster with level than the cell can follow with its divider. So past a point, the curve turns back down: a harder note comes out quieter than a softer one.`,
  },
  {
    title: 'Low notes flicker',
    views: ['Spectrum', 'Scope'],
    preset: 'Squashed',
    play: [note('E1', { dur: 3, vel: 1 }), { at: 3.5, set: { afterglow: 8e-3 } }, note('E1', { at: 3.5, dur: 3, vel: 1 })],
    text: `The panel glows on every half-cycle of the voltage across it, and goes dark at every zero crossing. On a high note those flashes come too fast for the cell to notice. On a low E, 82 flashes a second against the phosphor's 1 ms afterglow, the cell's resistance ripples a little within each cycle, and that ripple is distortion: listen for the edge on the low notes.

Halfway through, the afterglow becomes 8 ms. The phosphor smooths its own flashes, and the low E comes out cleaner.`,
  },
]);
