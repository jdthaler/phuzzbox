// bandgap-pedal.js — the Bandgap's descriptor: everything a host needs to run it without its page.
// Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs (the C++ tables).

import { GROUPS, PRESETS, KEEP } from './bandgap-params.js';

export const PEDAL = {
  id: 'bandgap',
  name: 'Bandgap',
  description: 'An op-amp overdrive whose clipping diodes turn on at their bandgap: germanium, silicon, or LEDs at the energy of their light',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  // a guitar: nothing changes (its 1 MΩ input barely loads a pickup)
  guitar: {},
  wasm: { binary: () => new URL('../wasm/bandgap.wasm', import.meta.url).href },
};
