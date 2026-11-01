// board-params.js — the Pedalboard's own controls: the bass and how it is plugged in (as the
// Buffer has them, and every pedal that models the pickup takes them from here), and the cables.
// Values in SI units. The pedals' own controls are on their cards on the board.

import { bass, recorded } from '../../buffer/src/buffer-params.js';

const cables = [
  { id: 'cable', label: 'Cable from the bass', min: 0.3, max: 30, def: 3, log: true, unit: 'm', decimals: 1,
    hint: 'The cable from your bass to the first pedal. Into a light input (the Buffer at 1 MΩ, the Tube Preamp) its capacitance tunes the pickup\'s resonance, so a longer one is darker; into the Phuzz\'s few kilohms it hardly matters. After a pedal that buffers, it does not matter at all.' },
  { id: 'patch', label: 'Patch cables', min: 0.15, max: 3, def: 0.3, log: true, unit: 'm', decimals: 2,
    hint: 'Each cable between two pedals (a bypassed pedal adds its own). From a buffered output it makes no difference; from the Phuzz\'s volume pot, turned down, more of it takes off a little top.' },
  { id: 'ampCable', label: 'Cable to the amp', min: 0.3, max: 30, def: 3, log: true, unit: 'm', decimals: 1,
    hint: 'The cable from the last pedal to the amp. Behind the Phuzz turned down, or the Tube Preamp\'s tone stack, which drive it from tens of kilohms, a long one is a low-pass: 30 m darkens the top by several dB.' },
  { id: 'ampLoad', label: 'Amp\'s input', min: 10e3, max: 10e6, def: 1e6, log: true, unit: 'kΩ', scale: 0.001, decimals: 0,
    hint: 'The input impedance of the amp or interface the board drives, usually 1 MΩ. It matters only behind a pedal that drives it from a high impedance: into 10 kΩ, the Tube Preamp with its Master at 40 % is about 16 dB quieter.' },
];

export const GROUPS = [
  { name: 'Your bass', params: bass },
  { name: 'How you are plugged in', params: recorded },
  { name: 'The cables', params: cables },
];
export const PRESETS = {};
export const KEEP = [];

// Boards to start from: the pedals in order, each at one of its presets (or its defaults).
export const BOARDS = {
  'Fuzz first': [['phuzz', 'Full fuzz'], ['wah'], ['cabinet']],
  'Fuzz after a buffer': [['buffer'], ['phuzz', 'Full fuzz'], ['wah'], ['cabinet']],
  'Studio chain': [['opto'], ['preamp'], ['cabinet']],
  'Synth bass': [['octave'], ['envelope'], ['cabinet']],
  'Dub': [['opto'], ['echo', 'Dub bass'], ['spring']],
};
