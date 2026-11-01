// instruments.js — the two instruments a page can be set up for, bass and guitar: their open
// strings, the tuner's range for each, the test instrument's riff, and the pickup each pedal that
// models one starts from (the test bass's and the test guitar's own: native/sources/testbass).
// The player chooses one in the Rig (shared/shell.js); each pedal keeps its settings for each.
// A descriptor's `guitar` holds the values its parameters take for a guitar where they differ from
// the defaults (which are the bass's): the pickup, and the ranges a circuit was built for.

export const INSTRUMENTS = {
  bass: {
    id: 'bass', name: 'Bass', test: 'Test bass',
    open: [28, 33, 38, 43], strings: ['E', 'A', 'D', 'G'],
    // the open strings of four-, five- and six-string basses: B0 E1 A1 D2 G2 C3
    tunerOpen: [23, 28, 33, 38, 43, 48],
    tuner: { fmin: 30, fmax: 500 },
  },
  guitar: {
    id: 'guitar', name: 'Guitar', test: 'Test guitar',
    open: [40, 45, 50, 55, 59, 64], strings: ['E', 'A', 'D', 'G', 'B', 'e'],
    // the open strings of six- and seven-string guitars: B1 E2 A2 D3 G3 B3 E4
    tunerOpen: [35, 40, 45, 50, 55, 59, 64],
    // drop C's low C (65 Hz) to the high E's 24th fret (1319 Hz)
    tuner: { fmin: 60, fmax: 1400 },
  },
};
export const instrument = (id) => INSTRUMENTS[id] ?? INSTRUMENTS.bass;

// A guitar's pickup, as the test guitar's: a single coil of 2.5 H and 6 kΩ, its own 100 pF, a
// 250 kΩ volume pot and a 250 kΩ tone pot to ground (125 kΩ). The bass's are the descriptors'
// defaults (a P pickup, 3.6 H and 10.5 kΩ, the same pots).
export const GUITAR_PICKUP = { pickupL: 2.5, pickupR: 6000, pickupC: 100e-12, pots: 125e3 };

// An original two-bar line to hear a pedal with when nothing is plugged in, at 96 beats a minute:
// [key, beats], key 0 a rest. The guitar plays the bass's line an octave up, where a guitar has it.
export const RIFFS = {
  bass: [[28, 0.5], [28, 0.5], [40, 0.5], [28, 0.5], [31, 0.5], [33, 0.5], [0, 0.5], [35, 0.5],
    [28, 0.5], [28, 0.5], [38, 0.5], [40, 0.25], [38, 0.25], [35, 0.5], [33, 0.5], [31, 1]],
};
RIFFS.guitar = RIFFS.bass.map(([k, b]) => [k ? k + 12 : 0, b]);

// Where a page keeps a pedal's settings for each instrument (the bass's where they always were),
// and a pedal's defaults for one: the descriptor's, with its `guitar` values for a guitar.
export const INSTRUMENT_KEY = 'phuzzbox.instrument';
export const paramsKey = (id, inst) => (inst === 'guitar' ? `phuzzbox.${id}.guitar.params` : `phuzzbox.${id}.params`);
export const instrumentDefaults = (PEDAL, defaults, inst) => ({ ...defaults, ...(inst === 'guitar' ? PEDAL.guitar ?? {} : {}) });
