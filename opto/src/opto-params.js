// opto-params.js — the Opto Compressor's controls. Values in SI units; `scale` shows them in
// friendlier ones. The fixed parts (the 47 kΩ series resistor, the driver's gain, the cell's
// recombination and traps) are in native/pedals/opto/opto-model.h and the README.

const leveler = [
  { id: 'peak', label: 'Peak Reduction', min: 0, max: 1, def: 0.55, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'How much of the signal reaches the panel\'s driver: an audio pot. Turn it up and the panel lights on quieter notes, so the pedal turns the bass down sooner and further: at 30 % only hard notes (0.3 V and up) reach it; past 70 % even a gentle 30 mV note loses several decibels.' },
  { id: 'gain', label: 'Gain', min: 0, max: 40, def: 8.5, unit: 'dB', decimals: 1, perform: true,
    hint: 'Make-up gain after the cell, in decibels: it puts back what the cell takes away, and changes nothing about how hard it compresses (the panel listens before it). +6 dB doubles the output.' },
  { id: 'sense', label: 'Sense', type: 'select', def: 'output', options: [['output', 'After the cell (feedback)'], ['input', 'Before the cell (feed-forward)']],
    hint: 'Where the panel\'s driver listens. After the cell, as the classic leveler does, a note lights the panel hardest at its start, before the cell has turned it down, so the cell catches the attack in about 10 ms, and louder in is always a little louder out. Before it, the panel sees only the note, never what the cell has done to it: the cell settles onto it more slowly, so the front of each note gets through (punch), and dug in hard enough, a louder note comes out quieter than a softer one.' },
  { id: 'blend', label: 'Clean blend', min: 0, max: 1, def: 0, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'Mixes your dry signal back in after the make-up gain (parallel compression): the leveled body underneath, the attack of each note on top.' },
];

const panel = [
  { id: 'panelB', label: 'Panel\'s voltage constant', min: 30, max: 120, def: 70, unit: '√V', decimals: 0,
    hint: 'The b in the panel\'s brightness, exp(−b/√V): how steeply its light rises with the voltage across it. Larger, the panel stays dark longer and then flares: it lights on fewer notes, and a loud note\'s first moment hits the cell harder, so the attack gets faster.' },
  { id: 'afterglow', label: 'Phosphor afterglow', min: 0.2e-3, max: 10e-3, def: 1e-3, log: true, unit: 'ms', scale: 1e3, decimals: 1,
    hint: 'How long the panel\'s phosphor keeps glowing after the voltage falls: it flashes on every half-cycle of the note, and the afterglow smooths the flashes. Longer, a low note flickers the cell less (less low-note distortion) but the attack is a little slower.' },
  { id: 'swing', label: 'Driver\'s swing', min: 50, max: 300, def: 150, unit: 'V', decimals: 0,
    hint: 'The most voltage the driver can put across the panel. It caps how bright the panel gets, and so how hard the cell can be lit: lower it and the deepest gain reduction, on the loudest notes, is less.' },
];

const cell = [
  { id: 'litR', label: 'Cell\'s resistance, lit', min: 300, max: 20e3, def: 2e3, log: true, unit: 'kΩ', scale: 1e-3, decimals: 2,
    hint: 'The photocell\'s resistance under the panel\'s reference glow. It shunts the signal to ground after a 47 kΩ resistor, so the lower it gets, the deeper the cell can turn the bass down: a smaller value compresses more at every setting.' },
  { id: 'darkR', label: 'Cell\'s dark resistance', min: 0.5e6, max: 50e6, def: 5e6, log: true, unit: 'MΩ', scale: 1e-6, decimals: 1,
    hint: 'The cell\'s resistance with the panel dark. It is always across the signal, so it sets the small loss the pedal has at rest: 0.1 dB at 5 MΩ, about 0.8 dB at 0.5 MΩ.' },
  { id: 'lifetime', label: 'Carrier lifetime (fast release)', min: 10e-3, max: 300e-3, def: 60e-3, log: true, unit: 'ms', scale: 1e3, decimals: 0,
    hint: 'How long a free electron in the cell lasts before it recombines. It sets the first, fast part of the release: at 60 ms, half the gain reduction comes back in 70 to 90 ms, a little longer the longer the note was held. Shorter, a quicker release and a quicker attack; longer, both slower.' },
  { id: 'trapTime', label: 'Trap release time (memory)', min: 0.2, max: 10, def: 1.5, log: true, unit: 's', decimals: 1,
    hint: 'How long electrons stay caught in the cell\'s traps. The longer a note keeps the cell lit, the fuller its traps; once the light goes, they let their electrons go slowly, and the last few decibels come back over seconds. Longer, a longer memory: after a held note the bass stays turned down longer.' },
];

export const GROUPS = [
  { name: 'The leveler', params: leveler },
  { name: 'The panel', params: panel },
  { name: 'The cell', params: cell },
];

// Each preset shows one idea.
const stock = { peak: 0.55, gain: 10, sense: 'output', blend: 0, panelB: 70, afterglow: 1e-3, swing: 150, litR: 2e3, darkR: 5e6, lifetime: 60e-3, trapTime: 1.5 };
export const PRESETS = {
  'Gentle leveling': { ...stock, peak: 0.45, gain: 6 },
  'Even fingerstyle': { ...stock },
  'Squashed': { ...stock, peak: 0.8, gain: 20 },
  'Parallel (blend)': { ...stock, peak: 0.8, gain: 20, blend: 0.4 },
  'Feed-forward punch': { ...stock, sense: 'input', peak: 0.5 },
  'Quick cell, short memory': { ...stock, lifetime: 25e-3, trapTime: 0.4 },
  'Slow cell, long memory': { ...stock, lifetime: 150e-3, trapTime: 6 },
};
export const KEEP = [];
