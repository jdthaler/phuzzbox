// preamp-params.js — the Tube Preamp's controls. Values in SI units; `scale` shows them in friendlier
// ones. The bass and how it is plugged in are the Buffer's (the same pickup circuit drives this input).

import { bass, recorded } from '../../buffer/src/buffer-params.js';

const pedal = [
  { id: 'gain', label: 'Gain', min: 0, max: 1, def: 0.3, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'The amp\'s Volume: a 1 MΩ audio pot between the two gain stages, so it sets how hard the second triode is driven. Low, both stages stay on the straight part of their curves and the bass comes through clean and warm; past about a third, the second triode\'s grid is pushed past its cathode on the peaks and below cut-off in the troughs, and the notes break up, softly at first.' },
  { id: 'bass', label: 'Bass', min: 0, max: 1, def: 0.5, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'The tone stack\'s 1 MΩ audio pot. Up, it lifts the lows by about 4 dB at 60 Hz from halfway; down, it thins them. Passive: it only takes away less, never adds.' },
  { id: 'middle', label: 'Middle', min: 0, max: 1, def: 0.5, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'The tone stack\'s 25 kΩ pot to ground. Down, it carves the famous scoop out of the middle, deepest near 400–500 Hz; up, it fills it back in, by about 5 dB at 500 Hz from halfway.' },
  { id: 'treble', label: 'Treble', min: 0, max: 1, def: 0.5, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'The tone stack\'s 250 kΩ pot, fed through 250 pF: up, it passes more of the top, about 10 dB at 5 kHz from halfway; down, it darkens the bass to a thump.' },
  { id: 'master', label: 'Master', min: 0, max: 1, def: 0.4, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'A 1 MΩ audio pot after the tone stack, which the amp doesn\'t have (its tone stack drives the power amp): it sets how loud the pedal is without changing how hard the tubes are driven. Halfway passes about a tenth of the voltage.' },
];

const tubes = [
  { id: 'tube', label: 'Tubes', type: 'select', def: 'rsd1', options: [['rsd1', '12AX7, RSD sample 1'], ['rsd2', '12AX7, RSD sample 2'], ['ehx1', '12AX7, Electro-Harmonix']],
    hint: 'The three 12AX7s Dempwolf and Zölzer measured and fitted. The two RSD samples are near twins, with an amplification factor near 100; the Electro-Harmonix has less (87) and less current, so a little less gain and a slightly different break-up.' },
  { id: 'emission', label: 'Emission', min: 0.4, max: 1, def: 1, unit: '%', scale: 100, decimals: 0,
    hint: 'How much current the cathodes still give, against a new tube\'s: an old tube\'s cathode is tired. Less emission, less current at every voltage: each stage\'s plate sits higher, the gain falls a little, and the first stage clips a little earlier on top.' },
  { id: 'cathodeC', label: 'First stage cathode capacitor', min: 0.1e-6, max: 250e-6, def: 25e-6, log: true, unit: 'µF', scale: 1e6, decimals: 1,
    hint: 'The capacitor across the first triode\'s 1.5 kΩ cathode resistor: 25 µF bypasses it for everything a bass plays, and the stage has all its gain. A small one (1 µF and under) bypasses only the highs: the lows lose about 6 dB of gain and stay cleaner, and the bass sounds tighter.' },
];

const supply = [
  { id: 'bplus', label: 'B+ (the 385 V rail)', min: 250, max: 450, def: 385, unit: 'V', decimals: 0,
    hint: 'The rail the preamp\'s dropper hangs from: 385 V in the Bassman. Lower it and every stage sits lower, with less room to swing: the tubes clip sooner, and more evenly.' },
  { id: 'supplyR', label: 'Dropper resistance', min: 1e3, max: 47e3, def: 14e3, log: true, unit: 'kΩ', scale: 0.001, decimals: 1,
    hint: 'The resistor that drops the 385 V rail to the preamp\'s, chosen here to leave 325 V. With the 8 µF filter it makes the preamp\'s supply sag a little under hard playing: more resistance, a lower rail and more sag.' },
  { id: 'filterC', label: 'Filter capacitor', min: 1e-6, max: 100e-6, def: 8e-6, log: true, unit: 'µF', scale: 1e6, decimals: 0,
    hint: 'The capacitor holding the preamp\'s rail steady: 8 µF in the Bassman. Smaller, the rail follows the playing more (a slower, spongier attack when you dig in).' },
  { id: 'cable', label: 'Cable from the bass', min: 0.3, max: 30, def: 3, log: true, unit: 'm', decimals: 1,
    hint: 'The cable from your bass to the preamp. Into the tube\'s 1 MΩ grid leak its capacitance tunes the pickup\'s resonance, as it does into an amp: a long cable darkens it.' },
  { id: 'outCable', label: 'Cable to the amp', min: 0.3, max: 30, def: 3, log: true, unit: 'm', decimals: 1,
    hint: 'The cable from the preamp to what it drives. The tone stack and the Master pot drive it from tens of kilohms, so a long cable darkens the top.' },
  { id: 'load', label: 'Amp\'s input', min: 10e3, max: 10e6, def: 1e6, log: true, unit: 'kΩ', scale: 0.001, decimals: 0,
    hint: 'The input impedance of what the preamp drives, usually 1 MΩ. It loads the Master pot.' },
];

export const GROUPS = [
  { name: 'The preamp', params: pedal },
  { name: 'Tubes', params: tubes },
  { name: 'Supply and cables', params: supply },
  { name: 'Your bass', params: bass },
  { name: 'How you are plugged in', params: recorded },
];

// Each preset shows one idea; the bass and how it is plugged in are kept (KEEP).
const stock = { gain: 0.3, bass: 0.5, middle: 0.5, treble: 0.5, master: 0.4, tube: 'rsd1', emission: 1, cathodeC: 25e-6, bplus: 385, supplyR: 14e3, filterC: 8e-6 };
export const PRESETS = {
  'Clean and warm': { ...stock, gain: 0.15, master: 0.55 },
  'Edge of break-up': { ...stock },
  'Cranked': { ...stock, gain: 0.8, master: 0.18 },
  'Scooped': { ...stock, bass: 0.75, middle: 0.1, treble: 0.7 },
  'Mids forward': { ...stock, gain: 0.45, bass: 0.35, middle: 1, treble: 0.35, master: 0.3 },
  'Tight (small cathode capacitor)': { ...stock, gain: 0.5, cathodeC: 0.68e-6, master: 0.3 },
  'Tired tubes, low rail': { ...stock, gain: 0.45, emission: 0.6, bplus: 300, master: 0.35 },
};
export const KEEP = ['active', 'pickupL', 'pickupR', 'pickupC', 'pots', 'activeR', 'recCable', 'recLoad', 'cablePF', 'cable', 'outCable', 'load'];
