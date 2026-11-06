// neon-pedal.js — the Neon Tremolo's descriptor: everything a host needs to run it without its
// page. Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs.

import { GROUPS, PRESETS, KEEP } from './neon-params.js';

export const PEDAL = {
  id: 'neon',
  name: 'Neon Tremolo',
  description: 'A tremolo from a neon lamp flashing in a relaxation oscillator: Paschen\'s law sets when it strikes, and its flashes light a photocell that ducks the bass',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  expression: 'rate',
  // a guitar: nothing changes (the divider's 100 kΩ barely loads a pickup)
  guitar: {},
  wasm: { binary: () => new URL('../wasm/neon.wasm', import.meta.url).href },
};
