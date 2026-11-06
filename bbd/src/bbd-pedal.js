// bbd-pedal.js — the Bucket Brigade's descriptor: everything a host needs to run it without its page.
// Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs (the C++ tables).

import { GROUPS, PRESETS, KEEP } from './bbd-params.js';

export const PEDAL = {
  id: 'bbd',
  name: 'Bucket Brigade',
  description: 'A bucket-brigade delay: a chain of capacitors passing charges along at a clock, as chorus, flanger and vibrato',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  guitar: {},
  // the parameter an expression pedal moves (shared/midi.js maps MIDI CC 1 to it unless taught)
  expression: 'clock',
  wasm: { binary: () => new URL('../wasm/bbd.wasm', import.meta.url).href },
};
