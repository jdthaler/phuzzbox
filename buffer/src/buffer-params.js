// buffer-params.js — the Buffer's controls. Values in SI units; `scale` shows them in friendlier ones.

const bass = [
  { id: 'active', label: 'Active electronics', type: 'checkbox', def: false,
    hint: 'An active bass drives the cable from a preamp\'s few hundred ohms: no inductance, so no resonance, and the cable and load stop mattering.' },
  { id: 'pickupL', label: 'Pickup inductance', min: 0.5, max: 12, def: 3.6, log: true, unit: 'H', decimals: 2,
    showIf: (P) => !P.active,
    hint: 'The coil\'s inductance: more turns, more henries, a lower resonance. A split-coil P pickup is about 3.5 H, a J pickup about 3 H, a big humbucker 8 H or more.' },
  { id: 'pickupR', label: 'Pickup resistance', min: 2000, max: 30000, def: 10500, log: true, unit: 'kΩ', scale: 0.001, decimals: 1,
    showIf: (P) => !P.active,
    hint: 'The coil\'s wire resistance: it damps the resonance a little. Hotter pickups have more of it.' },
  { id: 'pickupC', label: 'Pickup capacitance', min: 20e-12, max: 500e-12, def: 100e-12, log: true, unit: 'pF', scale: 1e12, decimals: 0,
    showIf: (P) => !P.active,
    hint: 'The capacitance between the coil\'s turns, in parallel with the cable\'s.' },
  { id: 'pots', label: 'Volume and tone pots', min: 50e3, max: 1e6, def: 125e3, log: true, unit: 'kΩ', scale: 0.001, decimals: 0,
    showIf: (P) => !P.active,
    hint: 'Your bass\'s own controls to ground: two 250 kΩ pots in parallel are 125 kΩ. Always there, whatever you plug into.' },
  { id: 'activeR', label: 'Preamp output resistance', min: 100, max: 10000, def: 1000, log: true, unit: 'kΩ', scale: 0.001, decimals: 2,
    showIf: (P) => P.active,
    hint: 'What an active bass\'s preamp drives the cable through.' },
];

const recorded = [
  { id: 'recCable', label: 'Your cable', min: 0.3, max: 30, def: 3, log: true, unit: 'm', decimals: 1,
    hint: 'The cable between your bass and your audio interface now. The pedal takes its effect off, so set it to the cable you are using.' },
  { id: 'recLoad', label: 'Your interface\'s input', min: 100e3, max: 10e6, def: 1e6, log: true, unit: 'MΩ', scale: 1e-6, decimals: 2,
    hint: 'The input impedance of the Hi-Z or instrument input you plugged into, usually 1 MΩ (some are 500 kΩ or 2 MΩ).' },
  { id: 'cablePF', label: 'Cable capacitance', min: 30e-12, max: 300e-12, def: 100e-12, log: true, unit: 'pF/m', scale: 1e12, decimals: 0,
    hint: 'The capacitance of a metre of cable: 50–80 pF/m for a good low-capacitance cable, 150 pF/m or more for a cheap one.' },
];

const load = [
  { id: 'cable', label: 'Cable length', min: 0.3, max: 60, def: 3, log: true, unit: 'm', decimals: 1, perform: true,
    hint: 'The cable you want to hear. Longer cable, more capacitance: the resonance slides down and the top end dulls.' },
  { id: 'load', label: 'Input impedance', min: 5e3, max: 10e6, def: 1e6, log: true, unit: 'kΩ', scale: 0.001, decimals: 0, perform: true,
    hint: 'What the cable plugs into. A buffer or a modern pedal is 1 MΩ; a vintage germanium fuzz is about 10 kΩ, which soaks up the resonance and the treble with it, and some level too: the coil\'s resistance and the input make a divider.' },
];

const output = [
  { id: 'level', label: 'Level', min: -24, max: 12, def: 0, unit: 'dB', decimals: 1, perform: true,
    hint: 'Gain after the buffer, in decibels.' },
];

export const GROUPS = [
  { name: 'Your bass', params: bass },
  { name: 'How you are plugged in', params: recorded },
  { name: 'What it drives', params: load },
  { name: 'Output', params: output },
];

// Each preset shows one idea; the bass and how it is plugged in are kept (KEEP).
export const PRESETS = {
  'As plugged in': { cable: 3, load: 1e6, level: 0 },
  'Vintage fuzz input (10 kΩ)': { cable: 3, load: 10e3, level: 0 },
  'Thirty metres of cable': { cable: 30, load: 1e6, level: 0 },
  'Pedal by the bass (30 cm)': { cable: 0.3, load: 1e6, level: 0 },
  'Old tube amp input (68 kΩ)': { cable: 6, load: 68e3, level: 0 },
};
export const KEEP = ['active', 'pickupL', 'pickupR', 'pickupC', 'pots', 'activeR', 'recCable', 'recLoad', 'cablePF'];
