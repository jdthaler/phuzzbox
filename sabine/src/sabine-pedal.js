// sabine-pedal.js — Sabine's Room's descriptor: everything a host needs to run it without its page.
// Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs (the C++ tables).

import { GROUPS, PRESETS, KEEP } from './sabine-params.js';

export const PEDAL = {
  id: 'sabine',
  name: 'Sabine\'s Room',
  description: 'Your bass in a room you build: its early reflections by Allen and Berkley\'s image method, its reverberation dying away octave by octave in Eyring\'s time, from the room\'s size, its walls, its audience and its air',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  // a guitar: nothing changes
  guitar: {},
  // the parameter an expression pedal moves (shared/midi.js maps MIDI CC 1 to it unless taught)
  expression: 'distance',
  wasm: { binary: () => new URL('../wasm/sabine.wasm', import.meta.url).href },
};
