// wasm.js — a pedal's WebAssembly build (native/) in JavaScript: loading it in a page, an
// AudioWorklet or Node, and a class with the effect contract over the C functions of
// native/web/effect-api.cpp. After Forte's shared/wasm.js.
//
//   export const BufferEffect = wasmEffect(PEDAL);      // the descriptor (<slug>/src/<slug>-pedal.js)
//   await BufferEffect.ready();                         // page and Node: fetch or read the .wasm
//   BufferEffect.load(bytes);                           // AudioWorklet: from the bytes the page sends
//   const e = new BufferEffect(sampleRate);
//   e.setParams(P); e.process(input, L, R, n);

import { params, nativeValue } from './params.js';

export const QUALITY_LEVELS = ['high', 'medium', 'low'];

const isNode = typeof process !== 'undefined' && !!process.versions?.node && typeof window === 'undefined';

export function instantiate(bytes) {
  const module = new WebAssembly.Module(bytes);
  const instance = new WebAssembly.Instance(module, stubs(module));
  instance.exports._initialize?.();
  return instance.exports;
}
export async function fetchBytes(url) {
  if (isNode) return (await import('node:fs')).readFileSync(new URL(url));
  return await (await fetch(url)).arrayBuffer();
}
export async function instantiateAsync(url) {
  const module = await WebAssembly.compile(await fetchBytes(url));
  const instance = await WebAssembly.instantiate(module, stubs(module));
  instance.exports._initialize?.();
  return instance.exports;
}
function stubs(module) {
  const imports = {};
  for (const { module: m, name, kind } of WebAssembly.Module.imports(module)) {
    if (kind !== 'function') throw new Error(`the WebAssembly imports ${m}.${name} (${kind})`);
    (imports[m] ??= {})[name] = () => 0;
  }
  return imports;
}

// an ASCII C string (an AudioWorklet may have no TextDecoder)
const cString = (x, p) => { const b = new Uint8Array(x.memory.buffer); let s = ''; while (b[p]) s += String.fromCharCode(b[p++]); return s; };

// A model function's arguments and results go through a scratch area in the module's memory.
export function scratch(exports, at = exports.px_scratch()) {
  return { at, f64: (n, offset = 0) => new Float64Array(exports.memory.buffer, at + offset, n) };
}

export function wasmEffect(PEDAL) {
  const ps = params(PEDAL.groups);
  let x = null;
  const check = (exports) => { // a stale build would set the wrong parameters: refuse it
    const ids = Array.from({ length: exports.px_param_count() }, (_, i) => cString(exports, exports.px_param_id(i)));
    if (ids.join() !== ps.map((p) => p.id).join()) throw new Error(`${PEDAL.id}: the WebAssembly's parameters (${ids}) are not the descriptor's; rebuild it`);
    return exports;
  };
  class WasmEffect {
    static async ready() { x ??= check(await instantiateAsync(PEDAL.wasm.binary())); return x; }
    static load(bytes) { x ??= check(instantiate(bytes)); return x; }
    static get exports() { return x; }
    // P as the native code has it, in the descriptor's order
    static native(P) { return ps.map((p) => nativeValue(p, p.id in P ? P[p.id] : p.def)); }

    constructor(fs) {
      if (!x) throw new Error(`${PEDAL.id}: the WebAssembly is not loaded (await ready() or load(bytes))`);
      this.fs = fs;
      this.h = x.px_create(fs);
      this.failed = 0;
    }
    setParams(P) {
      const a = new Float64Array(x.memory.buffer, x.px_params(this.h), ps.length);
      ps.forEach((p, i) => { if (p.id in P) a[i] = nativeValue(p, P[p.id]); });
      x.px_set_params(this.h);
    }
    reset() { x.px_reset(this.h); }
    latency() { return x.px_latency(this.h); }
    tail() { return x.px_tail(this.h); }
    setQuality(q) { x.px_set_quality(this.h, typeof q === 'number' ? q : Math.max(0, QUALITY_LEVELS.indexOf(q))); }
    // input: n samples (Float32Array); L, R: where the output goes. Returns false if a block went
    // unstable (it came out as silence, and the effect was reset).
    process(input, L, R, n = input.length) {
      let ok = true;
      for (let at = 0; at < n; at += 128) {
        const m = Math.min(128, n - at);
        new Float32Array(x.memory.buffer, x.px_input(this.h), m).set(input.subarray(at, at + m));
        if (!x.px_process(this.h, m)) { ok = false; this.failed++; }
        L.set(new Float32Array(x.memory.buffer, x.px_left(this.h), m), at);
        R.set(new Float32Array(x.memory.buffer, x.px_right(this.h), m), at);
      }
      return ok;
    }
    destroy() { x.px_destroy(this.h); this.h = 0; }
  }
  Object.defineProperty(WasmEffect, 'name', { value: `${PEDAL.name.replace(/\W/g, '')}Effect` });
  return WasmEffect;
}
