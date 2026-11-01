// phuzz-params.js — the Phuzz's controls. Values in SI units; `scale` shows them in friendlier ones.
// The bass and how it is plugged in are the Buffer's (the same pickup circuit drives this input).

import { bass, recorded } from '../../buffer/src/buffer-params.js';

const pedal = [
  { id: 'fuzz', label: 'Fuzz', min: 0, max: 1, def: 1, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'The 1 kΩ pot in the second transistor\'s emitter, which sets how much of it the 20 µF capacitor bypasses. Full up, the emitter is grounded for the signal and the pair has all its gain; turning it down brings back negative feedback, and the gain falls fast: about 25 dB less by halfway. The input impedance falls with it, to a few hundred ohms, and loads your pickup harder.' },
  { id: 'volume', label: 'Volume', min: 0, max: 1, def: 0.77, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'A 500 kΩ audio-taper pot on the output: halfway passes about a tenth of the voltage (−20 dB). Full up, the peaks come out a few decibels above your bass\'s own, and since the wave is nearly square it sounds a good deal louder.' },
  { id: 'temp', label: 'Temperature', min: -10, max: 50, def: 20, unit: '°C', decimals: 0, perform: true,
    hint: 'Germanium leaks more as it warms, about twice as much every 7 °C. The first transistor\'s leakage takes over from the bias the feedback sets, the second transistor is starved of current and its collector slides toward the battery. Cold, it sits nearer the middle of its swing and clips evenly; hot, it clips lopsided, and near 50 °C most of the gain is gone.' },
  { id: 'battery', label: 'Battery', min: 5, max: 9.6, def: 9, unit: 'V', decimals: 1, perform: true,
    hint: 'The battery\'s voltage: about 9.5 V new, 7 V nearly flat. Less voltage, less room for the second transistor\'s collector to swing, so the output clips lower.' },
];

const transistors = [
  { id: 'hfe1', label: 'Q1 current gain (hFE)', min: 20, max: 250, def: 80, log: true, unit: '', decimals: 0,
    hint: 'The first transistor\'s current gain, as a transistor tester reads it. Builders like a lowish one here (70–80): more raises the input impedance and the gain a little.' },
  { id: 'leak1', label: 'Q1 leakage', min: 1e-6, max: 500e-6, def: 30e-6, log: true, unit: 'µA', scale: 1e6, decimals: 0,
    hint: 'The first transistor\'s collector current with its base open (I_CEO) at 20 °C, as a tester reads it. It adds to the current the feedback asks for, so more leakage starves the second transistor, as heat does.' },
  { id: 'hfe2', label: 'Q2 current gain (hFE)', min: 20, max: 250, def: 120, log: true, unit: '', decimals: 0,
    hint: 'The second transistor\'s current gain: builders like a higher one here (110–130). More of it, a little more gain.' },
  { id: 'leak2', label: 'Q2 leakage', min: 1e-6, max: 500e-6, def: 100e-6, log: true, unit: 'µA', scale: 1e6, decimals: 0,
    hint: 'The second transistor\'s I_CEO at 20 °C. Its bias is held by the feedback through Q1, so it matters much less than Q1\'s.' },
];

const supply = [
  { id: 'battR', label: 'Battery resistance', min: 0.5, max: 1000, def: 2, log: true, unit: 'Ω', decimals: 1,
    hint: 'The battery\'s internal resistance: an ohm or two new, hundreds when it is nearly dead. The rail sags with each note; and since the output is taken from a divider to the battery, it comes out a little louder.' },
  { id: 'bias', label: 'Q2 collector resistor', min: 2200, max: 22000, def: 8200, log: true, unit: 'kΩ', scale: 0.001, decimals: 1,
    hint: 'The 8.2 kΩ above the second transistor\'s collector, which builders trim to set its bias. More resistance lifts the collector away from the battery: about 12 kΩ centres it with these transistors, and the output clips evenly on both sides; less leaves it near the battery, and one side clips first.' },
  { id: 'cable', label: 'Cable from the bass', min: 0.3, max: 30, def: 3, log: true, unit: 'm', decimals: 1,
    hint: 'The cable from your bass to the Phuzz. Into a high-impedance input its capacitance tunes the pickup\'s resonance; the Phuzz\'s input of a few kilohms damps that resonance away, so here the cable hardly matters.' },
  { id: 'outCable', label: 'Cable to the amp', min: 0.3, max: 30, def: 3, log: true, unit: 'm', decimals: 1,
    hint: 'The cable from the Phuzz to what it drives. Below full volume, the pot\'s resistance and the cable\'s capacitance make a low-pass, so a long cable darkens it.' },
  { id: 'load', label: 'Amp\'s input', min: 10e3, max: 10e6, def: 1e6, log: true, unit: 'kΩ', scale: 0.001, decimals: 0,
    hint: 'The input impedance of what the Phuzz drives: an amp or a pedal, usually 1 MΩ. It loads the volume pot.' },
];

export const GROUPS = [
  { name: 'The Phuzz', params: pedal },
  { name: 'Transistors', params: transistors },
  { name: 'Battery, bias and cables', params: supply },
  { name: 'Your bass', params: bass },
  { name: 'How you are plugged in', params: recorded },
];

// Each preset shows one idea; the bass and how it is plugged in are kept (KEEP).
const stock = { fuzz: 1, volume: 1, temp: 20, battery: 9, battR: 2, hfe1: 80, leak1: 30e-6, hfe2: 120, leak2: 100e-6, bias: 8200 };
export const PRESETS = {
  'Full fuzz': { ...stock },
  'Fuzz at half': { ...stock, fuzz: 0.5 },
  'Cold room (5 °C)': { ...stock, temp: 5 },
  'Hot stage (38 °C)': { ...stock, temp: 38 },
  'Dying battery': { ...stock, battery: 7, battR: 200 },
  'Leaky first transistor': { ...stock, leak1: 150e-6 },
  'Trimmed for a leaky one': { ...stock, leak1: 150e-6, bias: 20000 },
};
export const KEEP = ['active', 'pickupL', 'pickupR', 'pickupC', 'pots', 'activeR', 'recCable', 'recLoad', 'cablePF', 'cable', 'outCable', 'load'];
