// sympathetic-params.js — the Sympathetic Strings' controls. Values in SI units. A frame of steel
// strings tuned to a scale, all across one bridge; a driver moves the bridge with your bass, and a
// pickup under the bridge hears the strings pull on it.

export const KEYS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
// each scale's strings, in semitones above the key's root
export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19],
  minor: [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19],
  'major-pent': [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24],
  'minor-pent': [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24],
  drone: [0, 7, 12, 19, 24],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

const strings = [
  { id: 'sustain', label: 'Sustain', min: 1, max: 20, def: 6, log: true, unit: 's', decimals: 1, perform: true,
    hint: 'How long a string\'s low partials ring: the time a 100 Hz partial takes to die by 60 dB. The strings lose energy at a rate b₁ + b₃ω² (Chaigne and Askenfelt\'s form), so the higher partials always die sooner.' },
  { id: 'highs', label: 'Highs ring', min: 0.2, max: 5, def: 1, log: true, unit: 's', decimals: 2, perform: true,
    hint: 'How long a 2 kHz partial rings. Short is a dark, mellow halo; long is a bright, glassy one. Never longer than Sustain: the strings\' losses do not fall with frequency.' },
  { id: 'mix', label: 'Strings', min: 0, max: 1, def: 0.5, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'How much of the pickup under the bridge is mixed in: the strings ringing along.' },
  { id: 'dry', label: 'Dry', min: 0, max: 1, def: 1, unit: '%', scale: 100, decimals: 0,
    hint: 'Your bass as it came in.' },
];

const tuning = [
  { id: 'key', label: 'Key', type: 'select', def: '4', options: KEYS.map((k, i) => [String(i), k]),
    hint: 'The root the strings are tuned from. A note whose harmonics land on the strings sets them ringing; one between them leaves them nearly still, so the halo follows the key: in E, an open E string rings the strings far more than an F would.' },
  { id: 'scale', label: 'Scale', type: 'select', def: 'major',
    options: [['major', 'Major'], ['minor', 'Minor'], ['major-pent', 'Major pentatonic'], ['minor-pent', 'Minor pentatonic'], ['drone', 'Drone'], ['chromatic', 'Chromatic']],
    hint: 'The notes the strings are tuned to, upward from the root: twelve strings for Major, Minor and Chromatic, eleven for the pentatonics. Drone is five strings, root and fifth only, the most open; Chromatic rings along with any note.' },
  { id: 'octave', label: 'Lowest string', type: 'select', def: '2',
    options: [['1', 'Octave 1'], ['2', 'Octave 2'], ['3', 'Octave 3']],
    hint: 'The octave of the lowest string (E1 is the bass\'s open E). Octave 1 is the bass\'s own register, and long strings: 3.4 m for E1. Higher strings are shorter and ring to the bass\'s harmonics.' },
  { id: 'wire', label: 'Wire diameter', min: 0.2e-3, max: 1e-3, def: 0.3e-3, log: true, unit: 'mm', scale: 1000, decimals: 2,
    hint: 'The steel wire every string is made of. Each is tensioned to the same stress, 600 MPa, so a thicker wire is stiffer for its tension and its partials go sharp, more for the higher ones: Fletcher\'s inharmonicity B grows as the diameter squared.' },
  { id: 'level', label: 'Level', min: -24, max: 12, def: 0, unit: 'dB', decimals: 1,
    hint: 'Gain after the mix, in decibels.' },
];

export const GROUPS = [
  { name: 'The strings', params: strings },
  { name: 'Tuning and output', params: tuning },
];

export const PRESETS = {
  'Halo in E': { key: '4', scale: 'major', octave: '2', sustain: 6, highs: 1, mix: 0.5, dry: 1 },
  'Drone on A': { key: '9', scale: 'drone', octave: '2', sustain: 10, highs: 1.5, mix: 0.6, dry: 1 },
  'Minor pentatonic in E': { key: '4', scale: 'minor-pent', octave: '2', sustain: 6, highs: 1, mix: 0.5, dry: 1 },
  'Glassy': { highs: 3.5, sustain: 12, mix: 0.4 },
  'Dark and short': { highs: 0.3, sustain: 2.5, mix: 0.7 },
  'Strings alone': { mix: 1, dry: 0 },
  'Thick wire': { wire: 1e-3 },
};
export const KEEP = ['level'];
