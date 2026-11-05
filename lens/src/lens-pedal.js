// lens-pedal.js — the Gravitational Lens's descriptor: everything a host needs to run it without its
// page. Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs.

import { GROUPS, PRESETS, KEEP } from './lens-params.js';

export const PEDAL = {
  id: 'lens',
  name: 'Gravitational Lens',
  description: 'Your bass from far behind a star or a black hole, bent round it on its way to you: two images arrive, the second late and Hilbert-transformed, and the long waves diffract round the lens untouched',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  expression: 'offset',
  // a guitar: nothing changes (the lens is the same to any wave)
  guitar: {},
  wasm: { binary: () => new URL('../wasm/lens.wasm', import.meta.url).href },
};
