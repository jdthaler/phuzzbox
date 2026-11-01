// plate-params.js — the Plate Reverb's controls. Values in SI units. A steel plate, 2 m by 1 m and
// half a millimetre thick, hung in a frame: a driver shakes it, two contact pickups listen.

const plate = [
  { id: 'decay', label: 'Decay', min: 0.6, max: 10, def: 3, log: true, unit: 's', decimals: 1, perform: true,
    hint: 'The damper: a porous mat brought nearer the plate or moved away, as a plate\'s lever sets it. It is the time a low note (100 Hz) takes to die by 60 dB. The steel\'s own losses shorten the highs further: alone, the steel lets a note above 1 kHz ring only 2.1 to 2.4 s, so long settings ring darker at the top than at the bottom.' },
  { id: 'reverb', label: 'Reverb', min: 0, max: 1, def: 0.35, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'How much of the pickups is mixed in.' },
  { id: 'dry', label: 'Dry', min: 0, max: 1, def: 1, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'Your bass as it came in.' },
];

const model = [
  { id: 'top', label: 'Modes up to', min: 2000, max: 8000, def: 5000, log: true, unit: 'Hz', decimals: 0,
    hint: 'The highest of the plate\'s modes that is played. The plate has about 1.3 modes in every hertz, so 5 kHz is about 6400 of them; above this it is silent here. Higher is brighter and costs more of the computer.' },
  { id: 'level', label: 'Level', min: -24, max: 12, def: 0, unit: 'dB', decimals: 1,
    hint: 'Gain after the mix, in decibels.' },
];

export const GROUPS = [
  { name: 'The plate', params: plate },
  { name: 'Model and output', params: model },
];

export const PRESETS = {
  'Studio plate': { decay: 2.5, reverb: 0.35, dry: 1 },
  'Short and tight': { decay: 0.8, reverb: 0.4, dry: 1 },
  'Long and dark': { decay: 8, reverb: 0.3, dry: 1 },
  'All plate': { decay: 3, reverb: 1, dry: 0 },
  'Light on the computer': { top: 2500 },
};
export const KEEP = ['level'];
