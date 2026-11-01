// envelope-pedal.js — the Envelope Filter's descriptor: everything a host needs to run it without
// its page. Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs.

import { GROUPS, PRESETS, KEEP } from './envelope-params.js';

export const PEDAL = {
  id: 'envelope',
  name: 'Envelope Filter',
  description: 'A resonant state-variable filter swept by how hard you play: an envelope follower lights an LED, and the photocells it lights set the cutoff',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  // a guitar: 15 nF sweeps a guitar's range, 317 Hz to 4.8 kHz (README)
  guitar: { rangeC: 15e-9 },
  wasm: { binary: () => new URL('../wasm/envelope.wasm', import.meta.url).href },
};
