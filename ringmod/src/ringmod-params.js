// ringmod-params.js — the Ring Modulator's controls. Values in SI units; `scale` shows them in friendlier ones.

// the diodes in the ring (native/pedals/ringmod/ringmod-model.cpp: the Bandgap's families)
export const DIODES = [['ge', 'Germanium'], ['schottky', 'Schottky'], ['si', 'Silicon']];
export const WAVES = [['sine', 'Sine'], ['triangle', 'Triangle'], ['square', 'Square']];

const pedal = [
  { id: 'carrier', label: 'Carrier', min: 1, max: 4000, def: 220, log: true, unit: 'Hz', decimals: 1, perform: true,
    hint: 'The carrier oscillator\'s frequency, fc. Each frequency f you play comes out as f + fc and |f − fc|, and neither f nor fc itself: the A at 55 Hz with the carrier at 220 Hz comes out at 165 and 275 Hz. A carrier a whole number of times the note keeps it harmonic; anything else rings like a bell. Below about 20 Hz the sum and difference are too close to hear apart, and it is a tremolo whose every other beat comes out upside down. An expression pedal sweeps it (MIDI CC 1 unless you teach it another).' },
  { id: 'carrierLevel', label: 'Carrier level', min: 0.03, max: 10, def: 3, log: true, unit: 'V', decimals: 2, perform: true,
    hint: 'The carrier\'s peak voltage, into the input transformer\'s centre tap through 470 Ω. Well above the diodes\' knee it switches them hard, so the bass is multiplied by a square wave that flips its sign, and the sidebands of the carrier\'s odd harmonics, 3fc ± f, 5fc ± f, come with it, a third and a fifth as loud. Well below the knee, at its lowest, 30 mV, the diodes multiply the two smoothly, as tanh does, and f ± fc come out almost alone, 20 dB quieter. With the bass louder than the carrier, the bass switches the diodes too, and its own harmonics join the sidebands: 3f ± fc.' },
  { id: 'wave', label: 'Carrier wave', type: 'select', def: 'sine', options: WAVES, perform: true,
    hint: 'The carrier\'s shape. Strong enough, any of them switches the ring, so they differ most near the knee: a triangle spends longer near zero than a sine, so the ring is off more of the time; a square, from a comparator slewing at 0.5 V/µs, switches almost at once, the hardest and brightest.' },
  { id: 'mix', label: 'Mix', min: 0, max: 1, def: 1, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'How much of the ring\'s output against the dry bass, taken from the input buffer. At 100 % only the sidebands: the note you play is gone. Lower, the note comes back under them.' },
  { id: 'level', label: 'Level', min: -30, max: 24, def: 0, unit: 'dB', decimals: 1, perform: true,
    hint: 'The output, after the recovery amplifier. Its gain of 2 makes up the half that the 600 Ω transformers lose into their 600 Ω load, so at 0 dB a strong carrier gives back sidebands about as loud as the bass went in. A weak carrier\'s are quieter, and the recovery amplifier has up to 24 dB more for them.' },
];

const ring = [
  { id: 'diodes', label: 'Diodes', type: 'select', def: 'ge', options: DIODES,
    hint: 'The four diodes of the ring. The early telephone modulators used copper-oxide rectifiers, the first synthesizers\' germanium point-contact diodes. Germanium and Schottky diodes turn on at about 0.3 V, silicon at 0.6 V, so silicon needs a stronger carrier to switch fully: at 0.3 V of carrier the sidebands from silicon are more than ten times quieter than from germanium.' },
  { id: 'mismatch', label: 'Mismatch', min: 0, max: 0.03, def: 0.002, unit: 'mV', scale: 1000, decimals: 1,
    hint: 'How much more voltage one of the four diodes needs for the same current than the other three. A perfectly matched ring is balanced: the carrier and the bass cancel at the output. One diode off by 2 mV lets about a millivolt of a 3 V carrier through, a quiet whistle at fc under the sidebands; 30 mV, fifteen times as much.' },
  { id: 'inductance', label: 'Transformer inductance', min: 0.1, max: 30, def: 3, log: true, unit: 'H', decimals: 2,
    hint: 'The two transformers\' magnetising inductance, across their windings. Below R/(2πL), where R is the 600 Ω either side of them in parallel, about 300 Ω, they let the low frequencies past their windings: 3 H puts it at 16 Hz, below the low B, but 0.3 H at 160 Hz thins the bass going in and the low difference tones coming out.' },
];

export const GROUPS = [
  { name: 'The pedal', params: pedal },
  { name: 'The ring', params: ring },
];

// Each preset shows one idea, at the level that makes it as loud as bypass on the test bass's riff
// (tools/loudness.mjs).
const stock = { carrier: 220, carrierLevel: 3, wave: 'sine', mix: 1, level: 0, diodes: 'ge', mismatch: 0.002, inductance: 3 };
export const PRESETS = {
  'Two octaves up: 220 Hz': { ...stock },
  'Bell': { ...stock, carrier: 311, level: -0.6 },
  'Low carrier: 110 Hz': { ...stock, carrier: 110, level: 0.8 },
  'Square carrier': { ...stock, wave: 'square', level: -0.4 },
  'Smooth multiplier': { ...stock, carrierLevel: 0.03, level: 22.3 },
  'Silicon, under-driven': { ...stock, diodes: 'si', carrierLevel: 0.5, level: 7 },
  'Upside-down tremolo': { ...stock, carrier: 6, mix: 0.5, level: 3.2 },
  'High and metallic': { ...stock, carrier: 1400, wave: 'triangle', level: -2.5 },
  'Leaky ring': { ...stock, mismatch: 0.03, level: -0.2 },
  'Small transformers': { ...stock, inductance: 0.3, level: 3.8 },
};
export const KEEP = [];
