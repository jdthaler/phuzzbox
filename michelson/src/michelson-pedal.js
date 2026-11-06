// michelson-pedal.js — the Michelson Interferometer's descriptor: everything a host needs to run it
// without its page. Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs.

import { GROUPS, PRESETS, KEEP } from './michelson-params.js';

export const PEDAL = {
  id: 'michelson',
  name: 'Michelson Interferometer',
  description: 'An interferometer whose mirror your bass moves: the light\'s fringes sweep past a photodiode and fold the wave, a wavelength at a time',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  // a guitar: nothing changes (the actuator's amplifier barely loads a pickup)
  guitar: {},
  wasm: { binary: () => new URL('../wasm/michelson.wasm', import.meta.url).href },
};
