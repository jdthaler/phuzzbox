// wah-pedal.js — the Wah's descriptor: everything a host needs to run it without its page.
// Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs (the C++ tables).

import { GROUPS, PRESETS, KEEP } from './wah-params.js';

export const PEDAL = {
  id: 'wah',
  name: 'Wah',
  description: 'An inductor wah: two transistors and a resonant coil, swept by a rocker',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  // the parameter an expression pedal moves (shared/midi.js maps MIDI CC 1 to it unless taught)
  expression: 'position',
  wasm: { binary: () => new URL('../wasm/wah.wasm', import.meta.url).href },
};
