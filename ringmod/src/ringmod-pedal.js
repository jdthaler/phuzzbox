// ringmod-pedal.js — the Ring Modulator's descriptor: everything a host needs to run it without its page.
// Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs (the C++ tables).

import { GROUPS, PRESETS, KEEP } from './ringmod-params.js';

export const PEDAL = {
  id: 'ringmod',
  name: 'Ring Modulator',
  description: 'Four diodes in a ring between two transformers, switched by a carrier: every note comes out as its sum and difference with the carrier',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  // a guitar: nothing changes (the input buffer doesn't load a pickup)
  guitar: {},
  // the parameter an expression pedal moves (shared/midi.js maps MIDI CC 1 to it unless taught)
  expression: 'carrier',
  wasm: { binary: () => new URL('../wasm/ringmod.wasm', import.meta.url).href },
};
