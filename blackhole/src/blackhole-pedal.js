// blackhole-pedal.js — the Black Hole's descriptor: everything a host needs to run it without its
// page. Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs.

import { GROUPS, PRESETS, KEEP } from './blackhole-params.js';

export const PEDAL = {
  id: 'blackhole',
  name: 'Black Hole',
  description: 'Your bass perturbs a spinning black hole, and it rings in its quasinormal modes, as LIGO hears after a merger: mass sets the pitch, spin the ring',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  wasm: { binary: () => new URL('../wasm/blackhole.wasm', import.meta.url).href },
};
