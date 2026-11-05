// cable-pedal.js — the Transatlantic Cable's descriptor: everything a host needs to run it
// without its page. Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs.

import { GROUPS, PRESETS, KEEP } from './cable-params.js';

export const PEDAL = {
  id: 'cable',
  name: 'Transatlantic Cable',
  description: 'Your bass sent down a long cable: Kelvin\'s law of squares smears it, Heaviside\'s loading straightens it out, and an open far end echoes',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  // a guitar: nothing changes (the input buffer barely loads a pickup)
  guitar: {},
  wasm: { binary: () => new URL('../wasm/cable.wasm', import.meta.url).href },
};
