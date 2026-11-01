// wah-pedal.js — the Wah's descriptor: everything a host needs to run it without its page.
// Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs (the C++ tables).

import { GROUPS, PRESETS, KEEP } from './wah-params.js';
import { GUITAR_PICKUP } from '../../shared/instruments.js';

export const PEDAL = {
  id: 'wah',
  name: 'Wah',
  description: 'An inductor wah: two transistors and a resonant coil, swept by a rocker',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  // a guitar: its pickup (for the Wah backwards), and the 10 nF sweep capacitor it was built with
  guitar: { ...GUITAR_PICKUP, sweepC: 10e-9 },
  // the parameter an expression pedal moves (shared/midi.js maps MIDI CC 1 to it unless taught)
  expression: 'position',
  wasm: { binary: () => new URL('../wasm/wah.wasm', import.meta.url).href },
};
