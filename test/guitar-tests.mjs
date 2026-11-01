// guitar-tests.mjs — every pedal on a guitar: each descriptor says what it changes for one (its
// `guitar` values, shared/instruments.js), those values are its own parameters and in range, the
// pickup is the test guitar's, and the pedals whose ranges were built for a bass do on the test
// guitar what their READMEs say a guitar's range needs. Then the tuner over a guitar's range,
// against tones whose frequencies are known in closed form.

import { check, done } from './harness.mjs';
import { loadPedal, loadBass } from '../tools/engine.mjs';
import { params, defaults } from '../shared/params.js';
import { PEDALS } from '../shared/registry.js';
import { INSTRUMENTS, GUITAR_PICKUP, RIFFS, paramsKey, instrumentDefaults } from '../shared/instruments.js';
import { tune } from '../shared/tuner.js';
import { closedBox } from './cabinet-circuit.mjs';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const fs = 48000;
const TB = await loadBass();
const et = (key) => 440 * 2 ** ((key - 69) / 12);
const cents = (a, b) => 1200 * Math.log2(a / b);

// 1. every pedal (and the Pedalboard) says what changes for a guitar, if anything, and it is its own
// parameters, in range
const descriptors = [];
for (const p of [...PEDALS.filter((q) => q.ready), { id: 'board', name: 'Pedalboard' }]) {
  const { PEDAL } = await import(`../${p.id}/src/${p.id}-pedal.js`);
  descriptors.push(PEDAL);
  const all = params(PEDAL.groups), bad = [];
  if (!PEDAL.guitar || typeof PEDAL.guitar !== 'object') { check(false, `${p.name}: says what changes for a guitar (its descriptor's \`guitar\`, {} for nothing)`); continue; }
  for (const [id, v] of Object.entries(PEDAL.guitar)) {
    const q = all.find((r) => r.id === id);
    if (!q) bad.push(`${id} is not a parameter`);
    else if (q.type === 'select' ? !q.options.some(([o]) => o === v) : q.type === 'checkbox' ? typeof v !== 'boolean' : !(v >= q.min && v <= q.max)) bad.push(`${id} = ${v} is out of range`);
  }
  const pickup = all.some((q) => q.id === 'pickupL');
  const samePickup = !pickup || Object.entries(GUITAR_PICKUP).every(([k, v]) => PEDAL.guitar[k] === v);
  const changes = Object.keys(PEDAL.guitar);
  check(!bad.length && samePickup, `${p.name}: its guitar values are its own parameters, in range${pickup ? ', and the test guitar\'s pickup' : ''}`,
    bad.join('; ') || (changes.length ? changes.join(', ') : 'the same for any instrument'));
}

// 2. a guitar's settings start from the pedal's defaults with its guitar values, and are kept apart
{
  const W = descriptors.find((d) => d.id === 'wah'), d = defaults(W.groups), g = instrumentDefaults(W, d, 'guitar');
  check(g.sweepC === 10e-9 && g.pickupL === 2.5 && instrumentDefaults(W, d, 'bass').sweepC === d.sweepC
    && paramsKey('wah', 'bass') === 'phuzzbox.wah.params' && paramsKey('wah', 'guitar') !== paramsKey('wah', 'bass'),
  'a guitar starts from the defaults and the guitar values, kept apart from the bass\'s (whose key is the one it always had)');
}

// 3. the page's instruments are the test instruments: their open strings, and the riff is playable
{
  const b = new TB(fs, 'bass'), g = new TB(fs, 'guitar');
  const okB = INSTRUMENTS.bass.open.join() === TB.OPEN.join() && RIFFS.bass.every(([k]) => !k || b.note(k, 0.3) >= 0);
  const okG = INSTRUMENTS.guitar.open.join() === TB.GUITAR_OPEN.join() && INSTRUMENTS.guitar.strings.length === 6 && RIFFS.guitar.every(([k]) => !k || g.note(k, 0.3) >= 0);
  check(okB && okG, 'the page\'s bass and guitar are the test instruments, and each plays its riff');
}

