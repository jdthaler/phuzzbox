// spring-tour.js — the guided tour of the Spring Reverb's physics (shared/tour.js)
import { tour, note, riff, sweep } from '../../shared/tour.js';

export const TOUR = tour('spring', [
  {
    title: 'A twist sent down a coil',
    views: ['The springs', 'The echoes'],
    preset: 'Spring under the bass',
    play: [riff({ times: 2 })],
    text: `![The drive coil turns a magnetic bead, the springs carry the twist to a second bead, and its coil hears it](schematics/circuit.svg)

A reverb tank is a few steel springs hung between two magnetic beads. The drive coil twists one bead with your bass, the twist runs down the springs, and the coil at the far end hears the other bead turn. The echoes bounce between the beads, losing a little at each.

**The springs** shows the tank slowed a hundred times: each note you play sent into the drive bead, the twist running down every spring and back. **The echoes** shows a click through the tank: not a smooth wash, but a string of arrivals.`,
  },
  {
    title: 'Every echo a chirp',
    views: ['The echoes', 'Spectrum'],
    preset: 'One spring, nearly lossless',
    play: [note('E2', { dur: 0.15, vel: 1 }), note('A2', { at: 2, dur: 0.15, vel: 1 }), note('D3', { at: 4, dur: 0.15, vel: 1 })],
    text: `One spring, its mounts losing only 0.05 dB a bounce. Waves on a coil of wire are dispersive: up to the transition frequency F_C, 4889 Hz on this spring, the higher a component, the slower it travels. Near 300 Hz a click arrives after 20.9 ms; near 3600 Hz, after 31.0 ms.

So each echo comes back as a rising *pew*, the lows first, and the next one 2L/c_g(f) later, smeared a little more every time round. The dotted lines are those arrival times from the spring's dispersion; the engine's echoes fall on them.`,
  },
  {
    title: 'Three springs blur',
    views: ['The echoes', 'Scope'],
    preset: 'Surf drip',
    play: [riff({ times: 2 }), { at: 6, set: { tank: 'one' } }, riff({ at: 6, times: 2 })],
    text: `The Leem tank hangs three springs cut differently, echoing every 41.8, 40.4 and 52.9 ms. Their echoes soon stop lining up, and the tank becomes a wash.

Halfway, the tank goes to its first spring alone: the echoes come back crisp and countable.`,
  },
  {
    title: 'The wire sets the chirp',
    views: ['The echoes'],
    preset: 'One spring, nearly lossless',
    play: [note('A2', { dur: 0.15, vel: 1 }), note('A2', { at: 2.5, dur: 0.15, vel: 1 }), sweep('wire', 0.35e-3, 0.22e-3, { at: 1.5, dur: 1 })],
    text: `The wire's thickness sets both the speed of the waves and where the chirps stop: T_D goes as 1/r and F_C as r. Here the wire thins from 0.35 mm to 0.22 mm between the two notes.

The second note's echoes come later and its chirps top out lower. A thin-wire tank is slower and twangier.`,
  },
  {
    title: 'Where the energy goes',
    views: ['The echoes', 'Spectrum'],
    preset: 'Spring under the bass',
    play: [riff({ times: 1 }), { at: 3.5, set: { oil: 8 } }, riff({ at: 3.5, times: 1 }), { at: 7, set: { oil: 0, steel: 2e-3 } }, riff({ at: 7, times: 1 })],
    text: `Three losses decide how long the tank rings. Each bead takes 0.4 dB of a wave as it turns back; the steel's own friction takes the highs first; and oil, as Hammond used, drags on every frequency alike.

First the tank as it is, then in an oil bath (shorter, same colour), then with lossy steel (the tail goes dark as it dies).`,
  },
]);
