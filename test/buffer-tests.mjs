// buffer-tests.mjs — the Buffer against circuit theory written here, independently of the C++:
// the pickup's divider from complex impedances, the LC resonance, and the engine against both.

import { check, done, CI } from './harness.mjs';
import { loadPedal, loadBass } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { amplitudeAt, db, sine } from '../tools/audio-util.mjs';

const { PEDAL, Effect } = await loadPedal('buffer');
const x = Effect.exports;
const fs = 48000;
const D = defaults(PEDAL.groups);
const with_ = (over) => ({ ...D, ...over });

// v/e of a pickup into its load, from complex impedances (no polynomials): Z_shunt / (Z_coil + Z_shunt)
function divider(P, cable, load, f) {
  const w = 2 * Math.PI * f;
  const C = (P.active ? 0 : P.pickupC) + cable * P.cablePF;
  const G = 1 / load + (P.active ? 0 : 1 / P.pots); // conductance to ground
  // Z_shunt = 1 / (G + jωC)
  const den = G * G + (w * C) ** 2, zr = G / den, zi = -w * C / den;
  const R = P.active ? P.activeR : P.pickupR, X = P.active ? 0 : w * P.pickupL;
  const tr = R + zr, ti = X + zi; // Z_coil + Z_shunt
  return Math.hypot(zr, zi) / Math.hypot(tr, ti);
}
const recorded = (P, f) => divider(P, P.recCable, P.recLoad, f);
const wanted = (P, f) => divider(P, P.cable, P.load, f);

// the C++ model through its exports
function model(P, freqs) {
  const s = scratch(x), np = Effect.native(P).length;
  s.f64(np).set(Effect.native(P));
  s.f64(freqs.length, 8 * np).set(freqs);
  x.buffer_response(s.at, freqs.length);
  const out = s.f64(3 * freqs.length, 8 * (np + freqs.length));
  const n = freqs.length;
  return { rec: Array.from(out.slice(0, n)), want: Array.from(out.slice(n, 2 * n)), H: Array.from(out.slice(2 * n)) };
}
function resonances(P) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length).set(v);
  x.buffer_resonances(s.at);
  const r = s.f64(4);
  return { rec: r[0], want: r[1], Crec: r[2], Cwant: r[3] };
}
const logspace = (a, b, n) => Array.from({ length: n }, (_, i) => a * (b / a) ** (i / (n - 1)));

// 1. the model's circuit is the divider
{
  const freqs = logspace(20, 20000, 40);
  let worst = 0;
  for (const P of [D, with_({ cable: 30, load: 10e3 }), with_({ active: true, cable: 20 }), with_({ pickupL: 8, pickupC: 300e-12, pots: 500e3 })]) {
    const m = model(P, freqs);
    freqs.forEach((f, i) => {
      worst = Math.max(worst, Math.abs(m.rec[i] / recorded(P, f) - 1), Math.abs(m.want[i] / wanted(P, f) - 1), Math.abs(m.H[i] / (wanted(P, f) / recorded(P, f)) - 1));
    });
  }
  check(worst < 1e-9, 'model: v/e is the coil and the shunt as a divider of complex impedances', `worst relative error ${worst.toExponential(1)}`);
}

// 2. a lightly damped pickup peaks at 1/(2π√(LC))
{
  const P = with_({ pots: 1e6, load: 10e6, pickupR: 3000, cable: 3 });
  const C = P.pickupC + 3 * P.cablePF, f0 = 1 / (2 * Math.PI * Math.sqrt(P.pickupL * C));
  const freqs = logspace(f0 / 2, f0 * 2, 2001);
  const m = model(P, freqs);
  const fp = freqs[m.want.indexOf(Math.max(...m.want))];
  check(Math.abs(fp / f0 - 1) < 0.02, 'model: a lightly damped pickup resonates at 1/(2π√(LC))', `${fp.toFixed(0)} Hz against ${f0.toFixed(0)} Hz`);
  check(Math.abs(resonances(P).want / f0 - 1) < 1e-12, 'model: and reports that frequency');
}

// 3. cable capacitance moves the resonance as 1/√C
{
  const a = resonances(with_({ cable: 3 })), b = resonances(with_({ cable: 30 }));
  const expect = Math.sqrt(a.Cwant / b.Cwant);
  check(Math.abs(b.want / a.want / expect - 1) < 1e-12 && b.want < 0.5 * a.want, 'longer cable: the resonance falls as 1/√C', `${a.want.toFixed(0)} Hz at 3 m, ${b.want.toFixed(0)} Hz at 30 m`);
}

// the engine's gain at f, from a sine after the transient
function measure(P, f, n = 16384) {
  const e = new Effect(fs);
  e.setParams(P);
  const inp = sine(f, fs, n + 8192, 0.1), L = new Float32Array(inp.length), R = new Float32Array(inp.length);
  e.process(inp, L, R);
  e.destroy();
  return amplitudeAt(L.subarray(8192), f, fs) / amplitudeAt(inp.subarray(8192), f, fs);
}

