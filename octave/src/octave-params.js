// octave-params.js — the Octave Down's controls. Values in SI units; `scale` shows them in
// friendlier ones. The circuit is the analog octave divider: a tracking filter, a comparator with
// hysteresis, two flip-flops, and a switch that flips the filtered bass's polarity on each.

const mix = [
  { id: 'dry', label: 'Dry', min: 0, max: 1, def: 0.7, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'Your bass as it came in, under the octaves.' },
  { id: 'oct1', label: 'One octave down', min: 0, max: 1, def: 0.8, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'The filtered bass with its polarity flipped by the first flip-flop, which toggles once a cycle: a wave that repeats every two cycles, an octave below.' },
  { id: 'oct2', label: 'Two octaves down', min: 0, max: 1, def: 0, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'The same, flipped by a second flip-flop that toggles on every other cycle: two octaves below. On a low E it is 10 Hz, felt more than heard; it comes into its own above the 5th fret.' },
];

const divider = [
  { id: 'track', label: 'Tracking filter', min: 40, max: 1000, def: 70, log: true, unit: 'Hz', decimals: 0, perform: true,
    hint: 'The two-pole low-pass ahead of the comparator, whose output the switch also flips. It takes the harmonics off so the comparator crosses once a cycle. Lower tracks the low strings cleanly but dulls the octave and leaves high notes weak in its roll-off; higher lets a low string\'s strong second harmonic flip the comparator twice a cycle, and the octave warbles or jumps up to the note itself.' },
  { id: 'hyst', label: 'Hysteresis', min: 0.5e-3, max: 50e-3, def: 5e-3, log: true, unit: 'mV', scale: 1000, decimals: 1,
    hint: 'How far past zero the filtered signal must swing to flip the comparator. More ignores noise and the wobble of a decaying note, but a note that dies below it stops the dividers: the octave holds one polarity and passes the note at its own pitch.' },
  { id: 'tone', label: 'Tone', min: 150, max: 5000, def: 900, log: true, unit: 'Hz', decimals: 0,
    hint: 'A one-pole low-pass after the switch. The flips are clean at the zero crossings, so the octave is smooth already; lower is rounder and more like a synth\'s sub, higher keeps more of the string\'s edge.' },
  { id: 'level', label: 'Level', min: -24, max: 12, def: 0, unit: 'dB', decimals: 1,
    hint: 'Gain after the mix, in decibels.' },
];

export const GROUPS = [
  { name: 'The mix', params: mix },
  { name: 'The divider', params: divider },
];

export const PRESETS = {
  'Octave under': { dry: 0.7, oct1: 0.8, oct2: 0, track: 70, hyst: 5e-3, tone: 900 },
  'Octave alone': { dry: 0, oct1: 1, oct2: 0, track: 70, hyst: 5e-3, tone: 900 },
  'Sub synth': { dry: 0.3, oct1: 0.8, oct2: 0.5, track: 60, hyst: 5e-3, tone: 400 },
  'High notes, two down': { dry: 0.6, oct1: 0.4, oct2: 0.8, track: 150, hyst: 5e-3, tone: 1200 },
  'Tracking too high': { dry: 0, oct1: 1, oct2: 0, track: 1000, hyst: 0.5e-3, tone: 2500 },
};
export const KEEP = ['level'];
