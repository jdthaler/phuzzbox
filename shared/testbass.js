// testbass.js — the test bass and the test guitar (testbass/README.md, testguitar/README.md,
// native/sources/testbass) in JavaScript: a page's worklet, the tests and the demo renderers play
// them as a signal source.
//   await TestBass.ready(); const b = new TestBass(48000);           (the bass; 'guitar' for the guitar)
//   b.note(40, 0.8); b.process(out, n); b.noteOff(40); b.use('guitar');

import { instantiate, instantiateAsync } from './wasm.js';
import { RIFFS } from './instruments.js';

let x = null;
export const TESTBASS_URL = () => new URL('../testbass/wasm/testbass.wasm', import.meta.url).href;
// An original two-bar line to hear a pedal with when nothing is plugged in, at 96 beats a minute:
// [key, beats], key 0 a rest. Play a riff loops it; the guided tours (shared/tour.js) play it too,
// on the bass. The guitar's is the same line an octave up (shared/instruments.js).
export const RIFF = RIFFS.bass;
export const RIFF_BPM = 96;
const KINDS = { bass: 0, guitar: 1 };

export class TestBass {
  static async ready() { x ??= await instantiateAsync(TESTBASS_URL()); return x; }
  static load(bytes) { x ??= instantiate(bytes); return x; }
  static get exports() { return x; }
  static inharmonicity(string, length, kind = 'bass') { return x.tb_inharmonicity(KINDS[kind] ?? 0, string, length); }
  // The open strings' MIDI keys: E1 A1 D2 G2; the guitar's E2 A2 D3 G3 B3 E4
  static OPEN = [28, 33, 38, 43];
  static GUITAR_OPEN = [40, 45, 50, 55, 59, 64];
  static SETTINGS = { pluckAt: 0, pickupAt: 1, cable: 2, load: 3, active: 4, inductance: 5, resistance: 6, volts: 7,
    scale: 8, strings: 9, capacitance: 10, pots: 11, pull: 12, width: 13, aperture: 14 };

  constructor(fs, kind = 'bass') { this.fs = fs; this.h = x.tb_create(fs); this.kind = 'bass'; if (kind !== 'bass') this.use(kind); }
  // become the test bass or the test guitar, as built (what was ringing stops)
  use(kind) { if (!(kind in KINDS)) return; this.kind = kind; x.tb_use(this.h, KINDS[kind]); }
  get(name) { return x.tb_get(this.h, TestBass.SETTINGS[name]); }
  pluck(string, fret, velocity = 0.7) { x.tb_pluck(this.h, string, fret, velocity); }
  mute(string) { x.tb_mute(this.h, string); }
  note(key, velocity = 0.7) { return x.tb_note(this.h, key, velocity); }
  noteOff(key) { x.tb_note_off(this.h, key); }
  set(name, value) { x.tb_set(this.h, TestBass.SETTINGS[name], value); }
  partials(string, fret) {
    const n = x.tb_partials(this.h, string, fret, this.fs), a = new Float64Array(x.memory.buffer, x.tb_scratch(), 3 * n);
    return Array.from({ length: n }, (_, i) => ({ f: a[3 * i], sigma: a[3 * i + 1], amp: a[3 * i + 2] }));
  }
  // out: n samples. The view of the module's output is made once (again only if the memory grew),
  // so an AudioWorklet's block allocates nothing.
  process(out, n = out.length) {
    for (let at = 0; at < n; at += 128) {
      const m = Math.min(128, n - at);
      x.tb_process(this.h, m);
      if (this.mem !== x.memory.buffer) { this.mem = x.memory.buffer; this.view = new Float32Array(this.mem, x.tb_out(this.h), 128); }
      if (m === 128) out.set(this.view, at);
      else for (let i = 0; i < m; i++) out[at + i] = this.view[i];
    }
  }
  destroy() { x.tb_destroy(this.h); this.h = 0; }
}
