// tunnel-params.js — the Tunnel Diode's controls. Values in SI units; `scale` shows them in friendlier ones.

export const CIRCUITS = [['switch', 'Switch'], ['oscillator', 'Oscillator']];

const circuit = [
  { id: 'drive', label: 'Drive', min: 0.3, max: 30, def: 2, log: true, unit: 'V/V', decimals: 1, perform: true,
    hint: 'How much of your bass reaches the source: Vs = Bias + Drive × the input. In the switch a note flips the diode only when it carries Vs past a threshold: at 2 V/V, with a 1 kΩ load and the bias centred at 760 mV, a note has to peak over 0.155 V to flip it up and 0.174 V to flip it back, so a note that dies below that stops switching rather than fading, and the diode passes only a twentieth of it, on its branch. In the oscillator it is how far your bass sweeps the oscillator\'s bias, and with it the pitch.' },
  { id: 'bias', label: 'Bias', min: 0, max: 1.5, def: 0.76, unit: 'mV', scale: 1000, decimals: 0, perform: true,
    hint: 'Vs with nothing playing. In the switch it centres your bass\'s swing in the memory: with a 1 kΩ load the diode jumps up when Vs passes 1071 mV and down when it falls under 412 mV, so at 760 mV the square comes out even, and off centre, at 900 mV, lopsided, with even harmonics. In the oscillator it sets where the load line crosses the falling part of the curve: at 20 Ω it oscillates only for Vs from 76 to 352 mV (the peak\'s and the valley\'s voltages, plus 20 Ω times their currents), at 232 Hz at 200 mV with 0.5 H and 125 Hz at 100 mV. An expression pedal moves it (MIDI CC 1 unless you teach it another).' },
  { id: 'load', label: 'Load', min: 10, max: 3300, def: 1000, log: true, unit: 'Ω', decimals: 0, perform: true,
    hint: 'The resistor between the source and the diode. Steeper than the diode\'s steepest negative slope, 152 Ω, its load line can cross the curve three times and the switch has memory, a window between jumping up and jumping down: 0.1 V wide at 330 Ω, 0.66 V at 1 kΩ, 1.7 V at 2.2 kΩ. Under 152 Ω there is none: the switch\'s voltage runs steeply through the falling part instead of jumping, and the oscillator can oscillate.' },
  { id: 'inductor', label: 'Inductor', min: 0.05, max: 5, def: 0.5, log: true, unit: 'H', decimals: 2, perform: true,
    hint: 'The oscillator\'s inductor, in series with the load: the current has to ramp through it from the valley\'s 0.1 mA to the peak\'s 1 mA and back, so the pitch goes as 1/L: at 20 Ω and 200 mV, 2.32 kHz at 0.05 H, 232 Hz at 0.5 H, 23.2 Hz at 5 H. The switch ignores it.' },
  { id: 'level', label: 'Level', min: -24, max: 12, def: -4.3, unit: 'dB', decimals: 1, perform: true,
    hint: 'The output: the diode\'s own voltage, through a coupling capacitor, less this. At 0 dB, centred, a 0.3 V note comes out a square 0.65 V from trough to crest, the jump between the branches plus what each branch passes of the note, its third harmonic 30 % of it.' },
];

const parts = [
  { id: 'circuit', label: 'Circuit', type: 'select', def: 'switch', options: CIRCUITS,
    hint: 'Switch: the load resistor alone, a Schmitt trigger with the diode\'s memory, which makes every note that reaches the threshold a square wave. Oscillator: an inductor in series with the load, the GE manual\'s relaxation oscillator: with the load line resting on the falling part nothing is stable, the current ramps through the inductor along one branch until the branch ends, at the peak or the valley, the voltage jumps across in nanoseconds, and the current ramps back.' },
];

export const GROUPS = [
  { name: 'The circuit', params: circuit },
  { name: 'The parts', params: parts },
];

// Each preset shows one idea, at the level that makes it as loud as bypass on the test bass's riff
// (tools/loudness.mjs).
const stock = { drive: 2, bias: 0.76, load: 1000, level: -4.3, circuit: 'switch', inductor: 0.5 };
const osc = { ...stock, circuit: 'oscillator', load: 20, bias: 0.2, drive: 0.3, level: -11.2 };
export const PRESETS = {
  'A switch with memory': { ...stock },
  'Narrow memory': { ...stock, level: -7.0, load: 330, bias: 0.346 },
  'Wide memory': { ...stock, level: -4.7, load: 2200, bias: 1.42, drive: 5 },
  'Lopsided': { ...stock, level: -4.6, bias: 0.9 },
  'No memory': { ...stock, level: 1.2, load: 120, bias: 0.2, drive: 0.5 },
  'Relaxation oscillator': { ...osc },
  'Gated buzz': { ...osc, level: -4.5, bias: 0.05, drive: 1 },
  'Low drone': { ...osc, level: -4.3, inductor: 5 },
};
export const KEEP = [];
