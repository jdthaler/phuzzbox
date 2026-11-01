// board-tests.mjs — the Pedalboard: its wiring of each pedal's jacks to its neighbours
// (board/src/board-jacks.js) against the rules written out here, and the chain
// (board/src/board-chain.js) against things independent of it: a board of one pedal is that pedal,
// two linear pedals commute and their chain's impulse response is the convolution of theirs, a
// bypassed pedal is a wire; then the physics the wiring brings (a fuzz first or after a buffer),
// and each of the board's hints.

import { readFileSync } from 'node:fs';
import { check, done } from './harness.mjs';
import { wasmEffect } from '../shared/wasm.js';
import { defaults, params } from '../shared/params.js';
import { PEDALS } from '../shared/registry.js';
import { amplitudeAt, db, sine } from '../tools/audio-util.mjs';
import { BOARD_PEDALS, ENCLOSURES } from '../board/src/board-pedals.js';
import { wire, jacks, INPUT, BUFFERED_OUT } from '../board/src/board-jacks.js';
import { Chain, PEAKS } from '../board/src/board-chain.js';
import { PEDAL as BOARD } from '../board/src/board-pedal.js';

const root = new URL('..', import.meta.url);
const fs = 48000;
const B0 = defaults(BOARD.groups);
const Pd = (id, over = {}) => ({ ...defaults(BOARD_PEDALS[id].groups), ...over });
const slot = (id, over, bypass = false) => ({ id, P: Pd(id, over), bypass });

