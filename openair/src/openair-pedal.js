// openair-pedal.js — Open Air's descriptor: everything a host needs to run it without its page.
// Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs (the C++ tables).

import { GROUPS, PRESETS, KEEP } from './openair-params.js';

export const PEDAL = {
  id: 'openair',
  name: 'Open Air',
  description: 'Your bass heard across open ground: the air absorbing its treble by ISO 9613-1, and the ground reflecting it, by Weyl and van der Pol\'s formula, into a dip that moves with the ground and the distance',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  // a guitar: nothing changes
  guitar: {},
  // the parameter an expression pedal moves (shared/midi.js maps MIDI CC 1 to it unless taught)
  expression: 'distance',
  wasm: { binary: () => new URL('../wasm/openair.wasm', import.meta.url).href },
};
