// envelope-pedal.js — the Envelope Filter's descriptor: everything a host needs to run it without
// its page. Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs.

import { GROUPS, PRESETS, KEEP } from './envelope-params.js';

export const PEDAL = {
  id: 'envelope',
  name: 'Envelope Filter',
  description: 'A resonant state-variable filter swept by how hard you play: an envelope follower lights an LED, and the photocells it lights set the cutoff',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  wasm: { binary: () => new URL('../wasm/envelope.wasm', import.meta.url).href },
};
