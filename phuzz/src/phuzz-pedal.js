// phuzz-pedal.js — the Phuzz's descriptor: everything a host needs to run it without its page.
// Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs (the C++ tables).

import { GROUPS, PRESETS, KEEP } from './phuzz-params.js';

export const PEDAL = {
  id: 'phuzz',
  name: 'Phuzz',
  description: 'A two-transistor germanium fuzz, from Ebers–Moll transistors that drift with temperature',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  wasm: { binary: () => new URL('../wasm/phuzz.wasm', import.meta.url).href },
};
