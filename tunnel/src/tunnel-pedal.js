// tunnel-pedal.js — the Tunnel Diode's descriptor: everything a host needs to run it without its page.
// Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs (the C++ tables).

import { GROUPS, PRESETS, KEEP } from './tunnel-params.js';

export const PEDAL = {
  id: 'tunnel',
  name: 'Tunnel Diode',
  description: 'Esaki\'s tunnel diode, whose current falls as its voltage rises: with a load resistor a switch with memory that turns your bass into a square wave, or with an inductor a relaxation oscillator your bass plays',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  // a guitar: nothing changes (the source is a buffer: it doesn't load a pickup)
  guitar: {},
  // the parameter an expression pedal moves (shared/midi.js maps MIDI CC 1 to it unless taught)
  expression: 'bias',
  wasm: { binary: () => new URL('../wasm/tunnel.wasm', import.meta.url).href },
};
