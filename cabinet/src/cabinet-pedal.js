// cabinet-pedal.js — the Speaker Cabinet's descriptor: everything a host needs to run it without
// its page. Imported by the page, the Node tests and tools, and tools/gen-native-params.mjs.

import { GROUPS, PRESETS, KEEP } from './cabinet-params.js';

export const PEDAL = {
  id: 'cabinet',
  name: 'Cabinet',
  description: 'Bass speaker cabinets from their Thiele–Small parameters: cones on their suspensions, the air in a sealed or ported box, heard by a microphone',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
  wasm: { binary: () => new URL('../wasm/cabinet.wasm', import.meta.url).href },
};
