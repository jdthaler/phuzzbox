// cabinet-pedal.js — the Speaker Cabinet's descriptor: everything a host needs to run it without
// its page. Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs.

import { GROUPS, PRESETS, KEEP, GUITAR } from './cabinet-params.js';

export const PEDAL = {
  id: 'cabinet',
  name: 'Cabinet',
  description: 'Speaker cabinets from their Thiele–Small parameters: cones on their suspensions, the air in a sealed or ported box, heard by a microphone',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  // a guitar: a closed-back 4 × 12 of guitar drivers on a tube amp
  guitar: GUITAR,
  wasm: { binary: () => new URL('../wasm/cabinet.wasm', import.meta.url).href },
};
