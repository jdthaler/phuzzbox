// wah-params.js — the Wah's controls. Values in SI units; `scale` shows them in friendlier ones.
// The parts are the inductor wah's as Holters and Zölzer (DAFx 2011) list them; the sweep
// capacitor starts at 22 nF for bass, where the original's 10 nF sweeps a guitar's range.

const rocker = [
  { id: 'position', label: 'Rocker', min: 0, max: 1, def: 0.5, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'Where your foot has the pedal: heel down (0 %) puts the peak low and sharp, toe down (100 %) high and broad. An expression pedal moves it (MIDI CC 1 unless you teach it another).' },
  { id: 'taper', label: 'Pot taper', type: 'select', options: [['audio', 'Audio (log)'], ['linear', 'Linear']], def: 'audio',
    hint: 'How the pot\'s resistance follows the rocker. A linear pot leaves the sweep\'s top octave for the last fifth of the travel; an audio pot, its lower part 10 % at mid-travel, spreads the sweep more evenly under your foot.' },
];

const circuit = [
  { id: 'sweepC', label: 'Range (sweep capacitor)', min: 4.7e-9, max: 100e-9, def: 22e-9, log: true, unit: 'nF', scale: 1e9, decimals: 1, perform: true,
    hint: 'The capacitor that resonates with the inductor. Bigger moves the whole sweep down, as 1/√C: 10 nF is the guitar wah, 22 nF a bass wah, 47 nF lower still.' },
  { id: 'qR', label: 'Q (resistor across the coil)', min: 10e3, max: 220e3, def: 33e3, log: true, unit: 'kΩ', scale: 0.001, decimals: 0, perform: true,
    hint: 'The resistor across the inductor damps it. More resistance, a taller and narrower peak, more vocal; less, a broader and gentler one.' },
  { id: 'inductor', label: 'Inductor', min: 0.1, max: 1.5, def: 0.5, log: true, unit: 'mH', scale: 1000, decimals: 0,
    hint: 'The coil. More henries lower the whole sweep (as 1/√L) and raise the peak a little; 500 mH is the classic value.' },
  { id: 'vcc', label: 'Supply', min: 5, max: 12, def: 8.15, unit: 'V', decimals: 2,
    hint: 'The transistors\' supply, after the polarity diode (a fresh 9 V battery gives about 8.15 V). Lower, and hard notes distort more (the transistors run out of room sooner); it only matters when you dig in.' },
];

const output = [
  { id: 'blend', label: 'Clean blend', min: 0, max: 1, def: 0, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'A blend pot that mixes your dry signal back in, as bass wahs have: the wah thins out the low end, and this keeps the bottom under the sweep.' },
  { id: 'level', label: 'Level', min: -24, max: 12, def: 0, unit: 'dB', decimals: 1,
    hint: 'Gain after the wah, in decibels.' },
];

export const GROUPS = [
  { name: 'Rocker', params: rocker },
  { name: 'Circuit', params: circuit },
  { name: 'Output', params: output },
];

export const PRESETS = {
  'Bass wah (22 nF)': { sweepC: 22e-9, qR: 33e3, inductor: 0.5, blend: 0 },
  'Bass wah, bottom kept': { sweepC: 22e-9, qR: 33e3, inductor: 0.5, blend: 0.4 },
  'Guitar wah as built (10 nF)': { sweepC: 10e-9, qR: 33e3, inductor: 0.5, blend: 0 },
  'Deep and vocal (47 nF, 100 kΩ)': { sweepC: 47e-9, qR: 100e3, inductor: 0.5, blend: 0.2 },
  'Gentle (15 kΩ)': { sweepC: 22e-9, qR: 15e3, inductor: 0.5, blend: 0.2 },
};
export const KEEP = ['position', 'vcc', 'level'];
