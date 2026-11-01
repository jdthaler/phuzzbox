// envelope-tour.js — the guided tour of the Envelope Filter's physics (shared/tour.js)
import { tour, note, riff, sweep } from '../../shared/tour.js';

export const TOUR = tour('envelope', [
  {
    title: 'A filter tuned by light',
    views: ['The filter', 'The sweep'],
    preset: 'Quack (band-pass)',
    play: [riff({ times: 2 })],
    text: `![The follower lights an LED, and the LED lights the photocells that set the filter's cutoff](schematics/circuit.svg)

A state-variable filter is two integrators in a loop, and each integrates at 1/(RC). Here each R is a photocell. An envelope follower hears how hard you play and lights an LED. The LED lights both cells, their resistance falls, and the cutoff rises.

So every note sweeps the filter. **The sweep** shows the cutoff and the LED's current as you play.`,
  },
  {
    title: 'The quack: a peak passing the harmonics',
    views: ['The filter', 'Spectrum'],
    preset: 'Quack (band-pass)',
    play: [note('A1', { dur: 1.5, vel: 0.9 }), note('A1', { at: 1.8, dur: 1.5, vel: 0.5 }), note('E1', { at: 3.6, dur: 2, vel: 1 })],
    text: `The band-pass output peaks at the cutoff, Q times the input. With 47 nF capacitors the cutoff rests at 101.2 Hz with the cells dark, and the LED's 20 mA can take it to 1537 Hz.

A pluck takes the peak up through the note's harmonics and lets it fall back through them, and each one rings out as the peak passes: *wow*. The softer second note sweeps less far.`,
  },
  {
    title: 'Resonance',
    views: ['The filter', 'Scope'],
    preset: 'Quack (band-pass)',
    play: [riff({ times: 3 }), sweep('reso', 1, 12, { at: 0.5, dur: 10, log: true })],
    text: `**Resonance** is the filter's Q, set by how little its damping resistor damps the loop. It grows here from 1 to 12.

Low, the sweep is a gentle tone control. High, the peak is tall and narrow, and it whistles as it moves: the squelch.`,
  },
  {
    title: 'Low-pass and down',
    views: ['The filter', 'The sweep'],
    preset: 'Synth bass (low-pass)',
    play: [riff({ times: 2 }), { at: 6, set: { direction: 'down', mode: 'bp' } }, riff({ at: 6, times: 2 })],
    text: `Low-pass keeps the bottom and opens the top with each pluck, like a synthesizer's filter.

Halfway, **Direction** goes to Down. The LED stands at 5 mA, which rests the cutoff at 948 Hz, and the follower now subtracts from it. Each pluck dims the LED and pulls the filter down, and it opens again as the note fades.`,
  },
  {
    title: 'The photocells remember',
    views: ['The sweep'],
    preset: 'Slow cells',
    play: [note('A1', { dur: 0.3, vel: 1 }), note('A1', { at: 2, dur: 3, vel: 1 })],
    text: `The follower lets go fast here, but the cells don't. Their free electrons outlive the light by the carrier lifetime, so the cutoff falls back more lazily than the follower asks.

And while they are lit, some electrons fall into traps that hold them for seconds. The short note barely fills them, and the filter drops back at once. The long one fills them (blue), and after it the cutoff takes longer to come all the way down. It is the same photocell physics as the Opto Compressor's slow release.`,
  },
]);
