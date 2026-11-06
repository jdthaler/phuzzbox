// rubens-params.js — Rubens' Tube's controls. Values in SI units.

// the gases, by NIST's properties at 20 °C and one atmosphere (rubens-model.cpp)
export const GASES = [['propane', 'Propane'], ['methane', 'Methane']];

const tube = [
  { id: 'length', label: 'Length', min: 0.5, max: 4, def: 1.524, log: true, unit: 'm', decimals: 2, perform: true, hint: 'The pipe\'s length. Its modes are c/2L apart, so a longer pipe rings lower: the first peak at 80.9 Hz in the stock 1.524 m of propane, 34.5 Hz at 3.5 m, 208 Hz at 0.6 m.' },
  { id: 'gas', label: 'Gas', type: 'select', def: 'propane', options: GASES, perform: true, hint: 'The gas in the pipe. Sound travels at 445 m/s in methane, natural gas, and 247 m/s in propane, so the same pipe\'s first peak moves from 80.9 Hz to 147 Hz.' },
  { id: 'drive', label: 'Drive', min: 1, max: 100, def: 10, log: true, unit: 'V/V', decimals: 1, perform: true, hint: 'The amplifier\'s gain, from your bass to the speaker. The pipe is linear, so it only sets how hard the gas is shaken: at the stock pipe\'s first peak, 528 Pa at the cap for each volt on the speaker.' },
  { id: 'mic', label: 'Microphone', min: 0, max: 100, def: 100, unit: '%', decimals: 0, perform: true, hint: 'Where the microphone listens, from the speaker (0 %) to the cap (100 %). At the cap it hears every mode; in the middle it sits on the odd modes\' pressure nodes and hears them more than 40 dB down, an octave up. An expression pedal moves it.' },
  { id: 'level', label: 'Level', min: -36, max: 24, def: -7.9, unit: 'dB', decimals: 1, perform: true, hint: 'The output: the microphone\'s 1 mV/Pa, times this.' },
];

const more = [
  { id: 'diameter', label: 'Diameter', min: 2, max: 15, def: 5.2, log: true, unit: 'cm', decimals: 1, hint: 'The pipe\'s bore, and the speaker\'s cone, which fills it. A wider pipe loads the speaker more, which damps the lowest modes harder: the first five peaks\' Q is 14, 42, 87, 154 and 200 at the stock 5.2 cm, 3, 13, 35, 67 and 118 at 10.2 cm. Plane waves only travel below 2.8 kHz in the stock pipe, 1.4 kHz in the wide one.' },
  { id: 'pressure', label: 'Gas pressure', min: 100, max: 2000, def: 500, log: true, unit: 'Pa', decimals: 0, hint: 'The gas\'s pressure in the pipe, over the air\'s: how tall the flames stand, and how deeply the sound cuts into them (The flames). It doesn\'t change the sound.' },
];

export const GROUPS = [
  { name: 'The tube', params: tube },
  { name: 'Its bore and its gas', params: more },
];

const stock = { length: 1.524, gas: 'propane', drive: 10, mic: 100, level: -7.9, diameter: 5.2, pressure: 500 };
export const PRESETS = {
  'Gardner\'s tube': { ...stock },
  'Natural gas': { ...stock, gas: 'methane', level: -5.6 },
  'Mid-tube microphone': { ...stock, mic: 50, level: -5.2 },
  'Long tube': { ...stock, length: 3.5, level: -1.6 },
  'Wide bore': { ...stock, diameter: 10.2, level: -1.6 },
  'Short tube': { ...stock, length: 0.6, mic: 75, level: 3.1 },
};
export const KEEP = [];
