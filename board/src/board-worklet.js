// board-worklet.js — the Pedalboard's AudioWorklet module: shared/worklet.js around a chain of
// pedals (board-chain.js). The page sends every pedal's WebAssembly at the start
// (processorOptions.pedals: id → bytes), about half a megabyte in all.
import { registerEffect } from '../../shared/worklet.js';
import { wasmEffect } from '../../shared/wasm.js';
import { BOARD_PEDALS } from './board-pedals.js';
import { Chain } from './board-chain.js';

registerEffect((o, fs) => {
  const Effects = {};
  for (const [id, D] of Object.entries(BOARD_PEDALS)) {
    if (!o.pedals?.[id]) continue;
    const E = wasmEffect(D);
    E.load(o.pedals[id]);
    Effects[id] = E;
  }
  return new Chain(Effects, BOARD_PEDALS, fs);
});
