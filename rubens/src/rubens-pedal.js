// rubens-pedal.js — Rubens' Tube's descriptor: everything a host needs to run it without its page.
// Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs (the C++ tables).

import { GROUPS, PRESETS, KEEP } from './rubens-params.js';

export const PEDAL = {
  id: 'rubens',
  name: 'Rubens\' Tube',
  description: 'Your bass through a loudspeaker into a closed pipe of propane, heard by a microphone inside: the pipe\'s resonances, damped by its walls and by the speaker, and the standing waves that shape the flames along its top',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  // a guitar: nothing changes
  guitar: {},
  // the parameter an expression pedal moves (shared/midi.js maps MIDI CC 1 to it unless taught)
  expression: 'mic',
  wasm: { binary: () => new URL('../wasm/rubens.wasm', import.meta.url).href },
};
