// preamp-pedal.js — the Tube Preamp's descriptor: everything a host needs to run it without its page.
// Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs (the C++ tables).

import { GROUPS, PRESETS, KEEP } from './preamp-params.js';

export const PEDAL = {
  id: 'preamp',
  name: 'Tube Preamp',
  description: 'A 1959 Bassman\'s preamp: three 12AX7 triodes that conduct at the grid, and its passive tone stack',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  wasm: { binary: () => new URL('../wasm/preamp.wasm', import.meta.url).href },
};
