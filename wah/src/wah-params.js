// wah-params.js — the Wah's controls. Values in SI units; `scale` shows them in friendlier ones.
// The parts are the inductor wah's as Holters and Zölzer (DAFx 2011) list them; the sweep
// capacitor starts at 22 nF for bass, where the original's 10 nF sweeps a guitar's range.
// Plugged in backwards, the bass is the Buffer's pickup circuit, driving the output jack.

import { bass, recorded } from '../../buffer/src/buffer-params.js';

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
    showIf: (P) => !P.reversed,
    hint: 'A blend pot that mixes your dry signal back in, as bass wahs have: the wah thins out the low end, and this keeps the bottom under the sweep. It is not part of the circuit model, so plugged in backwards it is off.' },
  { id: 'level', label: 'Level', min: -24, max: 12, def: 0, unit: 'dB', decimals: 1,
    hint: 'Gain after the wah, in decibels.' },
];

// Plugged in backwards: the switch, then the cables, the amp and the bass that it brings into the
// circuit (shown only when it is on)
const onlyBackwards = (p) => ({ ...p, showIf: (P) => !!P.reversed && (!p.showIf || p.showIf(P)) });
const backwards = [
  { id: 'reversed', label: 'Reversed (plugged in backwards)', type: 'checkbox', def: false,
    hint: 'Your bass into the wah\'s output jack, and its input jack to the amp. The pickup\'s coil now hangs on the loop that makes the resonance, and from a passive bass the loop breaks into a squeal of its own, the seagull of a wah plugged in backwards: about 880 Hz heel down, rising to 1.16 kHz at 60 % and quietening, gone past three quarters of the way to the toe. From an active bass it does not squeal: it is a filter whose peak still rises with the rocker and fades toward the toe. The footswitch is a true bypass, so bypassed it plays the same either way round.' },
  ...[
    { id: 'cable', label: 'Cable from the bass', min: 0.3, max: 30, def: 3, log: true, unit: 'm', decimals: 1,
      hint: 'The cable from your bass to the wah\'s output jack. Its capacitance is across a jack the circuit loads heavily, so it hardly matters: 30 m lowers the squeal\'s pitch by about 2 %.' },
    { id: 'outCable', label: 'Cable to the amp', min: 0.3, max: 30, def: 3, log: true, unit: 'm', decimals: 1,
      hint: 'The cable from the wah\'s input jack to the amp. The jack drives it through the circuit\'s 68 kΩ, so a long cable is a low-pass: 30 m takes the squeal down by about 7 dB.' },
    { id: 'load', label: 'Amp\'s input', min: 10e3, max: 10e6, def: 1e6, log: true, unit: 'kΩ', scale: 0.001, decimals: 0,
      hint: 'The input impedance of what the input jack drives, usually 1 MΩ. With the 68 kΩ in front of it, a lower one is quieter: into 10 kΩ the squeal is about 18 dB down.' },
    ...bass,
    ...recorded,
  ].map(onlyBackwards),
];

export const GROUPS = [
  { name: 'Rocker', params: rocker },
  { name: 'Circuit', params: circuit },
  { name: 'Output', params: output },
  { name: 'Plugged in backwards', params: backwards },
];

export const PRESETS = {
  'Bass wah (22 nF)': { sweepC: 22e-9, qR: 33e3, inductor: 0.5, blend: 0, reversed: false },
  'Bass wah, bottom kept': { sweepC: 22e-9, qR: 33e3, inductor: 0.5, blend: 0.4, reversed: false },
  'Guitar wah as built (10 nF)': { sweepC: 10e-9, qR: 33e3, inductor: 0.5, blend: 0, reversed: false },
  'Deep and vocal (47 nF, 100 kΩ)': { sweepC: 47e-9, qR: 100e3, inductor: 0.5, blend: 0.2, reversed: false },
  'Gentle (15 kΩ)': { sweepC: 22e-9, qR: 15e3, inductor: 0.5, blend: 0.2, reversed: false },
  'Plugged in backwards': { sweepC: 22e-9, qR: 33e3, inductor: 0.5, blend: 0, reversed: true },
};
export const KEEP = ['position', 'vcc', 'level', 'active', 'pickupL', 'pickupR', 'pickupC', 'pots', 'activeR', 'recCable', 'recLoad', 'cablePF', 'cable', 'outCable', 'load'];
