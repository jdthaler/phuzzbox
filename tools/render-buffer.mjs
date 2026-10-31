// render-buffer.mjs — the Buffer's demos: the test bass's riff as plugged in, then through each
// preset, to examples/buffer/NN-name.wav (git-ignored).
//   node tools/render-buffer.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadPedal, loadBass } from './engine.mjs';
import { defaults } from '../shared/params.js';
import { wav } from './audio-util.mjs';

const fs = 48000, out = fileURLToPath(new URL('../examples/buffer/', import.meta.url));
mkdirSync(out, { recursive: true });
const { PEDAL, Effect } = await loadPedal('buffer');
const TB = await loadBass();
const RIFF = [[28, 0.5], [28, 0.5], [40, 0.5], [28, 0.5], [31, 0.5], [33, 0.5], [0, 0.5], [35, 0.5],
  [28, 0.5], [28, 0.5], [38, 0.5], [40, 0.25], [38, 0.25], [35, 0.5], [33, 0.5], [31, 1]];

function riff(seconds = 5, bpm = 96) {
  const b = new TB(fs), x = new Float32Array(seconds * fs), beat = 60 / bpm;
  let t = 0, i = 0;
  const events = [];
  while (t < seconds - 0.5) { const [k, d] = RIFF[i++ % RIFF.length]; if (k) events.push([t, k, t + 0.85 * d * beat]); t += d * beat; }
  const marks = events.flatMap(([on, k, off]) => [[on, () => b.note(k, 0.7)], [off, () => b.noteOff(k)]]).sort((a, c) => a[0] - c[0]);
  let at = 0;
  for (const [time, fn] of marks) { const n = Math.round(time * fs); if (n > at) { b.process(x.subarray(at, n)); at = n; } fn(); }
  b.process(x.subarray(at));
  return x;
}

const dry = riff();
const names = Object.keys(PEDAL.presets);
names.forEach((name, i) => {
  const e = new Effect(fs);
  e.setParams({ ...defaults(PEDAL.groups), ...PEDAL.presets[name] });
  const L = new Float32Array(dry.length), R = new Float32Array(dry.length);
  e.process(dry, L, R);
  const file = `${String(i + 1).padStart(2, '0')}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.wav`;
  writeFileSync(out + file, wav(L, fs));
  console.log(`wrote examples/buffer/${file}`);
});