// ---- every pedal can go on the board
{
  const ready = PEDALS.filter((p) => p.ready).map((p) => p.id);
  check(ready.every((id) => BOARD_PEDALS[id]) && Object.keys(BOARD_PEDALS).every((id) => ready.includes(id)), 'the board holds every ready pedal', Object.keys(BOARD_PEDALS).join());
  const bad = ready.filter((id) => {
    const css = readFileSync(new URL(`${id}/style.css`, root), 'utf8');
    const enc = css.match(/--enclosure:\s*(#[0-9a-f]+)/i)?.[1], ink = css.match(/--enclosure-ink:\s*(#[0-9a-f]+)/i)?.[1];
    return !ENCLOSURES[id] || ENCLOSURES[id][0] !== enc || ENCLOSURES[id][1] !== ink;
  });
  check(!bad.length, 'each pedal on the board wears its own page\'s enclosure', bad.join());
  // the pedals with an input impedance of their own are the ones whose circuits include the jack
  const modelled = ready.filter((id) => params(BOARD_PEDALS[id].groups).some((p) => p.id === 'active'));
  check(modelled.every((id) => INPUT[id]) && Object.keys(INPUT).every((id) => modelled.includes(id)), 'every pedal that models its input has an input impedance on the board', modelled.join());
}

// ---- the page: its README is its How it works, the app keeps it offline, the landing page links it
{
  const { renderMarkdown } = await import('../shared/markdown.js');
  const readme = readFileSync(new URL('board/README.md', root), 'utf8');
  check(/^## Prior art and references/m.test(readme) && /^## What is simplified/m.test(readme) && renderMarkdown(readme, { skip: ['Files'] }).html.length > 500,
    'the board\'s README credits prior art, says what is simplified, and renders as its notes');
  check(readFileSync(new URL('sw.js', root), 'utf8').includes("'./board/'") && /rel="manifest"/.test(readFileSync(new URL('board/index.html', root), 'utf8')), 'the app keeps the board\'s page');
  check(/href: 'board\/'/.test(readFileSync(new URL('landing.js', root), 'utf8')) && /id: 'board'/.test(readFileSync(new URL('shared/nav.js', root), 'utf8')), 'the landing page and every pedal\'s menu link the board');
  check(params(BOARD.groups).every((q) => q.hint && (q.type || (q.min < q.max && q.def >= q.min && q.def <= q.max))), 'every board control explains itself, with its default in its range');
}

// ---- the wiring, rule by rule
{
  const B = { ...B0, cable: 5, patch: 0.5, ampCable: 7, ampLoad: 2e6, pickupL: 4.2 };
  let w = wire([slot('phuzz')], B, BOARD_PEDALS);
  check(w[0].P.active === false && w[0].P.cable === 5 && w[0].P.pickupL === 4.2 && w[0].from === 'bass', 'the first pedal feels the bass through the cable from it');
  check(w[0].P.outCable === 7 && w[0].P.load === 2e6 && w[0].to === 'amp', 'the last pedal drives the amp through the cable to it');
  w = wire([slot('opto'), slot('phuzz'), slot('wah')], B, BOARD_PEDALS);
  check(w[1].P.active === true && w[1].P.activeR === BUFFERED_OUT && w[1].P.cable === 0.5 && w[1].from === 0, 'after a pedal, a pedal sees a buffered output through a patch cable');
  check(w[1].P.load === 68e3 && w[1].P.outCable === 0.5 && w[1].to === 2, 'a pedal that drives a load drives the next pedal\'s input (the Wah\'s 68 kΩ)');
  w = wire([slot('opto', {}, true), slot('phuzz'), slot('octave', {}, true), slot('preamp')], B, BOARD_PEDALS);
  check(w[1].P.active === false && w[1].P.cable === 5.5 && w[1].from === 'bass', 'a bypassed pedal is a wire: the bass reaches the next, through both cables');
  check(w[1].P.load === 1e6 && w[1].P.outCable === 1 && w[1].to === 3, 'past a bypassed pedal, the load is the next engaged one\'s (the preamp\'s 1 MΩ grid leak), through both patch cables');
  w = wire([slot('phuzz'), slot('phuzz')], B, BOARD_PEDALS);
  check(w[0].P.load === 10e3, 'a load below the range a pedal\'s Amp\'s input knob has is held at its end (a Phuzz into a Phuzz: 10 kΩ)', `${w[0].P.load}`);
  w = wire([slot('buffer', { load: 47e3 }), slot('wah')], B, BOARD_PEDALS);
  check(w[0].P.load === 47e3 && w[0].P.cable === 5, 'the Buffer keeps its own input impedance; the board sets its cable');
  check(wire([slot('buffer', { load: 47e3 }), slot('phuzz')], B, BOARD_PEDALS)[1].P.active === true, 'a pedal after the Buffer sees its buffered output');
  const J = (id, over) => jacks(BOARD_PEDALS[id], Pd(id, over));
  check(J('phuzz').input && J('phuzz').output && J('preamp').output && J('buffer').input && !J('buffer').output && !J('opto').input && !J('opto').output,
    'the jacks each pedal\'s circuit includes: the Phuzz and the Tube Preamp both, the Buffer its input, the rest neither');
  check(!J('wah').input && !J('wah').output && J('wah', { reversed: true }).input && J('wah', { reversed: true }).output, 'the Wah includes its jacks only plugged in backwards');
}

// ---- the chain in Node, as the worklet runs it
const Effects = {};
for (const [id, D] of Object.entries(BOARD_PEDALS)) { const E = wasmEffect(D); await E.ready(); Effects[id] = E; }
let uid = 0;
function board(list, B = B0) {
  const c = new Chain(Effects, BOARD_PEDALS, fs);
  c.setParams(B);
  c.handle({ type: 'chain', slots: list.map((s) => ({ uid: `u${uid++}`, ...s })) });
  return c;
}
function run(effect, input) {
  const L = new Float32Array(input.length), R = new Float32Array(input.length);
  for (let i = 0; i < input.length; i += 128) effect.process(input.subarray(i, i + 128), L.subarray(i, i + 128), R.subarray(i, i + 128), Math.min(128, input.length - i));
  return L;
}
const alone = (id, P, input) => { const e = new Effects[id](fs); e.setParams(P); const y = run(e, input); e.destroy(); return y; };
const maxDiff = (a, b) => a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0);
const peakOf = (a) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const N = 9600;

// a board of one pedal is the pedal, played with the board's wiring
{
  const x = sine(110, fs, N, 0.2);
  for (const id of ['phuzz', 'preamp', 'echo']) {
    const P = wire([slot(id)], B0, BOARD_PEDALS)[0].P;
    const d = maxDiff(run(board([slot(id)]), x), alone(id, P, x));
    check(d === 0, `a board of one ${BOARD_PEDALS[id].name} plays as the pedal alone`, `${d}`);
  }
}

// two linear pedals: in either order the same, and the convolution of their impulse responses
{
  const imp = new Float32Array(N); imp[0] = 0.01; // 10 mV: small enough that the cone and the tank are linear
  const cab = { drive: 20 }, spr = { dry: 0, reverb: 1 };
  const ab = run(board([slot('cabinet', cab), slot('spring', spr)]), imp), ba = run(board([slot('spring', spr), slot('cabinet', cab)]), imp);
  const hA = alone('cabinet', wire([slot('cabinet', cab)], B0, BOARD_PEDALS)[0].P, imp), hB = alone('spring', Pd('spring', spr), imp);
  const conv = new Float64Array(N);
  for (let i = 0; i < N; i++) { const a = hA[i]; if (a) for (let j = 0; i + j < N; j++) conv[i + j] += a * hB[j]; }
  for (let i = 0; i < N; i++) conv[i] /= 0.01;
  const p = peakOf(ab);
  check(p > 0 && maxDiff(ab, ba) < 1e-3 * p, 'two linear pedals commute: Cabinet → Spring Reverb is Spring Reverb → Cabinet', `${(maxDiff(ab, ba) / p).toExponential(2)} of the peak`);
  check(maxDiff(ab, conv) < 1e-3 * p, 'and the chain\'s impulse response is the convolution of the two pedals\' own', `${(maxDiff(ab, conv) / p).toExponential(2)} of the peak`);
}

// a bypassed pedal is a wire; switching it in crossfades without a step
{
  const x = sine(220, fs, N, 0.3);
  const y = run(board([slot('phuzz', {}, true)]), x);
  check(maxDiff(y, x) === 0, 'a bypassed pedal passes its input untouched');
  const c = board([{ id: 'echo', P: Pd('echo'), bypass: true, uid: 'e' }]);
  const y1 = run(c, x.subarray(0, 4800));
  c.handle({ type: 'chain', slots: [{ uid: 'e', id: 'echo', P: Pd('echo'), bypass: false }] });
  const y2 = run(c, x.subarray(4800));
  let jump = 0;
  for (let i = 1; i < y2.length; i++) jump = Math.max(jump, Math.abs(y2[i] - y2[i - 1]));
  const slope = 0.3 * 2 * Math.PI * 220 / fs;
  check(maxDiff(y1, x.subarray(0, 4800)) === 0 && jump < 1.5 * slope + 1e-3, 'engaging a pedal on the board fades it in with no step', `largest step ${jump.toFixed(4)} V against the sine's ${slope.toFixed(4)}`);
  // the chain posts the voltage at each jack
  const c2 = board([slot('buffer', { level: 6 })]);
  let m = [];
  for (let i = 0; i < 20; i++) { run(c2, x.subarray(0, 128)); m = [...m, ...c2.messages()]; }
  const pk = m.find((q) => q.type === PEAKS)?.values;
  check(pk && Math.abs(pk[0] - 0.3) < 0.01 && pk[1] > 1.8 * pk[0], 'the chain reports the peak volts at its input and after each pedal', pk ? Array.from(pk).map((v) => v.toFixed(3)).join(', ') : 'none');
}

// the physics the wiring brings: first in the chain the Phuzz loads the pickup; after a buffer it
// is driven by a few hundred ohms instead, and hit harder. How much harder follows from the
// pickup's impedance (the Buffer's circuit, written out here) and the Phuzz's input impedance; the
// loss it finds must be more than an input of 10 kΩ would take, for the board holds the Phuzz's
// input at 10 kΩ, the least a pedal's load goes to.
{
  const gain = (list, f) => { const x = sine(f, fs, 2 * N, 2e-5); return db(amplitudeAt(run(board(list), x).subarray(N), f, fs) / 2e-5); };
  // the pickup's circuit (the Buffer's: test/buffer-tests.mjs), as complex impedances
  const c = (re, im = 0) => ({ re, im });
  const add = (a, b) => c(a.re + b.re, a.im + b.im), mul = (a, b) => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const inv = (a) => { const d = a.re * a.re + a.im * a.im; return c(a.re / d, -a.im / d); };
  const par = (...zs) => inv(zs.map(inv).reduce(add)), abs = (a) => Math.hypot(a.re, a.im);
  const B = B0, jack = (f, Zin) => {
    const w = 2 * Math.PI * f, coil = c(B.pickupR, w * B.pickupL);
    const rec = par(coil, inv(c(0, w * (B.pickupC + B.cablePF * B.recCable))), c(B.pots), c(B.recLoad));
    const there = par(coil, inv(c(0, w * (B.pickupC + B.cablePF * B.cable))), c(B.pots), Zin);
    return db(abs(there) / abs(rec)); // the jack's voltage per volt recorded, for the same Norton current
  };
  for (const f of [100, 2000]) {
    const first = gain([slot('phuzz')], f), after = gain([slot('buffer'), slot('phuzz')], f), bound = jack(f, c(10e3));
    check(after - first > -bound && after - first > 10, `after a buffer the Phuzz is hit harder: ${f} Hz`, `${(after - first).toFixed(1)} dB harder; an input of 10 kΩ would lose only ${(-bound).toFixed(1)} dB`);
  }
}

// ---- each of the board's hints
{
  const at = (y, f) => amplitudeAt(y.subarray(N / 2), f, fs);
  const tone = (f, a = 0.05) => sine(f, fs, N, a);
  const play = (list, B, f, a) => at(run(board(list, { ...B0, ...B }), tone(f, a)), f);
  // Cable from the bass
  const buf = (c) => play([slot('buffer')], { cable: c }, 5000);
  check(db(buf(20) / buf(1)) < -2, 'Cable from the bass: into a light input, longer is darker', `5 kHz, 20 m against 1 m: ${db(buf(20) / buf(1)).toFixed(1)} dB`);
  const fz = (c) => play([slot('phuzz')], { cable: c }, 1000, 2e-5); // small enough not to clip
  check(Math.abs(db(fz(10) / fz(1))) < 0.3, 'Cable from the bass: into the Phuzz it hardly matters', `1 kHz, 10 m against 1 m: ${db(fz(10) / fz(1)).toFixed(2)} dB`);
  const late = (c) => play([slot('opto'), slot('buffer')], { cable: c }, 5000);
  check(Math.abs(db(late(30) / late(0.3))) < 0.01, 'Cable from the bass: after a pedal that buffers, it does not matter', `${db(late(30) / late(0.3)).toFixed(4)} dB`);
  // Patch cables
  const pb = (c) => play([slot('opto'), slot('buffer')], { patch: c }, 5000);
  check(Math.abs(db(pb(3) / pb(0.15))) < 0.01, 'Patch cables: from a buffered output, no difference', `${db(pb(3) / pb(0.15)).toFixed(4)} dB`);
  const pz = (c) => play([slot('phuzz', { volume: 0.5 }), slot('opto')], { patch: c }, 5000, 0.01);
  const dz = db(pz(3) / pz(0.15));
  check(dz < -0.05 && dz > -3, 'Patch cables: from the Phuzz turned down, more takes off a little top', `5 kHz, 3 m against 0.15 m: ${dz.toFixed(2)} dB`);
  // Cable to the amp, Amp's input
  const pa = (B) => play([slot('preamp')], B, 3000, 0.02);
  const dc = db(pa({ ampCable: 30 }) / pa({ ampCable: 0.3 }));
  check(dc < -3, 'Cable to the amp: behind the Tube Preamp, 30 m darkens the top by several dB', `3 kHz: ${dc.toFixed(1)} dB`);
  const dl = db(pa({ ampLoad: 10e3 }) / pa({ ampLoad: 1e6 }));
  check(dl < -13 && dl > -19, 'Amp\'s input: into 10 kΩ the Tube Preamp is about 16 dB quieter', `${dl.toFixed(1)} dB`);
}
done();
