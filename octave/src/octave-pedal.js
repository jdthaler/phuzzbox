// octave-pedal.js — the Octave Down's descriptor: everything a host needs to run it without its
// page. Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs.

import { GROUPS, PRESETS, KEEP } from './octave-params.js';

export const PEDAL = {
  id: 'octave',
  name: 'Octave Down',
  description: 'The analog octave divider: a comparator and flip-flops that flip the bass\'s polarity once a cycle, an octave below, and every other cycle, two',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  // a guitar: the tracking filter an octave higher, as the low E is (README, ## Tracking)
  guitar: { track: 150 },
  wasm: { binary: () => new URL('../wasm/octave.wasm', import.meta.url).href },
};
