// sympathetic-pedal.js — the Sympathetic Strings' descriptor: everything a host needs to run it
// without its page. Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs.

import { GROUPS, PRESETS, KEEP } from './sympathetic-params.js';

export const PEDAL = {
  id: 'sympathetic',
  name: 'Sympathetic Strings',
  description: 'A frame of stiff steel strings tuned to a key, all on one bridge your bass shakes: they ring along with the notes whose harmonics they share',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  guitar: {}, // the same for a guitar as for a bass
  wasm: { binary: () => new URL('../wasm/sympathetic.wasm', import.meta.url).href },
};
