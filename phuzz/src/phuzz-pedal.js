// phuzz-pedal.js — the Phuzz's descriptor: everything a host needs to run it without its page.
// Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs (the C++ tables).

import { GROUPS, PRESETS, KEEP } from './phuzz-params.js';
import { GUITAR_PICKUP } from '../../shared/instruments.js';

export const PEDAL = {
  id: 'phuzz',
  name: 'Phuzz',
  description: 'A two-transistor germanium fuzz, from Ebers–Moll transistors that drift with temperature',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  // a guitar: its pickup, which the Phuzz loads (shared/instruments.js)
  guitar: GUITAR_PICKUP,
  wasm: { binary: () => new URL('../wasm/phuzz.wasm', import.meta.url).href },
};
