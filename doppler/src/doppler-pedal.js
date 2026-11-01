// doppler-pedal.js — the Doppler's descriptor: everything a host needs to run it without its
// page. Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs.

import { GROUPS, PRESETS, KEEP } from './doppler-params.js';

export const PEDAL = {
  id: 'doppler',
  name: 'Doppler',
  description: 'A source plays your bass as it passes you, again and again, heard at its retarded time: the pitch falls as it goes by, and above Mach 1 the boom',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  wasm: { binary: () => new URL('../wasm/doppler.wasm', import.meta.url).href },
};
