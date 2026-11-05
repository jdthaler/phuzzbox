// radio-pedal.js — the Crystal Radio's descriptor: everything a host needs to run it without its page.
// Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs (the C++ tables).

import { GROUPS, PRESETS, KEEP } from './radio-params.js';

export const PEDAL = {
  id: 'radio',
  name: 'Crystal Radio',
  description: 'Your bass broadcast as an AM station and received on a crystal set: a tuned coil picks the station, a point-contact diode turns the carrier back into sound, squared when it is weak and straight when it is strong',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  // a guitar: nothing changes (the transmitter's input doesn't load a pickup)
  guitar: {},
  // the parameter an expression pedal moves (shared/midi.js maps MIDI CC 1 to it unless taught)
  expression: 'tuning',
  wasm: { binary: () => new URL('../wasm/radio.wasm', import.meta.url).href },
};