// 4. at its defaults the Buffer is the identity
{
  const e = new Effect(fs);
  e.setParams(D);
  const inp = sine(1234, fs, 4096, 0.3), L = new Float32Array(4096), R = new Float32Array(4096);
  e.process(inp, L, R);
  let worst = 0;
  for (let i = 0; i < 4096; i++) worst = Math.max(worst, Math.abs(L[i] - inp[i]), Math.abs(R[i] - inp[i]));
  check(worst < 1e-6, 'engine: as plugged in, the signal passes unchanged', `worst ${worst.toExponential(1)} V`);
}

// 5. the engine follows the circuit
for (const [name, P] of Object.entries(PEDAL.presets).map(([n, v]) => [n, with_(v)])) {
  const freqs = [40, 80, 160, 315, 630, 1250, 2500, 3500, 5000, 8000];
  let worst = 0;
  for (const f of freqs) worst = Math.max(worst, Math.abs(db(measure(P, f)) - db(wanted(P, f) / recorded(P, f))));
  check(worst < 0.3, `engine: "${name}" follows the circuit 40 Hz–8 kHz`, `worst ${worst.toFixed(3)} dB`);
}

// 6. the hints: a 10 kΩ input soaks up the resonance and the treble
{
  const P = with_({ load: 10e3 });
  const freqs = logspace(100, 10000, 200), m = model(P, freqs);
  const peakDb = db(Math.max(...m.want) / m.want[0]);
  const at4k = db(wanted(P, 4000) / wanted(D, 4000));
  check(peakDb < 0.5, 'a 10 kΩ input leaves no resonant peak', `${peakDb.toFixed(2)} dB above 100 Hz`);
  check(at4k < -12, 'and takes the treble with it', `${at4k.toFixed(1)} dB at 4 kHz against a 1 MΩ input`);
  // and the level: at low frequencies the coil is its resistance, a divider with the input
  const div = (load) => { const sh = 1 / (1 / load + 1 / P.pots); return sh / (P.pickupR + sh); };
  const bass = db(measure(P, 40)), expect = db(div(P.load) / div(P.recLoad));
  check(Math.abs(bass - expect) < 0.3, 'and some level with it: the coil\'s resistance divides with the input', `${bass.toFixed(2)} dB at 40 Hz, the divider says ${expect.toFixed(2)} dB`);
}

// 7. an active bass shrugs off cable and load
{
  let worst = 0;
  for (const over of [{ cable: 30 }, { load: 10e3 }, { cable: 60, load: 5e3 }]) {
    const P = with_({ active: true, ...over });
    for (const f of [50, 500, 5000, 10000]) worst = Math.max(worst, Math.abs(db(wanted(P, f) / recorded(P, f)) - db(wanted(P, 50) / recorded(P, 50))));
  }
  check(worst < 0.5, 'active electronics: the response stays flat whatever the cable and load', `worst ${worst.toFixed(2)} dB of tilt`);
}

// 8. level
{
  const g = measure(with_({ level: 6.0206 }), 300);
  check(Math.abs(g - 2) < 1e-3, 'level: +6.02 dB doubles the signal', `× ${g.toFixed(4)}`);
}

// 9. hygiene
{
  const e = new Effect(fs);
  e.setParams(with_({ cable: 30, load: 10e3 }));
  const n = fs, L = new Float32Array(n), R = new Float32Array(n);
  e.process(new Float32Array(n), L, R);
  check(L.every((v) => v === 0), 'silence in, silence out');
  const bad = new Float32Array(128); bad[5] = NaN;
  const ok = e.process(bad, L.subarray(0, 128), R.subarray(0, 128));
  e.process(sine(100, fs, 4096), L.subarray(0, 4096), R.subarray(0, 4096));
  check(!ok && L.subarray(0, 4096).every(Number.isFinite), 'a NaN in comes out as a silent block, and the pedal recovers');
  check(e.latency() === 0 && e.tail() === 0, 'no latency and no tail');
  e.destroy();
}

// 10. presets stay in range
{
  const ids = new Map(PEDAL.groups.flatMap((g) => g.params).map((p) => [p.id, p]));
  const bad = Object.entries(PEDAL.presets).flatMap(([n, v]) => Object.entries(v).filter(([id, val]) => !ids.has(id) || (typeof val === 'number' && (val < ids.get(id).min || val > ids.get(id).max))).map(([id]) => `${n}: ${id}`));
  check(!bad.length, 'every preset sets real parameters inside their ranges', bad.join(', '));
}

// 11. end to end: the test bass, through the Buffer as plugged in, is unchanged
{
  const TB = await loadBass();
  const b = new TB(fs);
  b.note(28, 0.8);
  const n = fs, inp = new Float32Array(n), L = new Float32Array(n), R = new Float32Array(n);
  b.process(inp);
  const e = new Effect(fs);
  e.setParams(D);
  e.process(inp, L, R);
  let worst = 0;
  for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs(L[i] - inp[i]));
  check(worst < 1e-6, 'the test bass through the Buffer as plugged in comes out unchanged', `worst ${worst.toExponential(1)} V`);
}

// 12. CPU
if (!CI) {
  const e = new Effect(fs);
  e.setParams(with_({ cable: 30 }));
  const n = 10 * fs, inp = sine(100, fs, n), L = new Float32Array(n), R = new Float32Array(n);
  const t0 = performance.now();
  e.process(inp, L, R);
  const ms = performance.now() - t0;
  check(ms < 200, 'CPU: ten seconds of audio in under 0.2 s', `${ms.toFixed(0)} ms`);
}

done();
