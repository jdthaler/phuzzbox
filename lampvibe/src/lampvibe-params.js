// lampvibe-params.js — the Lamp Vibe's controls. Values in SI units; `scale` shows them in
// friendlier ones.

// the lamps, in the order of native/pedals/lampvibe/lampvibe-model.cpp's table
export const BULBS = [
  ['grain', 'Grain of wheat, 12 V 50 mA'], ['pilot', 'Pilot lamp, 6.3 V 150 mA'], ['panel', 'Panel bulb, 12 V 5 W'],
];

const pedal = [
  { id: 'speed', label: 'Speed', min: 0.5, max: 12, def: 2.5, log: true, unit: 'Hz', decimals: 2, perform: true,
    hint: 'How fast the oscillator swings the lamp, from one sweep every two seconds to twelve a second. The filament stores heat, so the faster it goes, the less its temperature swings: the stock pilot lamp at 70 % Intensity swings between about 1710 K and 2500 K at 1 Hz, but only between 2010 K and 2390 K at 12 Hz, and the sweep grows shallower.' },
  { id: 'intensity', label: 'Intensity', min: 0, max: 1, def: 0.7, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'How far the lamp\'s voltage dips below its rating each cycle. At 70 % it falls to 30 % of the rating; slowly swept, the filament cools from 2500 K to about 1700 K, its glow at the cells falls nearly a hundredfold, and the cells\' resistance climbs from 5 kΩ to some 250 kΩ, sweeping the notches over nearly six octaves. At 0 the lamp burns steady and the notches stand still.' },
  { id: 'level', label: 'Level', min: -30, max: 12, def: 4.1, unit: 'dB', decimals: 1, perform: true,
    hint: 'The output. The stages pass every frequency at full strength, so in vibrato the output is as loud as the input; in chorus the wet and dry are mixed half and half, and the notches take some away.' },
  { id: 'mode', label: 'Mode', type: 'select', def: 'chorus', options: [['chorus', 'Chorus'], ['vibrato', 'Vibrato']], perform: true,
    hint: 'Chorus mixes the stages\' output with the dry signal: where the four stages have turned a frequency by 180° or 540°, the two cancel, two notches that the lamp sweeps up and down (with the lamp at its rating, near 130 Hz and 3.7 kHz; as it dims, down to a few hertz and 70 Hz). Vibrato is the stages alone: no notches, but as the lamp sweeps their phase, each note\'s pitch wavers.' },
];

const bench = [
  { id: 'bulb', label: 'Lamp', type: 'select', def: 'pilot', options: BULBS,
    hint: 'The bulb. All three run at 2500 K at their rating; a bigger one has a thicker filament, more heat to store for the light it gives, so it follows the oscillator less. At its rating the filament settles with a time constant of 6 ms (the grain of wheat), 13 ms (the pilot lamp) or 25 ms (the panel bulb); at half its voltage, as a cooler filament radiates its heat away more slowly, two and a half times longer.' },
  { id: 'cell', label: 'Cells', min: 2e-3, max: 100e-3, def: 15e-3, log: true, unit: 'ms', scale: 1e3, decimals: 1,
    hint: 'How long a freed electron lasts in the cells\' cadmium sulphide while they are dim. Lit brightly, the electrons find each other and recombine quickly; dim, they linger, so the cells\' resistance falls fast as the light comes up and climbs back slowly. Longer, and the cells smooth the lamp\'s swing and lag it more, and the sweep grows shallower.' },
];

export const GROUPS = [
  { name: 'The pedal', params: pedal },
  { name: 'The lamp and cells', params: bench },
];

const stock = { speed: 2.5, intensity: 0.7, level: 4.1, mode: 'chorus', bulb: 'pilot', cell: 15e-3 };
export const PRESETS = {
  'Chorus': { ...stock },
  'Vibrato': { ...stock, mode: 'vibrato', speed: 5, level: 0 },
  'Slow throb': { ...stock, speed: 0.8, intensity: 1, level: 2.2 },
  'Fast and shallow': { ...stock, speed: 9, intensity: 0.5, level: 3.1 },
  'Lamp steady: the notches stand still': { ...stock, intensity: 0, level: 7.8 },
  'Grain of wheat, quick': { ...stock, bulb: 'grain', speed: 6, intensity: 0.9, level: 4 },
  'Panel bulb: the lamp can\'t keep up': { ...stock, bulb: 'panel', speed: 6, intensity: 0.9, level: 2.4 },
  'Slow cells': { ...stock, cell: 60e-3, level: 3.1 },
  'Seasick vibrato': { ...stock, mode: 'vibrato', speed: 1.5, intensity: 1, level: 0 },
};
export const KEEP = [];
