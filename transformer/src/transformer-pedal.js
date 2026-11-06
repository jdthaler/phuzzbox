// transformer-pedal.js — the Output Transformer's descriptor: everything a host needs to run it without its page.
// Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs (the C++ tables).

import { GROUPS, PRESETS, KEEP } from './transformer-params.js';

export const PEDAL = {
  id: 'transformer',
  name: 'Output Transformer',
  description: 'A valve amplifier\'s output transformer, whose iron core follows Jiles and Atherton\'s model of hysteresis: the low notes, which need the most flux, saturate it first',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  // a guitar: nothing changes (the source is a buffer: it doesn't load a pickup)
  guitar: {},
  // the parameter an expression pedal moves (shared/midi.js maps MIDI CC 1 to it unless taught)
  expression: 'drive',
  wasm: { binary: () => new URL('../wasm/transformer.wasm', import.meta.url).href },
};
