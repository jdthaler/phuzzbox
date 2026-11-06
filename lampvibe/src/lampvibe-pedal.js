// lampvibe-pedal.js — the Lamp Vibe's descriptor: everything a host needs to run it
// without its page. Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs.

import { GROUPS, PRESETS, KEEP } from './lampvibe-params.js';

export const PEDAL = {
  id: 'lampvibe',
  name: 'Lamp Vibe',
  description: 'A phase vibe lit by a glowing tungsten filament: the lamp heats and cools with the oscillator, and four photocells sweep the phase',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  // a guitar: nothing changes (the input buffer barely loads a pickup)
  guitar: {},
  // tap tempo (shared/midi.js): one sweep of the lamp a beat, within the oscillator's 0.5 to 12 Hz
  tap: (P, beat) => ({ speed: Math.min(12, Math.max(0.5, 1 / beat)) }),
  wasm: { binary: () => new URL('../wasm/lampvibe.wasm', import.meta.url).href },
};
