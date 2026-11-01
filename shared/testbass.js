// testbass.js — the test bass (testbass/README.md, native/sources/testbass) in JavaScript: a page's
// worklet, the tests and the demo renderers play it as a signal source.
//   await TestBass.ready(); const b = new TestBass(48000);
//   b.note(40, 0.8); b.process(out, n); b.noteOff(40);

import { instantiate, instantiateAsync } from './wasm.js';

let x = null;
export const TESTBASS_URL = () => new URL('../testbass/wasm/testbass.wasm', import.meta.url).href;
// An original two-bar line to hear a pedal with when nothing is plugged in, at 96 beats a minute:
// [key, beats], key 0 a rest. Play a riff loops it; the guided tours (shared/tour.js) play it too.
export const RIFF = [[28, 0.5], [28, 0.5], [40, 0.5], [28, 0.5], [31, 0.5], [33, 0.5], [0, 0.5], [35, 0.5],
  [28, 0.5], [28, 0.5], [38, 0.5], [40, 0.25], [38, 0.25], [35, 0.5], [33, 0.5], [31, 1]];
export const RIFF_BPM = 96;

export class TestBass {
  static async ready() { x ??= await instantiateAsync(TESTBASS_URL()); return x; }
  static load(bytes) { x ??= instantiate(bytes); return x; }
  static get exports() { return x; }
  static inharmonicity(string, length) { return x.tb_inharmonicity(string, length); }
  // The open strings' MIDI keys: E1 A1 D2 G2
  static OPEN = [28, 33, 38, 43];
  static SETTINGS = { pluckAt: 0, pickupAt: 1, cable: 2, load: 3, active: 4, inductance: 5, resistance: 6, volts: 7 };

  constructor(fs) { this.fs = fs; this.h = x.tb_create(fs); }
  pluck(string, fret, velocity = 0.7) { x.tb_pluck(this.h, string, fret, velocity); }
  mute(string) { x.tb_mute(this.h, string); }
  note(key, velocity = 0.7) { return x.tb_note(this.h, key, velocity); }
  noteOff(key) { x.tb_note_off(this.h, key); }
  set(name, value) { x.tb_set(this.h, TestBass.SETTINGS[name], value); }
  partials(string, fret) {
    const n = x.tb_partials(this.h, string, fret, this.fs), a = new Float64Array(x.memory.buffer, x.tb_scratch(), 3 * n);
    return Array.from({ length: n }, (_, i) => ({ f: a[3 * i], sigma: a[3 * i + 1], amp: a[3 * i + 2] }));
  }
  process(out, n = out.length) {
    for (let at = 0; at < n; at += 128) {
      const m = Math.min(128, n - at);
      x.tb_process(this.h, m);
      out.set(new Float32Array(x.memory.buffer, x.tb_out(this.h), m), at);
    }
  }
  destroy() { x.tb_destroy(this.h); this.h = 0; }
}
