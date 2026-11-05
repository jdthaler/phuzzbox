// bandgap-params.js — the Bandgap's controls. Values in SI units; `scale` shows them in friendlier ones.

// the clipping diodes, in the order of the voltage they turn on at (native/pedals/bandgap/bandgap-model.cpp)
export const DIODES = [
  ['ge', 'Germanium'], ['schottky', 'Schottky'], ['si', 'Silicon'],
  ['red', 'Red LED'], ['green', 'Green LED'], ['blue', 'Blue LED'], ['none', 'None'],
];

const pedal = [
  { id: 'drive', label: 'Drive', min: 0, max: 1, def: 0.6, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'A 100 kΩ audio-taper pot in the op-amp\'s feedback, over 1 kΩ to ground: the gain runs from 1.1 to 101, 1 to 40 dB, and is 16, 24 dB, at its default. More drive pushes the bass further past the diodes\' knee, from a rounded edge to a square wave. Near the top the op-amp\'s own bandwidth, its gain–bandwidth product over the gain, takes the very top off.' },
  { id: 'filter', label: 'Filter', min: 0, max: 1, def: 0.2, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'A 100 kΩ pot (plus 1.5 kΩ) into 3.3 nF after the diodes, behind a buffer: a low-pass from 32 kHz full down to 475 Hz full up, 2.2 kHz at its default. Turned up, it takes the clipping\'s highest harmonics off, from fizz to a dark, woolly drive; it can\'t change how hard the diodes clip, only what of it you hear.' },
  { id: 'level', label: 'Level', min: -30, max: 12, def: -16.4, unit: 'dB', decimals: 1, perform: true,
    hint: 'The output, after a buffer. The diodes hold the level near their own turn-on voltage, so it follows the Diodes switch: LEDs come out several times louder than germanium.' },
  { id: 'diodes', label: 'Diodes', type: 'select', def: 'si', options: DIODES, perform: true,
    hint: 'The pair of diodes from the signal to ground, back to back. Each turns on near its bandgap: germanium and Schottky at about 0.3 V, silicon at 0.6 V, and LEDs at the energy of the light they give out, E = hc/λ, so red at 1.8 V, green 2.2 V, blue 2.5 V. Higher, less clipping and louder, until the op-amp\'s rails clip first. None leaves only the rails. With LEDs the light you see is the clipping.' },
];

const parts = [
  { id: 'perSide', label: 'Diodes each way', type: 'select', def: 'one', options: [['one', 'One each way'], ['two', 'Two each way'], ['asym', 'One up, two down']],
    hint: 'How many diodes in series each way. Two in series turn on at twice the voltage: louder, less clipped. One up and two down clips the two halves of the wave unevenly, which adds the even harmonics a symmetrical clipper doesn\'t make.' },
  { id: 'opamp', label: 'Op-amp', type: 'select', def: 'lm308', options: [['lm308', 'LM308 (slow)'], ['ua741', 'µA741'], ['tl072', 'TL072 (fast)']],
    hint: 'The op-amp: its gain–bandwidth product and its slew rate, the fastest its output can move. The LM308 with its 30 pF compensation slews at about 0.3 V/µs and has 1 MHz of gain–bandwidth; the µA741 slews at 0.5 V/µs; the TL072\'s JFET inputs slew at 13 V/µs, with 3 MHz. On a bass the difference is small: the LM308 takes 20 µs to swing rail to rail where the TL072 takes half a microsecond, and at full drive its bandwidth is 10 kHz against 30 kHz, so with Drive up and Filter down it is a shade darker on high notes.' },
  { id: 'temp', label: 'Temperature', min: -10, max: 50, def: 25, unit: '°C', decimals: 0,
    hint: 'The diodes\' temperature. A diode\'s voltage at a given current falls about 2 mV for every degree for silicon, 1.5 mV for germanium and 1 mV for an LED, by how its saturation current climbs with the bandgap: warm, they clip a little lower and quieter; cold, a little higher.' },
  { id: 'supply', label: 'Supply', min: 9, max: 18, def: 9, unit: 'V', decimals: 1,
    hint: 'The supply: 9 V from a battery or adapter, 18 V from a doubler. The op-amp\'s output swings to within about 1.5 V of each rail, so 9 V leaves it ±3 V and 18 V ±7.5 V. With silicon it hardly matters; with blue LEDs, two each way or None, more supply lets the diodes clip before the rails do.' },
  { id: 'lowCut', label: 'Low-cut capacitor', min: 0.22e-6, max: 22e-6, def: 10e-6, log: true, unit: 'µF', scale: 1e6, decimals: 2,
    hint: 'The capacitor in series with the 1 kΩ to ground in the feedback: below 1/(2π · 1 kΩ · C) the gain falls to 1, so the lows are not driven. 10 µF puts that at 16 Hz, below the low B; 2.2 µF, as in many guitar pedals, at 72 Hz, which thins a bass\'s low notes before they clip; 0.22 µF at 720 Hz keeps the bottom clean under the distortion.' },
];

export const GROUPS = [
  { name: 'The pedal', params: pedal },
  { name: 'Diodes and op-amp', params: parts },
];

// Each preset shows one idea.
const stock = { drive: 0.6, filter: 0.2, level: -16.4, diodes: 'si', perSide: 'one', opamp: 'lm308', temp: 25, supply: 9, lowCut: 10e-6 };
export const PRESETS = {
  'Silicon': { ...stock },
  'Germanium, soft and low': { ...stock, diodes: 'ge', level: -8 },
  'Red LEDs, open and loud': { ...stock, diodes: 'red', level: -24 },
  'Blue LEDs, barely clipping': { ...stock, diodes: 'blue', level: -26 },
  'No diodes: the rails': { ...stock, diodes: 'none', level: -26 },
  'Two each way': { ...stock, perSide: 'two', level: -22 },
  'Lopsided: one up, two down': { ...stock, perSide: 'asym', level: -20 },
  'Flat out, slow op-amp': { ...stock, drive: 1, filter: 0 },
  'Flat out, fast op-amp': { ...stock, drive: 1, filter: 0, opamp: 'tl072' },
  'Bright, guitar-pedal low cut': { ...stock, lowCut: 2.2e-6, filter: 0.05 },
  'Cold stage (−5 °C)': { ...stock, temp: -5 },
  'Hot stage (45 °C)': { ...stock, temp: 45 },
};
export const KEEP = [];
