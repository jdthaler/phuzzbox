// board-chain.js — the Pedalboard's effect: pedals in series, each its own WebAssembly effect,
// wired to its neighbours by board-jacks.js. It has the effect contract (setParams, process,
// messages, latency, setQuality), so shared/worklet.js plays it as it plays one pedal, and Node
// (test/board-tests.mjs) runs it the same way.
//
//   const chain = new Chain(Effects, BOARD_PEDALS, fs)   // Effects: id → wasmEffect class, loaded
//   chain.setParams(B)                                    // the board's own: the bass, the cables
//   chain.handle({ type: 'chain', slots: [{ uid, id, P, bypass }] })   // the pedals, in order
//   chain.handle({ type: 'slot', uid, P })                // one pedal's settings
//
// Between pedals the signal is one voltage, as on a board of mono pedals (every pedal here plays
// mono, its two outputs alike). Each pedal's footswitch is a true bypass, crossfaded over 10 ms
// against its input delayed by the pedal's latency, as the single pedal's page does it; a pedal
// switched fully off is not run, and comes back from rest, as a true-bypass pedal's circuit
// does with nothing at its input. Messages out: every 18 blocks, type 100, the peak volts at
// each jack: the input, then each pedal's output.

import { wire } from './board-jacks.js';

export const MAX_SLOTS = 8;
const FADE = 0.01;
export const PEAKS = 100;
const NONE = Object.freeze([]);

export class Chain {
  constructor(Effects, D, fs) {
    this.Effects = Effects; this.D = D; this.fs = fs;
    this.B = {}; this.slots = []; this.q = 0;
    this.x = new Float32Array(128); this.R = new Float32Array(128);
    this.inPeak = 0; this.blocks = 0; this.out = NONE;
  }
  setParams(B) { Object.assign(this.B, B); this.rewire(); }
  setQuality(q) { this.q = q; for (const s of this.slots) s.effect.setQuality(q); }
  handle(m) {
    if (m.type === 'chain') this.arrange(m.slots);
    else if (m.type === 'slot') { const s = this.slots.find((t) => t.uid === m.uid); if (s) { s.P = { ...s.P, ...m.P }; this.rewire(); } }
  }
  // the pedals, in order: those already on the board keep their state (a reverb's tail, a tape's
  // repeats), new ones are made, removed ones are freed
  arrange(list) {
    const was = new Map(this.slots.map((s) => [s.uid, s]));
    const next = [];
    for (const { uid, id, P, bypass } of list.slice(0, MAX_SLOTS)) {
      if (!this.Effects[id]) continue;
      let s = was.get(uid);
      if (s && s.id !== id) s = null;
      if (s) was.delete(uid);
      else {
        const effect = new this.Effects[id](this.fs);
        effect.setQuality(this.q);
        s = { uid, id, effect, applied: '', wet: bypass ? 0 : 1, dry: new Float32Array(64), at: 0, L: new Float32Array(128), peak: 0 };
      }
      s.P = { ...P };
      s.target = bypass ? 0 : 1;
      next.push(s);
    }
    for (const s of was.values()) s.effect.destroy?.();
    this.slots = next;
    this.rewire();
  }
  // what each pedal plays, its own settings with the board's wiring; set only where it changed
  rewire() {
    const w = wire(this.slots.map((s) => ({ id: s.id, P: s.P, bypass: s.target === 0 })), this.B, this.D);
    this.slots.forEach((s, i) => {
      const k = JSON.stringify(w[i].P);
      if (k !== s.applied) { s.applied = k; s.effect.setParams(w[i].P); }
    });
    this.wiring = w;
  }
  latency() { let n = 0; for (const s of this.slots) if (s.target) n += s.effect.latency(); return n; }
  tail() { let t = 0; for (const s of this.slots) t += s.effect.tail?.() ?? 0; return t; }
  reset() { for (const s of this.slots) s.effect.reset(); }
  process(v, L, R, n = v.length) {
    let ok = true;
    const x = n === 128 ? this.x : this.x.subarray(0, n), r = n === 128 ? this.R : this.R.subarray(0, n);
    x.set(v.subarray(0, n));
    for (let i = 0; i < n; i++) { const a = Math.abs(x[i]); if (a > this.inPeak) this.inPeak = a; }
    const step = 1 / (FADE * this.fs);
    for (const s of this.slots) {
      const off = s.wet === 0 && s.target === 0;
      if (off) { // a wire: its input still runs into the dry line, ready for the crossfade back
        s.rested = true;
        for (let i = 0; i < n; i++) { s.dry[s.at] = x[i]; s.at = (s.at + 1) & 63; }
      } else {
        if (s.rested) { s.effect.reset(); s.rested = false; }
        const y = n === 128 ? s.L : s.L.subarray(0, n);
        if (!s.effect.process(x, y, r, n)) ok = false;
        const delay = Math.min(63, s.effect.latency()), dry = s.dry;
        for (let i = 0; i < n; i++) {
          if (s.wet !== s.target) s.wet = s.target > s.wet ? Math.min(s.target, s.wet + step) : Math.max(s.target, s.wet - step);
          dry[s.at] = x[i];
          const d = dry[(s.at - delay + 64) & 63];
          s.at = (s.at + 1) & 63;
          x[i] = s.wet * y[i] + (1 - s.wet) * d;
        }
        s.effect.messages(); // what a pedal posts for its own page's views: the board shows none
      }
      for (let i = 0; i < n; i++) { const a = Math.abs(x[i]); if (a > s.peak) s.peak = a; }
    }
    L.set(x); R.set(x);
    if (++this.blocks % 18 === 0) {
      const values = Float32Array.from([this.inPeak, ...this.slots.map((s) => s.peak)]);
      this.out = [{ type: PEAKS, values }];
      this.inPeak = 0; for (const s of this.slots) s.peak = 0;
    }
    return ok;
  }
  messages() { const m = this.out; this.out = NONE; return m; }
}
