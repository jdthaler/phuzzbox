// cabinet-params.js — the Speaker Cabinet's controls. Values in SI units; `scale` shows them in
// friendlier ones. The drivers are Thiele–Small parameters typical of a 10-inch or a 15-inch bass
// driver, not any one maker's; the presets set whole cabinets.

const cabinet = [
  { id: 'drive', label: 'Power amp gain', min: 10, max: 46, def: 32, unit: 'dB', decimals: 1, perform: true,
    hint: 'The clean power amp\'s voltage gain, from your bass\'s volts to the cabinet\'s. It sets how hard the cones are pushed: up high, the low notes run the cones out of travel and the sound thickens and compresses, the lowest strings first.' },
  { id: 'mic', label: 'Microphone sensitivity', min: 1e-3, max: 0.1, def: 15e-3, log: true, unit: 'mV/Pa', scale: 1e3, decimals: 1, perform: true,
    hint: 'The volts the microphone at 1 m gives per pascal of sound: a dynamic microphone gives about 2, a condenser about 20. It is the pedal\'s output level and changes nothing else.' },
  { id: 'layout', label: 'Drivers', type: 'select', def: '8x10', options: [['1x15', '1 × 15″'], ['2x10', '2 × 10″, in parallel'], ['4x10', '4 × 10″, 2 series × 2 parallel'], ['8x10', '8 × 10″, 2 series × 4 parallel']],
    hint: 'How many drivers share the box and how they are wired. More drivers move more air together: 8 against 1 is 18 dB more sound for the same voltage on each. Two in series share the amp\'s voltage, each getting half of it.' },
  { id: 'box', label: 'Box', type: 'select', def: 'sealed', options: [['sealed', 'Sealed'], ['ported', 'Ported']],
    hint: 'Sealed, the air in the box is a spring behind the cones: the bass rolls off gently (12 dB an octave) below the box\'s resonance, and the cones stay in control however low you play. Ported, the air in the port resonates with the box\'s and takes over from the cones near its tuning: deeper bass, a steeper roll-off (24 dB an octave), and below the tuning the cones flap with nothing holding them.' },
  { id: 'volume', label: 'Box volume', min: 0.02, max: 0.4, def: 0.2, log: true, unit: 'L', scale: 1e3, decimals: 0, perform: true,
    hint: 'The air inside, shared by all the drivers. A smaller box is a stiffer spring: sealed, it raises the resonance and makes it peakier; ported, the same port tunes higher.' },
];

const port = [
  { id: 'ports', label: 'Ports', min: 1, max: 4, def: 2, step: 1, unit: '', decimals: 0, showIf: (P) => P.box === 'ported',
    hint: 'How many round ports. More port area tunes the box higher, as the square root of the area.' },
  { id: 'portD', label: 'Port diameter', min: 0.03, max: 0.2, def: 0.1, unit: 'cm', scale: 100, decimals: 1, showIf: (P) => P.box === 'ported',
    hint: 'Each port\'s diameter. Wider ports tune higher, and keep the air in them slower on loud low notes.' },
  { id: 'portL', label: 'Port length', min: 0.01, max: 0.6, def: 0.09, log: true, unit: 'cm', scale: 100, decimals: 1, showIf: (P) => P.box === 'ported',
    hint: 'How long each port is: a longer port holds more air, a heavier mass on the box\'s spring, and tunes lower.' },
];