// 4. the tuner over a guitar's range: harmonic series on every open string of a seven-string, the
// high E's 12th and 24th frets and drop C's low C, detuned, read to a tenth of a cent
{
  let worst = 0;
  const { fmin, fmax } = INSTRUMENTS.guitar.tuner;
  for (const key of [36, ...INSTRUMENTS.guitar.tunerOpen, 76, 88]) for (const c of [0, 6.1, -11.4, 23]) {
    const f = et(key) * 2 ** (c / 1200), x = new Float32Array(16384);
    for (let i = 0; i < x.length; i++) { let s = 0; for (let k = 1; k <= 10 && k * f < 8000; k++) s += Math.sin((2 * Math.PI * k * f * i) / fs + k) / k; x[i] = 0.1 * s; }
    worst = Math.max(worst, Math.abs(cents(tune(x, fs, { fmin, fmax }), f)));
  }
  check(worst < 0.1, `the tuner, set for a guitar (${fmin}–${fmax} Hz), reads C2 to E6 to a tenth of a cent`, `worst ${worst.toFixed(3)} cents`);
  const high = new Float32Array(16384).map((_, i) => 0.1 * Math.sin((2 * Math.PI * et(88) * i) / fs));
  check(tune(high, fs) === 0 || Math.abs(cents(tune(high, fs), et(88))) > 50, 'set for a bass, it does not reach the high E\'s 24th fret (1319 Hz), which is why a guitar needs its own range');
}

// 5. the Octave Down: 150 Hz, the guitar's tracking filter, follows the test guitar the way 70 Hz
// follows the test bass: the comparator rises once a cycle on every open string and the low E's
// 12th fret (octave/README.md, ## Tracking)
{
  const { PEDAL, Effect } = await loadPedal('octave');
  const P = instrumentDefaults(PEDAL, defaults(PEDAL.groups), 'guitar');
  const rows = [];
  let worst = 1;
  for (const key of [...INSTRUMENTS.guitar.open, 52]) {
    const b = new TB(fs, 'guitar'); b.note(key, 0.8);
    const x = new Float32Array(2 * fs); b.process(x);
    const e = new Effect(fs); e.setParams(P);
    const L = new Float32Array(4800), R = new Float32Array(4800), ms = [];
    for (let at = 0; at < x.length; at += 4800) { e.process(x.subarray(at, at + 4800), L, R); for (const q of e.messages()) if (q.type === 1 && q.values[0] > 0) ms.push(q.values[0]); }
    e.destroy();
    const share = ms.filter((f) => Math.abs(f / et(key) - 1) < 0.03).length / ms.length;
    worst = Math.min(worst, share); rows.push(`${et(key).toFixed(0)} Hz ${(100 * share).toFixed(0)} %`);
  }
  check(P.track === 150 && worst > 0.95, 'Octave Down: the guitar\'s 150 Hz tracking filter follows the test guitar on every open string and the low E\'s 12th fret', rows.join(', '));
}

// 6. the Cabinet's guitar 4 × 12: four Legend 1258s (Fs 94 Hz, Qts 0.99, Vas 32.5 L) in 120 L
// sealed, Small's closed box: α = 4 Vas / Vb, f_c = Fs √(1 + α), Q_tc = Q_ts √(1 + α); and the
// test guitar through it stays finite and within the cones' travel
{
  const { PEDAL, Effect } = await loadPedal('cabinet');
  const P = instrumentDefaults(PEDAL, defaults(PEDAL.groups), 'guitar');
  const qts = (1.18 * 6.15) / (1.18 + 6.15), a = (4 * 0.0325) / 0.12, cb = closedBox(P);
  check(P.layout === '4x12' && Math.abs(cb.fc - 94 * Math.sqrt(1 + a)) < 1e-9 && Math.abs(cb.qtc - qts * Math.sqrt(1 + a)) < 1e-9,
    'Cabinet: the guitar 4 × 12 is a closed box of guitar drivers', `f_c ${cb.fc.toFixed(1)} Hz, Q_tc ${cb.qtc.toFixed(2)}`);
  let finite = true, travel = 0;
  const b = new TB(fs, 'guitar');
  const e = new Effect(fs); e.setParams(P);
  const L = new Float32Array(4800), R = new Float32Array(4800), x = new Float32Array(4800);
  for (let blk = 0; blk < 40; blk++) {
    if (blk % 5 === 0) b.note(RIFFS.guitar[blk / 5][0] || 40, 1);
    b.process(x); e.process(x, L, R);
    finite = finite && L.every(Number.isFinite);
    for (const q of e.messages()) travel = Math.max(travel, q.values[20] ?? 0);
  }
  e.destroy();
  check(finite && travel > 0 && travel < 0.48e-3, 'the test guitar, picked hard, drives the 4 × 12 within its 0.48 mm of travel', `${(1e3 * travel).toFixed(2)} mm`);
}

// 7. the test guitar's README says what changes for a guitar
{
  const md = readFileSync(new URL('testguitar/README.md', root), 'utf8');
  check(/## What changes for a guitar/.test(md) && ['Wah', 'Envelope Filter', 'Octave Down', 'Cabinet', 'Buffer', 'Phuzz', 'Tube Preamp'].every((n) => md.includes(n)),
    'the test guitar\'s README says what changes for a guitar, pedal by pedal');
}

done();
