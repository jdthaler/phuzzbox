// tunnel-tour.js — the guided tour of the Tunnel Diode's physics (shared/tour.js)
import { tour, riff, sweep } from '../../shared/tour.js';

export const TOUR = tour('tunnel', [
  {
    title: 'Through the wall',
    views: ['The diode', 'Scope'],
    preset: 'A switch with memory',
    play: [riff({ times: 2 })],
    text: `In 1958 Leo Esaki found that a germanium junction doped heavily enough conducts less and less past a small forward voltage. Its electrons tunnel straight through the junction while the bands on its two sides line up, up to the peak, 1 mA at 55 mV; past it they stop lining up and the current falls, to the valley, 0.1 mA at 350 mV; beyond, it is an ordinary diode. Between them its resistance is negative, −152 Ω at the steepest. Esaki shared the 1973 Nobel Prize for it.

![The Tunnel Diode: the source through the load, and in the oscillator an inductor, into the diode](schematics/circuit.svg)`,
  },
  {
    title: 'A switch with memory',
    views: ['The switch', 'Scope'],
    preset: 'A switch with memory',
    play: [riff({ times: 2 })],
    text: `Through a 1 kΩ load the load line crosses the curve three times, and the diode rests on one of the outer two. It jumps up only when the source passes 1071 mV, where the low branch ends, and down only when it falls under 412 mV: a Schmitt trigger. Centred at 760 mV with 2 V/V of drive, a note has to peak over 0.155 V to flip it, and comes out a square wave 0.65 V tall; when it dies below that the switch just stops.`,
  },
  {
    title: 'How much memory',
    views: ['The switch', 'Spectrum'],
    preset: 'Narrow memory',
    play: [riff({ times: 2 })],
    text: `The memory is the window between jumping up and jumping down: 0.1 V wide at 330 Ω, 0.66 V at 1 kΩ, 1.7 V at 2.2 kΩ. Narrow, centred at 346 mV, a note of 25 mV flips it, so the riff stays square far into its decay. Under 152 Ω, steeper than the diode's own slope, there is no memory at all.`,
  },
  {
    title: 'Lopsided',
    views: ['The switch', 'Spectrum'],
    preset: 'Lopsided',
    play: [riff({ times: 2 })],
    text: `Bias the switch off the window's centre, at 900 mV, and a note flips it up at 0.085 V but back only at 0.244 V: the square spends longer high than low, and gains even harmonics, a 26 % second where the centred square has under 3 %.`,
  },
  {
    title: 'A relaxation oscillator',
    views: ['The diode', 'Scope'],
    preset: 'Relaxation oscillator',
    play: [riff({ times: 2 }), sweep('bias', 0.1, 0.3, { dur: 6 })],
    text: `Put an inductor in series and a load under 152 Ω, and rest the load line on the falling part: nothing there is stable. The current ramps through the inductor along one branch until the branch ends, the voltage jumps across in nanoseconds, and the current ramps back: the tunnel diode manuals' relaxation oscillator. At 20 Ω it runs for a source between 76 and 352 mV, at 232 Hz at 200 mV with 0.5 H; the bias sweeps it from 125 Hz at 100 mV up to 246 Hz at 250 mV and back to 235 Hz at 300 mV.`,
  },
  {
    title: 'The inductor sets the pitch',
    views: ['The switch', 'Spectrum'],
    preset: 'Relaxation oscillator',
    play: [riff({ times: 2 }), sweep('inductor', 0.05, 5, { dur: 6, log: true })],
    text: `The current has to ramp from the valley's 0.1 mA to the peak's 1 mA and back through the inductor, so the period goes as L: 2.32 kHz at 0.05 H, 232 Hz at 0.5 H, 23.2 Hz at 5 H.`,
  },
  {
    title: 'Gated',
    views: ['The diode', 'Scope'],
    preset: 'Gated buzz',
    play: [riff({ times: 2 })],
    text: `Rest the oscillator at 50 mV, under the 76 mV where it starts, and it is silent until your bass's crests push the source into the window: each note buzzes on its peaks, and stops again at the very top of a strong one, past 352 mV.`,
  },
]);
