// plate-tour.js — the guided tour of the Plate Reverb's physics (shared/tour.js)
import { tour, note, riff } from '../../shared/tour.js';

export const TOUR = tour('plate', [
  {
    title: 'A sheet of steel',
    views: ['The plate', 'Scope'],
    preset: 'Studio plate',
    play: [riff({ times: 2 })],
    text: `![A steel plate 2 m by 1 m, its driver, two pickups and the damper behind it](schematics/plate.svg)

A plate reverb is a sheet of steel, 2 m by 1 m and 0.5 mm thick, hung in a frame. A driver shakes it near the middle; two pickups listen near the ends, one for each side.

**The plate** shows it from above, slowed a hundred times, as each note you play reaches it: red where it is moving up, blue where down. Watch the ripples spread from the driver and come back off the edges. The orange dot is the driver and the white ones the pickups: drag them.`,
  },
  {
    title: 'Thousands of modes',
    views: ['The plate', 'Spectrum'],
    preset: 'All plate',
    play: [note('E1', { dur: 3, vel: 0.9 }), note('G3', { at: 3.5, dur: 3, vel: 0.9 })],
    text: `A thin plate bends as Kirchhoff's plate, and with its edges held its modes are at ω = κ[(mπ/Lx)² + (nπ/Ly)²], κ = 0.7637 m²/s. They are spread evenly: 1.31 modes in every hertz, 6432 of them up to 5 kHz.

Every one is played. A low note moves a few broad ones, a higher note many finer ones.`,
  },
  {
    title: 'Where the driver sits',
    views: ['The plate', 'Spectrum'],
    preset: 'All plate',
    set: { driveX: 1 },
    play: [note('A1', { dur: 2.5, vel: 0.9 }), { at: 3, set: { driveX: 0.8 } }, note('A1', { at: 3, dur: 2.5, vel: 0.9 })],
    text: `The driver moved to the middle of the plate, 1 m across. Every mode with an even number of half-waves across has a nodal line through the middle, so the driver cannot play it: half of them, 49.8 % to 5 kHz, fall silent, and the ripples spread from the middle in a pattern that is the same either side.

Then the driver goes back to 0.8 m, two fifths of the way across, where only the modes with a multiple of five half-waves across are silent. The pickups work the same way: one on a mode's nodal line hears nothing of it.`,
  },
  {
    title: 'The highs arrive first',
    views: ['Scope', 'The plate'],
    preset: 'All plate',
    play: [note('G3', { dur: 0.4, vel: 1 }), note('G3', { at: 2, dur: 0.4, vel: 1 })],
    text: `A bending wave's speed rises with its frequency: c_g = 2√(κω), 139 m/s at 1 kHz and 277 m/s at 4 kHz. So every sound reaches the pickups as a falling chirp, the highs first.

The left pickup is 0.60 m from the driver: 4 kHz reaches it in 2.17 ms, 1 kHz in 4.34 ms. Nothing in the engine knows about waves; they come out of the sum of the modes.`,
  },
  {
    title: 'The steel takes the highs',
    views: ['The decay', 'Spectrum'],
    preset: 'Long and dark',
    play: [riff({ times: 2 })],
    text: `As the plate bends, one face warms and the other cools, and heat flows across it: the thermoelastic loss. With what it radiates into the air, the steel alone lets 100 Hz ring 10.3 s, but 1 kHz only 2.35 s and 4 kHz 2.18 s.

So a long plate is a dark one. **The decay** shows how long each frequency rings, against the steel alone.`,
  },
  {
    title: 'The damper',
    views: ['The decay', 'Scope'],
    preset: 'Short and tight',
    play: [riff({ times: 2 }), { at: 4, set: { decay: 3 } }],
    text: `The plate's lever moves a porous mat nearer it or further away. The mat takes the same from every frequency, so it is the low notes, which the steel keeps longest, that it sets: Decay is how long 100 Hz rings.

Here it is 0.8 s, and at 4 s it moves to 3 s: then 1 kHz rings 1.51 s and 4 kHz 1.44 s.`,
  },
]);
