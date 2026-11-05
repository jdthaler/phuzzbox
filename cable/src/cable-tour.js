// cable-tour.js — the guided tour of the Transatlantic Cable's physics (shared/tour.js)
import { tour, note, riff, sweep } from '../../shared/tour.js';

export const TOUR = tour('cable', [
  {
    title: 'A cable is a ladder',
    views: ['Along the cable', 'The response'],
    preset: '1858 cable, 100 km',
    bypass: true,
    play: [riff(), { at: 3, bypass: false }, riff({ at: 3.2, times: 2 })],
    text: `First the bass straight, then down 100 km of the first Atlantic telegraph cable. Every metre of a cable is a little resistance and inductance in series and a little capacitance across, and the signal has to charge the cable as it goes.

![The line: a source, a ladder of sections of cable, the far end and a repeater](schematics/line.svg)

On a submarine cable the resistance and capacitance rule, and a sine's loss in decibels grows as the square root of its frequency. 100 km passes 1 kHz 15 dB below the bass. **Along the cable** shows the voltage down the line: the note seeps in and dies away, the higher notes sooner.`,
  },
  {
    title: 'Kelvin\'s law of squares',
    views: ['The arrival', 'Along the cable'],
    preset: '1858 cable, 100 km',
    play: [riff({ times: 3 }), sweep('length', 50e3, 200e3, { at: 0.5, dur: 12, log: true })],
    text: `Without its inductance, the cable is the heat equation: a volt switched on at one end seeps down it as heat does down a bar. Thomson solved it: with the far end open, the far end reaches half the volt at 0.379 RCℓ². The time grows as the square of the length.

Now the cable grows from 50 km to 200. **The arrival** shows a volt switched on at your end: for the 1858 cable RCℓ² is 6.3 ms for 100 km, and for the 3200 km across the Atlantic 6.4 s; a pulse took 2.4 s to reach half its height.`,
  },
  {
    title: 'Coils: a clearer line, with an edge',
    views: ['The response', 'Spectrum'],
    preset: 'Telephone pair, 10 km',
    play: [riff({ times: 2 }), { at: 6, set: { length: 30e3, loading: 'coils' } }, riff({ at: 6.2, times: 2 })],
    text: `10 km of telephone pair, dull. Then three times as long, with a loading coil every 1.83 km, as Pupin and Campbell worked out. The coils give the line inductance enough to carry the signal as a wave: down 30 km, 1 kHz arrives 20 dB louder than without them.

![Loading coils: one every 1.83 km, the cable between them](schematics/coils.svg)

But a ladder of coils and capacitance has a cutoff, where each section turns the wave by half a cycle: 3.4 kHz with 88 mH coils. Above it nothing arrives at all.`,
  },
  {
    title: 'Heavier coils, a lower cutoff',
    views: ['The response', 'Scope'],
    preset: 'Heavy coils: a lower cutoff',
    play: [riff({ times: 3 })],
    text: `250 mH coils on the same pair: the cutoff falls to 2.0 kHz, f_c = 1/(π√((L_coil + L d) C d)). The line sounds like a telephone line for this reason.`,
  },
  {
    title: 'Heaviside\'s distortionless line',
    views: ['Scope', 'The response'],
    preset: 'Heaviside: a clean delay',
    play: [note('A1', { dur: 2.5, vel: 0.8 }), riff({ at: 2.8, times: 2 })],
    text: `Heaviside saw that a line with L/R = C/G loses every frequency alike and delays every frequency alike: γ = √(RG) + iω√(LC) exactly. This is 100 km of the 1866 cable with 1 H/km added along it, and just enough leakage: the bass arrives 35.9 ms late, 0.7 dB down, and whole.`,
  },
  {
    title: 'The far end open: echoes',
    views: ['Along the cable', 'Scope'],
    preset: 'Heaviside, far end open: echoes',
    play: [note('E1', { dur: 0.25, vel: 0.9 }), note('A1', { at: 2, dur: 0.25, vel: 0.9 }), riff({ at: 4 })],
    text: `Now the far end opens into an amplifier's megohm. The wave doubles there and runs back; the battery's few ohms, nearly a short, turn it over and send it out again. You hear the reflections one round trip apart, 72 ms, alternating, dying away by the line's loss each way.`,
  },
]);
