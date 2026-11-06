// helmholtz-pedal.js — Helmholtz's Resonators' descriptor: everything a host needs to run it without its
// page. Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs (the C++ tables).

import { GROUPS, PRESETS, KEEP } from './helmholtz-params.js';

export const PEDAL = {
  id: 'helmholtz',
  name: 'Helmholtz\'s Resonators',
  description: 'Your bass heard through one of Helmholtz\'s glass resonators held to your ear, the air in its neck a mass on the spring of the air inside: the partial it is tuned to brays out of the note, as Helmholtz heard the overtones of every tone',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  // a guitar: nothing changes
  guitar: {},
  // the parameter an expression pedal moves (shared/midi.js maps MIDI CC 1 to it unless taught)
  expression: 'glass',
  wasm: { binary: () => new URL('../wasm/helmholtz.wasm', import.meta.url).href },
};
