// echo-pedal.js — the Tape Echo's descriptor: everything a host needs to run it without its page.
// Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs.

import { GROUPS, PRESETS, KEEP } from './echo-params.js';

export const PEDAL = {
  id: 'echo',
  name: 'Tape Echo',
  description: 'A tape loop past a record head and three playback heads: echoes from distance over speed, coloured by the tape\'s magnetisation and the heads\' losses',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  guitar: {}, // the same for a guitar as for a bass
  // tap tempo (shared/midi.js): the tape's speed that brings the last head heard round once a beat,
  // its distance over the beat, as far as the capstan's 5 to 40 cm/s reach
  tap: (P, beat) => {
    const d = Math.max(...String(P.heads).split('').map((k) => P[`head${k}`]));
    return { speed: Math.min(0.4, Math.max(0.05, d / beat)) };
  },
  wasm: { binary: () => new URL('../wasm/echo.wasm', import.meta.url).href },
};
