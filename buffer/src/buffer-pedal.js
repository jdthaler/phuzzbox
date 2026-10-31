// buffer-pedal.js — the Buffer's descriptor: everything a host needs to run it without its page.
// Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs (the C++ tables).

import { GROUPS, PRESETS, KEEP } from './buffer-params.js';

export const PEDAL = {
  id: 'buffer',
  name: 'Buffer',
  description: 'A passive pickup into a cable and an input, as a circuit',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  wasm: { binary: () => new URL('../wasm/buffer.wasm', import.meta.url).href },
};
