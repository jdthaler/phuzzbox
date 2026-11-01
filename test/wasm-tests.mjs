// wasm-tests.mjs — the JavaScript wrapper of a pedal's WebAssembly (shared/wasm.js) and the test
// bass's (shared/testbass.js), as the AudioWorklet calls them: any block length gives the same
// samples, and a 128-sample block allocates nothing (the views into the module's memory are made
// once, and a pedal that posted nothing hands back the same empty list).

import { check, done } from './harness.mjs';
import { loadPedal, loadBass } from '../tools/engine.mjs';
import { defaults } from '../shared/params.js';

const fs = 48000;
const { PEDAL, Effect } = await loadPedal('phuzz');
const D = defaults(PEDAL.groups);
const N = 5000; // not a multiple of 128
const x = new Float32Array(N + 300); // longer than the part processed
for (let i = 0; i < x.length; i++) x[i] = 0.3 * Math.sin((2 * Math.PI * 55 * i) / fs);

// all at once, n < input.length
const a = new Effect(fs); a.setParams(D);
const La = new Float32Array(N), Ra = new Float32Array(N);
a.process(x, La, Ra, N);
// in the worklet's blocks of exactly 128, then the rest one sample at a time
const b = new Effect(fs); b.setParams(D);
const Lb = new Float32Array(N), Rb = new Float32Array(N);
const L1 = new Float32Array(128), R1 = new Float32Array(128);
let at = 0;
for (; at + 128 <= N; at += 128) { b.process(x.slice(at, at + 128), L1, R1); Lb.set(L1, at); Rb.set(R1, at); }
for (; at < N; at++) { const l = new Float32Array(1), r = new Float32Array(1); b.process(x.slice(at, at + 1), l, r); Lb[at] = l[0]; Rb[at] = r[0]; }
check(La.every((v, i) => v === Lb[i]) && Ra.every((v, i) => v === Rb[i]), 'a pedal gives the same samples whatever the blocks (128, 1, or 5000 out of a longer input)');

const views = [b.vin, b.vL, b.vR];
b.process(x.subarray(0, 128), L1, R1);
check(b.vin === views[0] && b.vL === views[1] && b.vR === views[2], 'a 128-sample block reuses the views into the module\'s memory');

// a pedal that posts nothing returns the same (frozen) empty list each block
const { PEDAL: BP, Effect: Buffer } = await loadPedal('buffer');
const q = new Buffer(fs); q.setParams(defaults(BP.groups));
q.process(x.subarray(0, 128), L1, R1);
const m1 = q.messages(), m2 = q.messages();
check(m1.length === 0 && m1 === m2, 'no messages: the same empty list, nothing allocated');

// the test bass: blocks of 128 and of 1 alike
const TestBass = await loadBass();
const s1 = new TestBass(fs), s2 = new TestBass(fs);
s1.note(28, 0.8); s2.note(28, 0.8);
const o1 = new Float32Array(1000), o2 = new Float32Array(1000), blk = new Float32Array(128);
s1.process(o1);
let k = 0;
for (; k + 128 <= 1000; k += 128) { s2.process(blk); o2.set(blk, k); }
for (; k < 1000; k++) { const one = new Float32Array(1); s2.process(one); o2[k] = one[0]; }
check(o1.some((v) => v !== 0) && o1.every((v, i) => v === o2[i]), 'the test bass gives the same samples whatever the blocks');
done();
