// worklet.js — the AudioWorklet processor every pedal page uses. A pedal's own worklet module
// (<slug>/src/<slug>-worklet.js) imports its descriptor and calls registerPedal(PEDAL); the page
// creates
//   new AudioWorkletNode(ctx, 'phuzzbox', { processorOptions: { pedal: bytes, bass: bytes }, … })
// with the bytes of the pedal's and the test bass's WebAssembly.
//
// Signal: the input is the interface's (one channel, as floats where 1.0 is the interface's full
// scale), turned into volts by the calibration the page sets (fullScale: the volts of a full-scale
// input), or the test bass, which plays in volts. The pedal works in volts; its output goes back
// to floats by the same calibration, so a pedal at unity leaves the level alone.
//
// Messages in: { type: 'params', P }, { type: 'bypass', on }, { type: 'source', which: 'input' |
// 'bass' }, { type: 'fullScale', volts }, { type: 'note', key, velocity }, { type: 'noteOff', key },
// { type: 'quality', level }.
// Messages out: { type: 'levels', inPeak, outPeak } in volts (about 20 a second), { type: 'stats',
// load, latency }, { type: 'error', message }.

import { wasmEffect } from './wasm.js';
import { TestBass } from './testbass.js';

const now = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());
const FADE = 0.01; // s: bypass switches over this long, without a click

export function registerPedal(PEDAL) {
  const Effect = wasmEffect(PEDAL);
  class PedalProcessor extends AudioWorkletProcessor {
    constructor(options) {
      super();
      const o = options.processorOptions || {};
      Effect.load(o.pedal);
      TestBass.load(o.bass);
      this.effect = new Effect(sampleRate);
      this.bass = new TestBass(sampleRate);
      this.source = 'input';
      this.fullScale = 1;
      this.wet = 1; // 1 engaged, 0 bypassed, moving toward target
      this.target = 1;
      this.v = new Float32Array(128); this.L = new Float32Array(128); this.R = new Float32Array(128);
      this.inPeak = 0; this.outPeak = 0; this.blocks = 0; this.busy = 0; this.lastError = -Infinity;
      this.port.onmessage = (e) => this.handle(e.data);
    }
    handle(m) {
      try {
        switch (m.type) {
          case 'params': this.effect.setParams(m.P); break;
          case 'bypass': this.target = m.on ? 0 : 1; break;
          case 'source': this.source = m.which; break;
          case 'fullScale': this.fullScale = m.volts; break;
          case 'note': this.bass.note(m.key, m.velocity ?? 0.7); break;
          case 'noteOff': this.bass.noteOff(m.key); break;
          case 'quality': this.effect.setQuality(m.level); break;
        }
      } catch (err) { this.port.postMessage({ type: 'error', message: err.message }); }
    }
    process(inputs, outputs) {
      const out = outputs[0];
      if (!out?.length) return true;
      const n = out[0].length, v = this.v.subarray(0, n), L = this.L.subarray(0, n), R = this.R.subarray(0, n);
      const t0 = now();
      if (this.source === 'bass') this.bass.process(v, n);
      else {
        const inp = inputs[0]?.[0];
        if (inp) for (let i = 0; i < n; i++) v[i] = inp[i] * this.fullScale; else v.fill(0);
      }
      if (!this.effect.process(v, L, R, n)) {
        const t = now();
        if (t - this.lastError > 1000) { this.lastError = t; this.port.postMessage({ type: 'error', message: 'The pedal went numerically unstable at these settings and was reset.' }); }
      }
      const step = 1 / (FADE * sampleRate), k = 1 / this.fullScale, oL = out[0], oR = out[1];
      for (let i = 0; i < n; i++) {
        if (this.wet !== this.target) this.wet = this.target > this.wet ? Math.min(this.target, this.wet + step) : Math.max(this.target, this.wet - step);
        const a = Math.abs(v[i]);
        if (a > this.inPeak) this.inPeak = a;
        const l = this.wet * L[i] + (1 - this.wet) * v[i], r = this.wet * R[i] + (1 - this.wet) * v[i];
        const b = Math.max(Math.abs(l), Math.abs(r));
        if (b > this.outPeak) this.outPeak = b;
        oL[i] = l * k;
        if (oR) oR[i] = r * k;
      }
      this.busy += now() - t0;
      if (++this.blocks % 18 === 0) {
        this.port.postMessage({ type: 'levels', inPeak: this.inPeak, outPeak: this.outPeak });
        this.inPeak = this.outPeak = 0;
      }
      if (this.blocks >= 360) {
        this.port.postMessage({ type: 'stats', load: this.busy / ((this.blocks * n * 1000) / sampleRate), latency: this.effect.latency() });
        this.blocks = 0; this.busy = 0;
      }
      return true;
    }
  }
  registerProcessor('phuzzbox', PedalProcessor);
}
