// loudness.mjs — how much louder or quieter each pedal is engaged than bypassed, at its defaults,
// as Forte's tool measures its instruments. The test bass plays the page's riff (shared/testbass.js)
// for six seconds; the pedal's output and the dry riff are each measured as integrated loudness by
// ITU-R BS.1770 (K-weighting, 400 ms blocks overlapping by 75 %, the −70 LUFS absolute and −10 LU
// relative gates), and the difference is the jump the footswitch makes. Each pedal's level knob
// (KNOB: its Level, or the output pot its circuit has) defaults to where that jump is under
// TOLERANCE; test/level-tests.mjs keeps it there.
//
// Usage: node tools/loudness.mjs   (prints the table, and the knob's default that would make each
//                                   pedal as loud as bypass)

import { RIFF, RIFF_BPM } from '../shared/testbass.js';
import { defaults, params } from '../shared/params.js';
import { PEDALS } from '../shared/registry.js';
import { loadPedal, loadBass } from './engine.mjs';

export const FS = 48000, SECONDS = 6, TOLERANCE = 1; // dB
// the knob that sets each pedal's output: its Level, or the circuit's own output control
export const KNOB = { phuzz: 'volume', preamp: 'master', opto: 'gain', cabinet: 'mic' };
export const knobOf = (id) => KNOB[id] ?? 'level';

// The riff on the test bass, as the page plays it (at the computer keys' velocity), in volts.
export async function riff(seconds = SECONDS) {
  const TB = await loadBass(), b = new TB(FS), x = new Float32Array(seconds * FS), beat = 60 / RIFF_BPM;
  const marks = [];
  for (let t = 0, i = 0; t < seconds - 0.5; i++) {
    const [k, d] = RIFF[i % RIFF.length];
    if (k) marks.push([t, () => b.note(k, 0.7)], [t + 0.85 * d * beat, () => b.noteOff(k)]);
    t += d * beat;
  }
  marks.sort((a, c) => a[0] - c[0]);
  let at = 0;
  for (const [time, fn] of marks) { const n = Math.round(time * FS); if (n > at) { b.process(x.subarray(at, n)); at = n; } fn(); }
  b.process(x.subarray(at));
  return x;
}

function biquad(x, b, a) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
// BS.1770's K-weighting at 48 kHz, its own coefficients: a high shelf (the head), then a high-pass
const kWeight = (x) => biquad(biquad(x, [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]),
  [1, -2, 1], [1, -1.99004745483398, 0.99007225036621]);
// Integrated loudness of channels at 48 kHz, in LUFS (full scale 1, here a volt).
export function lufs(channels) {
  const k = channels.map(kWeight), W = Math.round(0.4 * FS), hop = Math.round(0.1 * FS), z = [];
  for (let s = 0; s + W <= k[0].length; s += hop) {
    let e = 0;
    for (const c of k) for (let i = s; i < s + W; i++) e += c[i] * c[i];
    z.push(e / W);
  }
  const L = (p) => -0.691 + 10 * Math.log10(p + 1e-30), mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const loud = z.filter((p) => L(p) > -70);
  if (!loud.length) return -Infinity;
  const gate = L(mean(loud)) - 10;
  return L(mean(loud.filter((p) => L(p) > gate)));
}

// The jump in dB from bypassed to engaged, for one pedal at the values P (its defaults if none).
export async function jump(id, P, dry) {
  dry ??= await riff();
  const { PEDAL, Effect } = await loadPedal(id);
  const e = new Effect(FS);
  e.setParams({ ...defaults(PEDAL.groups), ...P });
  const L = new Float32Array(dry.length), R = new Float32Array(dry.length);
  e.process(dry, L, R);
  return lufs([L, R]) - lufs([dry, dry]);
}

// The knob's value, to its step or decimals, that makes the pedal as loud as bypass (bisection:
// every output knob turns the level up as it turns clockwise).
export async function match(id, dry) {
  dry ??= await riff();
  const { PEDAL } = await loadPedal(id);
  const p = params(PEDAL.groups).find((q) => q.id === knobOf(id));
  let lo = p.min, hi = p.max;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (await jump(id, { [p.id]: m }, dry) > 0) hi = m; else lo = m; }
  const q = 10 ** (p.decimals ?? 1) * (p.scale ?? 1);
  return { param: p, value: Math.round(((lo + hi) / 2) * q) / q };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dry = await riff();
  console.log(`the riff dry: ${lufs([dry, dry]).toFixed(1)} LUFS (a volt as full scale)\n`);
  console.log('pedal          knob       default   engaged − bypassed   default for 0 dB');
  for (const { id } of PEDALS.filter((p) => p.ready)) {
    const d = await jump(id, {}, dry), { param, value } = await match(id, dry);
    const show = (v) => `${+(v * (param.scale ?? 1)).toFixed(param.decimals ?? 1)} ${param.unit ?? ''}`.trim();
    console.log(`${id.padEnd(14)} ${param.id.padEnd(10)} ${show(param.def).padEnd(9)} ${`${d >= 0 ? '+' : ''}${d.toFixed(1)} dB`.padStart(10)}${Math.abs(d) > TOLERANCE ? ' !' : '  '}         ${show(value)}`);
  }
}
