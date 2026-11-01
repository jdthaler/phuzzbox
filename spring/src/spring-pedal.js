// spring-pedal.js — the Spring Reverb's descriptor: everything a host needs to run it without its
// page. Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs.

import { GROUPS, PRESETS, KEEP } from './spring-params.js';

export const PEDAL = {
  id: 'spring',
  name: 'Spring Reverb',
  description: 'A reverb tank\'s helical springs from their measured coils and wire: every echo a chirp, from waves that travel slower the higher they are',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  guitar: {}, // the same for a guitar as for a bass
  wasm: { binary: () => new URL('../wasm/spring.wasm', import.meta.url).href },
};
