// preamp-pedal.js — the Tube Preamp's descriptor: everything a host needs to run it without its page.
// Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs (the C++ tables).

import { GROUPS, PRESETS, KEEP } from './preamp-params.js';
import { GUITAR_PICKUP } from '../../shared/instruments.js';

export const PEDAL = {
  id: 'preamp',
  name: 'Tube Preamp',
  description: 'A 1959 Bassman\'s preamp: three 12AX7 triodes that conduct at the grid, and its passive tone stack',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  // a guitar: its pickup, which the preamp's grid sees through the cable (shared/instruments.js)
  guitar: GUITAR_PICKUP,
  wasm: { binary: () => new URL('../wasm/preamp.wasm', import.meta.url).href },
};
