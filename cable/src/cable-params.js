// cable-params.js — the Transatlantic Cable's controls. Values in SI units; `scale` shows them in
// friendlier ones.

// the cables, in the order of native/pedals/cable/cable-model.cpp's table
export const CABLES = [
  ['atlantic1858', 'Atlantic telegraph, 1858'], ['atlantic1866', 'Atlantic telegraph, 1866'], ['pair', 'Telephone pair, 0.4 mm'],
];

const pedal = [
  { id: 'length', label: 'Length', min: 1e3, max: 200e3, def: 100e3, log: true, unit: 'km', scale: 1e-3, decimals: 1, perform: true,
    hint: 'How far your bass travels. The cable loses the treble faster than the bass, so the longer the darker: 100 km of the 1858 cable passes 1 kHz 15 dB below the bass, 200 km 37 dB. And a note takes 3.5 times as long to arrive down 200 km as down 100.' },
  { id: 'loading', label: 'Loading', type: 'select', def: 'none', options: [['none', 'None'], ['coils', 'Coils'], ['heaviside', 'Heaviside']], perform: true,
    hint: 'None: the cable as laid. Coils: a loading coil every 1.83 km, so the line passes more up to a cutoff and nothing above it (30 km of telephone pair passes 1 kHz 20 dB louder, and 4 kHz not at all). Heaviside: inductance spread along the line with just enough leakage, so every frequency is delayed alike and loses the same.' },
  { id: 'repeater', label: 'Repeater', min: -20, max: 80, def: 19.2, unit: 'dB', decimals: 1, perform: true,
    hint: 'An amplifier at the far end, as the later cables had: every 20 dB multiplies the voltage by ten (and below 0 dB, divides it, as a pad).' },
  { id: 'far', label: 'Far end', type: 'select', def: 'matched', options: [['matched', 'Matched'], ['open', 'Open']], perform: true,
    hint: "Matched: the far end absorbs what arrives. Open: into an amplifier's megohm, which reflects it back, and the voltage there doubles. On a Heaviside line you hear the reflections come back, one round trip apart." },
];

const bench = [
  { id: 'conductor', label: 'Cable', type: 'select', def: 'atlantic1858', options: CABLES,
    hint: "The cable itself. The 1858 Atlantic cable's thin core has 2.8 times the resistance of the 1866 cable's, so it is darker; a telephone pair of 0.4 mm wires has 274 Ω per km, and half the 1858 cable's capacitance." },
  { id: 'coil', label: 'Loading coils', min: 22e-3, max: 250e-3, def: 88e-3, log: true, unit: 'mH', scale: 1e3, decimals: 0,
    hint: "Each loading coil's inductance. Heavier coils cut off lower, at 1/(π√(L C)): on the telephone pair, 3.4 kHz at 88 mH and 2.0 kHz at 250 mH." },
  { id: 'inductance', label: 'Heaviside inductance', min: 10e-3, max: 1, def: 100e-3, log: true, unit: 'mH/km', scale: 1e3, decimals: 0,
    hint: "The inductance Heaviside's loading adds per km, with the leakage that keeps L/R = C/G. More makes the line slower and loses less: down 100 km of the 1866 cable, 100 mH/km delays the bass 11.4 ms and loses 2.1 dB; 1 H/km, 35.9 ms and 0.7 dB." },
];

export const GROUPS = [
  { name: 'The pedal', params: pedal },
  { name: 'The line', params: bench },
];

const stock = { length: 100e3, loading: 'none', repeater: 19.2, far: 'matched', conductor: 'atlantic1858', coil: 88e-3, inductance: 100e-3 };
export const PRESETS = {
  '1858 cable, 100 km': { ...stock },
  '1858 cable, 200 km, into a galvanometer': { ...stock, length: 200e3, far: 'open', repeater: 19 },
  '1866 cable, 200 km': { ...stock, conductor: 'atlantic1866', length: 200e3, repeater: 22.3 },
  'Telephone pair, 10 km': { ...stock, conductor: 'pair', length: 10e3, repeater: 13.9 },
  'Telephone pair with coils, 30 km': { ...stock, conductor: 'pair', length: 30e3, loading: 'coils', repeater: 23.9 },
  'Heavy coils: a lower cutoff': { ...stock, conductor: 'pair', length: 30e3, loading: 'coils', coil: 250e-3, repeater: 19.7 },
  'Heaviside: a clean delay': { ...stock, conductor: 'atlantic1866', loading: 'heaviside', inductance: 1, repeater: 0.7 },
  'Heaviside, far end open: echoes': { ...stock, conductor: 'atlantic1866', loading: 'heaviside', inductance: 1, far: 'open', repeater: -8.7 },
  'Heaviside on a telephone pair': { ...stock, conductor: 'pair', length: 10e3, loading: 'heaviside', inductance: 1, repeater: 6.5 },
};
export const KEEP = [];