const driver = [
  { id: 'fs', label: 'Resonance (Fs)', min: 20, max: 120, def: 45, log: true, unit: 'Hz', decimals: 1,
    hint: 'The driver\'s own resonance in free air, its moving mass on its suspension. In the box the spring gets stiffer and the resonance higher; a lower Fs reaches lower.' },
  { id: 'qes', label: 'Electrical Q (Qes)', min: 0.15, max: 1.5, def: 0.375, log: true, decimals: 3, unit: '',
    hint: 'How little the motor damps the resonance: the coil, shorted through the amp, brakes the cone. Lower Qes (a stronger magnet) is a tighter, flatter, less boomy low end; higher is a fatter bump at the box\'s resonance.' },
  { id: 'qms', label: 'Mechanical Q (Qms)', min: 1, max: 15, def: 5, log: true, decimals: 1, unit: '',
    hint: 'How little the suspension\'s own friction damps the resonance. It barely matters beside the motor\'s damping unless the amp\'s output impedance is high.' },
  { id: 'vas', label: 'Compliance volume (Vas)', min: 0.005, max: 0.4, def: 0.054, log: true, unit: 'L', scale: 1e3, decimals: 0,
    hint: 'The volume of air as springy as the driver\'s suspension. A driver with a large Vas against its box is held mostly by the air: the box\'s resonance rises as √(1 + Vas/Vb).' },
  { id: 're', label: 'Coil resistance (Re)', min: 2, max: 16, def: 5.6, unit: 'Ω', decimals: 1,
    hint: 'The voice coil\'s DC resistance (5.6 Ω for an 8 Ω driver). With Fs, Qes and Vas fixed it only sets how much current a volt makes: higher, a little quieter.' },
  { id: 'le', label: 'Coil inductance (Le)', min: 0.1e-3, max: 5e-3, def: 0.8e-3, log: true, unit: 'mH', scale: 1e3, decimals: 2,
    hint: 'The voice coil\'s inductance. Above Re/(2πLe), about 1.1 kHz at the defaults, it chokes the current and the top rolls off: more inductance, a darker cabinet.' },
  { id: 'sd', label: 'Cone area (Sd)', min: 0.005, max: 0.1, def: 0.035, log: true, unit: 'cm²', scale: 1e4, decimals: 0,
    hint: 'The cone\'s area, about 350 cm² for a 10-inch and 855 cm² for a 15-inch. With Fs, Qes and Vas held, a bigger cone makes the same sound with less travel, since it moves more air per millimetre: it runs out of travel later on low notes.' },
  { id: 'xmax', label: 'Linear travel (Xmax)', min: 1e-3, max: 20e-3, def: 4e-3, log: true, unit: 'mm', scale: 1e3, decimals: 1,
    hint: 'How far the cone travels each way before the coil starts to leave the magnet\'s gap (the force factor falls to 82 %) and the suspension stiffens. Less travel, and loud low notes distort sooner.' },
];

const amp = [
  { id: 'ampR', label: 'Amp output impedance', min: 0.01, max: 20, def: 0.05, log: true, unit: 'Ω', decimals: 2,
    hint: 'What the power amp drives the cabinet through: near nothing for a solid-state amp, several ohms for a tube amp with its output transformer. It adds to the coil\'s resistance and weakens the motor\'s braking, so the bump at the box\'s resonance swells: tube-amp bloom.' },
];

export const GROUPS = [
  { name: 'The cabinet', params: cabinet },
  { name: 'The port', params: port },
  { name: 'The drivers', params: driver },
  { name: 'The amp', params: amp },
];

const ten = { fs: 45, qes: 0.375, qms: 5, vas: 0.054, re: 5.6, le: 0.8e-3, sd: 0.035, xmax: 4e-3 };
const fifteen = { fs: 38, qes: 0.4, qms: 6, vas: 0.18, re: 5.4, le: 1.5e-3, sd: 0.0855, xmax: 6e-3 };
export const PRESETS = {
  '8 × 10 sealed': { ...ten, layout: '8x10', box: 'sealed', volume: 0.2, ampR: 0.05, drive: 32, mic: 15e-3 },
  '4 × 10 ported': { ...ten, layout: '4x10', box: 'ported', volume: 0.14, ports: 2, portD: 0.1, portL: 0.09, ampR: 0.05, drive: 32, mic: 25e-3 },
  '2 × 10 ported': { ...ten, layout: '2x10', box: 'ported', volume: 0.07, ports: 1, portD: 0.1, portL: 0.09, ampR: 0.05, drive: 30, mic: 40e-3 },
  '1 × 15 ported': { ...fifteen, layout: '1x15', box: 'ported', volume: 0.12, ports: 1, portD: 0.1, portL: 0.05, ampR: 0.05, drive: 32, mic: 40e-3 },
  '1 × 15 sealed': { ...fifteen, layout: '1x15', box: 'sealed', volume: 0.12, ampR: 0.05, drive: 32, mic: 40e-3 },
  '8 × 10 on a tube amp': { ...ten, layout: '8x10', box: 'sealed', volume: 0.2, ampR: 4, drive: 32, mic: 15e-3 },
  '8 × 10, pushed hard': { ...ten, layout: '8x10', box: 'sealed', volume: 0.2, ampR: 0.05, drive: 44, mic: 4e-3 },
};
export const KEEP = [];
