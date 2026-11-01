// echo-pedal.js — the Tape Echo's descriptor: everything a host needs to run it without its page.
// Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs.

import { GROUPS, PRESETS, KEEP } from './echo-params.js';

export const PEDAL = {
  id: 'echo',
  name: 'Tape Echo',
  description: 'A tape loop past a record head and three playback heads: echoes from distance over speed, coloured by the tape\'s magnetisation and the heads\' losses',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  wasm: { binary: () => new URL('../wasm/echo.wasm', import.meta.url).href },
};
