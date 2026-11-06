// helmholtz-params.js — Helmholtz's Resonators' controls. Values in SI units.

const ear = [
  { id: 'glass', label: 'Resonator', min: 1, max: 10, def: 1, step: 1, unit: '', decimals: 0, perform: true, hint: 'Which of Helmholtz\'s ten glass resonators is at your ear: from the largest, a sphere 154 mm across ringing at 204.5 Hz, to the smallest, 43 mm across and ringing at 920.2 Hz (at 20 °C). An expression pedal steps through them.' },
  { id: 'opening', label: 'Opening', min: 30, max: 150, def: 100, log: true, unit: '%', decimals: 1, perform: true, hint: 'The opening\'s diameter, against Helmholtz\'s. Narrowing it lowers the pitch and, down to about 70 %, sharpens it: the largest resonator rings at 163 Hz with a Q of 124 at 70 %, against 204.5 Hz and 105 as he made it. Narrower still, the friction of the neck\'s walls wins: at 30 %, a Q of 43.' },
  { id: 'ear', label: 'Other ear', min: -60, max: 0, def: 0, unit: 'dB', decimals: 0, perform: true, hint: 'Your other ear, open to the room: the bass as it is, beside what the resonator brings to the ear it plugs. At −60 dB, off.' },
  { id: 'level', label: 'Level', min: -60, max: 12, def: -11.4, unit: 'dB', decimals: 1, perform: true, hint: 'The output. At 0 dB the bass far below the resonance comes out as it went in, and at the resonance Q times louder.' },
];
const air = [
  { id: 'temperature', label: 'Temperature', min: -10, max: 40, def: 20, unit: '°C', decimals: 0, hint: 'The air\'s: sound travels at 343.2 m/s at 20 °C and 331.3 m/s at 0 °C, and every resonator\'s pitch moves with it, 3.5 % between the two.' },
];

export const GROUPS = [
  { name: 'The resonator', params: ear },
  { name: 'The air', params: air },
];

const stock = { glass: 1, opening: 100, ear: 0, level: -11.4, temperature: 20 };
export const PRESETS = {
  'His largest': { ...stock },
  'Tuned to A': { ...stock, opening: 112.6, level: -29.3 },
  'Narrowed': { ...stock, opening: 70, level: -27.1 },
  'A middle one': { ...stock, glass: 5, level: -11.8 },
  'His smallest': { ...stock, glass: 10, level: -9.5 },
  'Both ears plugged': { ...stock, ear: -60, level: -10.4 },
  'A cold room': { ...stock, temperature: 0, level: -14.9 },
};
export const KEEP = [];
