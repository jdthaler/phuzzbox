// transformer-params.js — the Output Transformer's controls. Values in SI units; `scale` shows them in friendlier ones.

export const MATERIALS = [['iron', 'Iron'], ['nickel', '50 % nickel'], ['permalloy', 'Permalloy']];

const stage = [
  { id: 'drive', label: 'Drive', min: 30, max: 3000, def: 1000, log: true, unit: 'V/V', decimals: 0, perform: true,
    hint: 'How far the output valves swing the transformer\'s primary per volt of your bass: Vs = Drive × the input. The output is divided by the same Drive, so turning it up works the iron harder without making the pedal louder. The flux a note needs goes as its voltage over its frequency, so the low notes saturate the core first: with the stock parts a 1 V low E takes the iron to 1.4 T and comes out with an 11 % third harmonic, where a 1 V G, two octaves up, needs 0.7 T and keeps it to 3 %. An expression pedal moves it (MIDI CC 1 unless you teach it another).' },
  { id: 'source', label: 'Plate resistance', min: 300, max: 100000, def: 2000, log: true, unit: 'Ω', decimals: 0, perform: true,
    hint: 'The resistance of the source driving the primary: the output valves\' plate resistance, as the amplifier\'s negative feedback leaves it. The core\'s magnetising current drops a voltage across it, so the higher it is, the more of the iron\'s loop you hear and the more of the bass the primary\'s inductance lets through to ground: a 0.3 V low E comes out 0.7 dB down with a 2.4 % third harmonic at 500 Ω, but 15 dB down with 19 % at 20 kΩ. A stiff source makes the flux follow the voltage whatever the iron does, until it saturates.' },
  { id: 'area', label: 'Core', min: 2e-4, max: 5e-3, def: 1e-3, log: true, unit: 'cm²', scale: 1e4, decimals: 1, perform: true,
    hint: 'The cross-section of the core\'s iron. Faraday\'s law sets the flux density a note needs, B = V/(2π f N A): double the area and every note needs half the flux, and the primary\'s inductance doubles, so the bass comes through cleaner. A 0.3 V low E gets a 4.7 % third harmonic at 30 cm² and 18 % at 3 cm², where a 1 V low E saturates the core and comes out 10 dB down, its third harmonic half the note.' },
  { id: 'level', label: 'Level', min: -24, max: 12, def: 1.7, unit: 'dB', decimals: 1, perform: true,
    hint: 'The output: the speaker\'s voltage scaled back to the input\'s, so that at 0 dB a perfect core would pass your bass unchanged, and then this. Iron that takes current makes the pedal quieter, the low notes most.' },
];

const iron = [
  { id: 'material', label: 'Material', type: 'select', def: 'iron', options: MATERIALS,
    hint: 'What the core is made of, by its Jiles–Atherton parameters. Iron, Jiles and Atherton\'s own of 1986: a wide loop, its coercive field 390 A/m, saturating at 2.0 T, gritty with hysteresis at every level. 50 % nickel–iron: a narrow loop, 3.9 A/m, clean until it saturates, at 1.2 T. Permalloy: narrower still, 0.57 A/m, the cleanest, but it saturates at 0.77 T, so on a small core a firm low E flattens.' },
];

export const GROUPS = [
  { name: 'The output stage', params: stage },
  { name: 'The core', params: iron },
];

// Each preset shows one idea, at the level that makes it as loud as bypass on the test bass's riff
// (tools/loudness.mjs).
const stock = { drive: 1000, source: 2000, area: 1e-3, level: 1.7, material: 'iron' };
export const PRESETS = {
  'Iron': { ...stock },
  'Big iron': { ...stock, level: 0.7, area: 3e-3 },
  'Small iron': { ...stock, level: 3.6, area: 3e-4 },
  'Stiff source': { ...stock, level: 0.5, source: 500 },
  'Soft source': { ...stock, level: 5.9, source: 20000 },
  '50 % nickel': { ...stock, level: 0, material: 'nickel', area: 5e-4 },
  'Permalloy': { ...stock, level: 0, material: 'permalloy', area: 5e-4 },
};
export const KEEP = [];
