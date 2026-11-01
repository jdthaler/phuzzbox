// buffer-pedal.js — the Buffer's descriptor: everything a host needs to run it without its page.
// Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs (the C++ tables).

import { GROUPS, PRESETS, KEEP } from './buffer-params.js';
import { GUITAR_PICKUP } from '../../shared/instruments.js';

export const PEDAL = {
  id: 'buffer',
  name: 'Buffer',
  description: 'A passive pickup into a cable and an input, as a circuit',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  // a guitar: its pickup (shared/instruments.js)
  guitar: GUITAR_PICKUP,
  wasm: { binary: () => new URL('../wasm/buffer.wasm', import.meta.url).href },
};
