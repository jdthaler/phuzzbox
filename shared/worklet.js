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
// { type: 'quality', level }, { type: 'mute', on } (silence the output, as a tuner pedal does;
// the tuner still hears the input), { type: 'measure' } (the loopback test: below).
//
// Outputs: 0 is the pedal (stereo, full-scale units, for the speakers); 1 is the input in volts
// (mono, before the pedal and the mute, for the tuner), from the interface or the test bass alike.
// Messages out: { type: 'levels', inPeak, outPeak } in volts (about 20 a second), { type: 'stats',
// load, latency }, { type: 'measured', ms } (null when nothing came back), { type: 'error', message },
// { type: 'pedal', messages: [{ type, values }] } (what the pedal posted for its views: phuzzbox::Message).
//
// The loopback test measures the round trip the player hears: with a cable from the interface's
// output to its input, it listens to the input's noise for 0.2 s, plays a 2 ms click, and counts
// the samples until the click comes back above the noise. Everything in the path is in that count:
// the browser's input and output buffers, the interface's converters, and this processor's block.

import { wasmEffect } from './wasm.js';
import { TestBass } from './testbass.js';

const now = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());
const FADE = 0.01; // s: bypass switches over this long, without a click

export function registerPedal(PEDAL) {
  const Effect = wasmEffect(PEDAL);
  registerEffect((o, fs) => { Effect.load(o.pedal); return new Effect(fs); });
}

// The processor around any effect with the contract (setParams, process, messages, latency,
// setQuality; handle(m) for messages of its own): make(processorOptions, sampleRate) builds it.
// The Pedalboard (board/src/board-chain.js) is one: several pedals in series.
export function registerEffect(make) {
  class PedalProcessor extends AudioWorkletProcessor {
    constructor(options) {
      super();
      const o = options.processorOptions || {};
      TestBass.load(o.bass);
      this.effect = make(o, sampleRate);
      this.bass = new TestBass(sampleRate);
      this.source = 'input';
      this.fullScale = 1;
      this.wet = 1; // 1 engaged, 0 bypassed, moving toward target
      this.target = 1;
      this.v = new Float32Array(128); this.L = new Float32Array(128); this.R = new Float32Array(128);
      // the dry signal, as late as the pedal (its latency: oversampling filters), so the footswitch's
      // crossfade doesn't sum the signal with a copy of itself a few samples apart
      this.dry = new Float32Array(64); this.dryAt = 0; this.dryDelay = 0;
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
          case 'mute': this.mute = !!m.on; break;
          case 'measure': this.measure = { t: 0, floor: 0, sentAt: -1 }; break;
          default: this.effect.handle?.(m);
        }
      } catch (err) { this.port.postMessage({ type: 'error', message: err.message }); }
    }
    loopback(inp, out, n) {
      const M = this.measure, quiet = Math.round(0.2 * sampleRate), click = Math.round(0.002 * sampleRate);
      for (let i = 0; i < n; i++, M.t++) {
        const x = inp ? Math.abs(inp[i]) : 0;
        let y = 0;
        if (M.t < quiet) M.floor = Math.max(M.floor, x);
        else if (M.sentAt < 0 || M.t - M.sentAt < click) {
          if (M.sentAt < 0) M.sentAt = M.t;
          y = 0.3 * Math.sin((2 * Math.PI * 1000 * (M.t - M.sentAt)) / sampleRate);
        } else if (x > Math.max(0.01, 6 * M.floor)) {
          this.port.postMessage({ type: 'measured', ms: (1000 * (M.t - M.sentAt)) / sampleRate });
          this.measure = null;
        } else if (M.t - M.sentAt > sampleRate) {
          this.port.postMessage({ type: 'measured', ms: null });
          this.measure = null;
        }
        out[0][i] = y;
        if (out[1]) out[1][i] = y;
        if (!this.measure) { for (let j = i + 1; j < n; j++) { out[0][j] = 0; if (out[1]) out[1][j] = 0; } break; }
      }
    }
    process(inputs, outputs) {
      const out = outputs[0];
      if (!out?.length) return true;
      const n = out[0].length;
      // the render quantum is 128 samples: whole buffers then, and nothing allocated per block
      const v = n === 128 ? this.v : this.v.subarray(0, n), L = n === 128 ? this.L : this.L.subarray(0, n), R = n === 128 ? this.R : this.R.subarray(0, n);
      if (this.measure) { this.loopback(inputs[0]?.[0], out, n); return true; }
      const t0 = now();
      if (this.source === 'bass') this.bass.process(v, n);
      else {
        const inp = inputs[0]?.[0];
        if (inp) for (let i = 0; i < n; i++) v[i] = inp[i] * this.fullScale; else v.fill(0);
      }
      outputs[1]?.[0]?.set(v);
      if (!this.effect.process(v, L, R, n)) {
        const t = now();
        if (t - this.lastError > 1000) { this.lastError = t; this.port.postMessage({ type: 'error', message: 'The pedal went numerically unstable at these settings and was reset.' }); }
      }
      const posted = this.effect.messages();
      if (posted.length) this.port.postMessage({ type: 'pedal', messages: posted });
      const step = 1 / (FADE * sampleRate), k = 1 / this.fullScale, oL = out[0], oR = out[1];
      const dry = this.dry, delay = Math.min(63, this.effect.latency());
      for (let i = 0; i < n; i++) {
        if (this.wet !== this.target) this.wet = this.target > this.wet ? Math.min(this.target, this.wet + step) : Math.max(this.target, this.wet - step);
        const a = Math.abs(v[i]);
        if (a > this.inPeak) this.inPeak = a;
        dry[this.dryAt] = v[i];
        const d = dry[(this.dryAt - delay + 64) & 63];
        this.dryAt = (this.dryAt + 1) & 63;
        const l = this.wet * L[i] + (1 - this.wet) * d, r = this.wet * R[i] + (1 - this.wet) * d;
        const b = Math.max(Math.abs(l), Math.abs(r));
        if (b > this.outPeak) this.outPeak = b;
        oL[i] = l * k;
        if (oR) oR[i] = r * k;
      }
      if (this.mute) { oL.fill(0); oR?.fill(0); }
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
