// opto-pedal.js — the Opto Compressor's descriptor: everything a host needs to run it without its
// page. Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs (the C++ tables).

import { GROUPS, PRESETS, KEEP } from './opto-params.js';

export const PEDAL = {
  id: 'opto',
  name: 'Opto Compressor',
  description: 'An electro-optical leveler: a glowing panel and a photocell with memory turn the bass down',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  guitar: {}, // the same for a guitar as for a bass
  wasm: { binary: () => new URL('../wasm/opto.wasm', import.meta.url).href },
};
