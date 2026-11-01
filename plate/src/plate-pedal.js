// plate-pedal.js — the Plate Reverb's descriptor: everything a host needs to run it without its
// page. Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs.

import { GROUPS, PRESETS, KEEP } from './plate-params.js';

export const PEDAL = {
  id: 'plate',
  name: 'Plate Reverb',
  description: 'A steel plate in a frame, its bending modes from thin-plate theory, its losses the steel\'s and a damper\'s, heard by two pickups',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  wasm: { binary: () => new URL('../wasm/plate.wasm', import.meta.url).href },
};
