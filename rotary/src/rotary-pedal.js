// rotary-pedal.js — the Rotary Speaker's descriptor: everything a host needs to run it without its
// page. Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs.

import { GROUPS, PRESETS, KEEP } from './rotary-params.js';

export const PEDAL = {
  id: 'rotary',
  name: 'Rotary Speaker',
  description: 'A horn and a drum spinning past two microphones: the Doppler shift of a moving source, its directivity, and motors with inertia',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  guitar: {}, // the same for a guitar as for a bass
  wasm: { binary: () => new URL('../wasm/rotary.wasm', import.meta.url).href },
};
