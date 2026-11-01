// blackhole-params.js — the Black Hole's controls. Values in SI units, and the hole's mass in suns:
// your bass perturbs a spinning black hole, and you hear it ring in its quasinormal modes.

const hole = [
  { id: 'mass', label: 'Mass', min: 30, max: 3000, def: 200, log: true, unit: 'M☉', decimals: 0, perform: true,
    hint: 'The hole\'s mass in suns. Its ringing scales as one over the mass: at the default spin, 65 suns rings at middle C (262 Hz), and the remnant of LIGO\'s first detection, 62 suns at a = 0.67, at 271 Hz; 200 suns rings at 85 Hz, just above the open E\'s second harmonic, and 414 suns on the open E itself (41 Hz).' },
  { id: 'nines', label: 'Spin', min: 0, max: 6, def: 0.509, unit: 'nines', decimals: 2, perform: true,
    hint: 'How fast the hole spins, a = 1 − 10^(−nines): 0 is a hole that does not spin (Schwarzschild), 0.51 is a = 0.69, 2 is 0.99, 6 is 0.999999. Without spin a hole rings for barely two cycles, a thud; as a → 1 its l = m modes slide onto multiples of the horizon\'s spin, 2 : 3 : 4, and ring longer and longer, a bell (Q about 3 at a = 0.69, 15 at 0.99, 1400 at 0.999999).' },
  { id: 'mix', label: 'Hole', min: 0, max: 1, def: 0.5, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'How much of the ringing is mixed in.' },
  { id: 'dry', label: 'Dry', min: 0, max: 1, def: 1, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'Your bass as it came in.' },
];

const merger = [
  { id: 'ratio', label: 'Mass ratio', min: 1, max: 10, def: 1.2, log: true, unit: ':1', decimals: 1,
    hint: 'How lopsided the merger that made the hole was, the heavier over the lighter: it sets how strongly each mode rings (Kamaretsos et al.\'s fits). Equal masses leave the odd-m modes, (2,1) and (3,3), silent; a lopsided merger switches them on.' },
  { id: 'inclination', label: 'Inclination', min: 0, max: 90, def: 30, unit: '°', decimals: 0,
    hint: 'Where you hear the hole from: 0° along its spin axis (face-on), 90° in its equator (edge-on). The left channel is h₊ and the right h×: face-on the two are a quarter cycle apart, circularly polarised; edge-on h× of the (2,2) mode vanishes.' },
  { id: 'level', label: 'Level', min: -24, max: 12, def: -15.1, unit: 'dB', decimals: 1,
    hint: 'Gain after the mix, in decibels.' },
];

export const GROUPS = [
  { name: 'The hole', params: hole },
  { name: 'The merger and output', params: merger },
];

export const PRESETS = {
  'Bass hole': { mass: 200, nines: 0.509, ratio: 1.2, inclination: 30, mix: 0.5, dry: 1 },
  'GW150914': { mass: 62, nines: 0.481, ratio: 1.2 },
  'Thud: no spin': { nines: 0 },
  'Bell: nearly extremal': { nines: 4, mix: 0.3 },
  'On the open E': { mass: 414 },
  'Lopsided merger': { ratio: 8 },
  'Edge-on': { inclination: 90 },
};
export const KEEP = ['level'];
