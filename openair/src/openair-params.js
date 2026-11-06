// openair-params.js — Open Air's controls. Values in SI units; `scale` shows them in friendlier ones.

export const GROUNDS = [['snow', 'Fresh snow'], ['forest', 'Forest floor'], ['grass', 'Grass'], ['dirt', 'Dirt road'], ['asphalt', 'Asphalt']];

const air = [
  { id: 'distance', label: 'Distance', min: 3, max: 1000, def: 100, log: true, unit: 'm', decimals: 0, perform: true, hint: "How far away you stand, along the ground. The farther, the deeper the ground's dip and the more treble the air takes: over grass the dip near 500 Hz is 18 dB deep at 100 m and 40 dB at 1 km, and the air takes 30 dB from 4 kHz over the kilometre. An expression pedal moves it." },
  { id: 'ground', label: 'Ground', type: 'select', def: 'grass', options: GROUNDS, perform: true, hint: "How readily air flows into the ground, its flow resistivity: the softer, the lower the dip. At 100 m it is at 190 Hz over fresh snow, 240 over a forest floor, 500 over grass and 1.6 kHz over a dirt road. Asphalt, which no air enters, is a mirror: the paths cancel only where the reflected one is half a wavelength longer, at 5.4 kHz." },
  { id: 'humidity', label: 'Humidity', min: 5, max: 100, def: 50, unit: '%', decimals: 0, perform: true, hint: "How much water vapour the air holds. Water lets the oxygen and nitrogen molecules shed the vibration a sound wave gives them sooner, so dry air takes the most treble: over a kilometre at 20 °C, 2 kHz loses 45 dB at 10 % but 10 dB at 50 %." },
  { id: 'temperature', label: 'Temperature', min: -20, max: 40, def: 20, unit: '°C', decimals: 0, perform: true, hint: "The air's temperature: how fast sound goes, 331 m/s at 0 °C and 343 at 20 °C, and how much treble the air takes: at 50 % humidity 4 kHz loses 71 dB over a kilometre at 0 °C and 30 dB at 20 °C." },
  { id: 'level', label: 'Level', min: -24, max: 18, def: -3.4, unit: 'dB', decimals: 1, perform: true, hint: "The output. At 0 dB the direct sound comes as loud as it was a metre from the bass, the spreading made up, and the ground's reflection adds to it: over grass at 100 m the low E comes 6 dB up." },
];

const where = [
  { id: 'source', label: 'Source height', min: 0.2, max: 3, def: 1, unit: 'm', decimals: 1, hint: "How high the bass's speaker stands. Lower, the two paths come closer together and the dip moves up: over grass at 100 m it is at 1.2 kHz with the speaker at 0.2 m, 500 Hz at 1 m and 400 Hz at 3 m." },
  { id: 'listener', label: 'Listener height', min: 0.2, max: 3, def: 1.6, unit: 'm', decimals: 1, hint: "How high your ears are. Over grass at 100 m the dip is at 680 Hz and 24 dB deep with your ears at 0.5 m, and at 480 Hz and 12 dB deep at 3 m." },
];

export const GROUPS = [
  { name: 'The field', params: air },
  { name: 'Where you stand', params: where },
];

const stock = { distance: 100, ground: 'grass', humidity: 50, temperature: 20, level: -3.4, source: 1, listener: 1.6 };
export const PRESETS = {
  'Across a field': { ...stock },
  'Fresh snow': { ...stock, level: 7.0, ground: 'snow' },
  'In the woods': { ...stock, level: 7.3, ground: 'forest', distance: 300 },
  'Dirt road': { ...stock, level: -5.6, ground: 'dirt' },
  'Car park': { ...stock, level: -5.8, ground: 'asphalt', distance: 30 },
  'Far across the field': { ...stock, level: 1.1, distance: 1000 },
  'Dry air': { ...stock, level: -5.3, ground: 'dirt', distance: 300, humidity: 10 },
  'Winter night': { ...stock, level: 13.4, ground: 'snow', distance: 300, humidity: 80, temperature: -10 },
};
export const KEEP = [];
