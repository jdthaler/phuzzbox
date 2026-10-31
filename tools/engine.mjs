// engine.mjs — a pedal's effect class and the test bass in Node, for the tests and tools.
import { wasmEffect } from '../shared/wasm.js';
import { TestBass } from '../shared/testbass.js';

export async function loadPedal(slug) {
  const { PEDAL } = await import(`../${slug}/src/${slug}-pedal.js`);
  const E = wasmEffect(PEDAL);
  await E.ready();
  return { PEDAL, Effect: E };
}
export async function loadBass() { await TestBass.ready(); return TestBass; }
