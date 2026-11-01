// sympathetic-tests.mjs — the Sympathetic Strings against physics written here, independently of
// the C++ (test/sympathetic-circuit.mjs): the strings' tuning and Fletcher's partials, the bridge
// force's closed form, the engine against every mode summed in double precision, the partials and
// decay it plays, each hint, and hygiene.

import { check, done, CI } from './harness.mjs';
import { loadPedal } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { peak, sine } from '../tools/audio-util.mjs';
import { string, strings, losses, modes as modesOf, drivingPoint, response, note } from './sympathetic-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('sympathetic');
const x = Effect.exports;
const fs = 48000;
// at the output knob's unity setting (its default is set for loudness: tools/loudness.mjs)
const D = { ...defaults(PEDAL.groups), level: 0 };
const W = (over) => ({ ...D, ...over });
const wet = (over) => W({ dry: 0, mix: 1, ...over });

function run(P, input) {
  const e = new Effect(fs);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length);
  let ok = true;
  for (let at = 0; at < input.length; at += 4800) {
    const m = Math.min(4800, input.length - at);
    ok = e.process(input.subarray(at, at + m), L.subarray(at, at + m), R.subarray(at, at + m)) && ok;
  }
  const latency = e.latency();
  e.destroy();
  return { L, R, ok, latency };
}
function info(P) {
  const v = Effect.native(P), s = scratch(x);
  s.f64(v.length).set(v);
  x.sympathetic_strings(s.at);
  const o = s.f64(4 + 7 * 12), n = o[0];
  return { gain: o[1], b1: o[2], b3: o[3], strings: Array.from({ length: n }, (_, j) => { const q = o.slice(4 + 7 * j, 11 + 7 * j); return { f0: q[0], L: q[1], T: q[2], mu: q[3], EI: q[4], B: q[5], partials: q[6] }; }) };
}
function modes(P) {
  const v = Effect.native(P), list = [], CH = 1000;
  let count = 0;
  for (let from = 0; from === 0 || from < count; from += CH) {
    const s = scratch(x);
    s.f64(v.length).set(v);
    count = x.sympathetic_modes(s.at, from, CH);
    const o = s.f64(5 * CH);
    for (let i = 0; i < Math.min(CH, count - from); i++) list.push({ string: o[5 * i], n: o[5 * i + 1], f: o[5 * i + 2], a: o[5 * i + 3], K: o[5 * i + 4] });
  }
  return list;
}
const cents = (a, b) => 1200 * Math.log2(a / b);
const burst = (f, sd, at, secs, amp = 0.1) => Float32Array.from({ length: Math.round(secs * fs) }, (_, i) => { const t = i / fs - at; return amp * Math.exp(-0.5 * (t / sd) ** 2) * Math.sin(2 * Math.PI * f * t); });
// a bass note's stand-in: harmonics 1/n to 2 kHz, for secs seconds
const tone = (f, secs, amp = 0.2) => Float32Array.from({ length: Math.round(secs * fs) }, (_, i) => { let s = 0; for (let n = 1; n * f < 2000; n++) s += Math.sin((2 * Math.PI * n * f * i) / fs) / n; return amp * s * Math.min(1, i / 480); });
const energy = (y, from = 0) => { let s = 0; for (let i = from; i < y.length; i++) s += y[i] * y[i]; return s; };
// |DFT| of y at f
const dft = (y, f, from = 0) => { let re = 0, im = 0; for (let i = from; i < y.length; i++) { const p = (2 * Math.PI * f * i) / fs; re += y[i] * Math.cos(p); im -= y[i] * Math.sin(p); } return Math.hypot(re, im); };
function envelope(y, f, tau) {
  const a = Math.exp(-1 / (tau * fs)), re = new Float64Array(y.length), im = new Float64Array(y.length);
  for (let i = 0; i < y.length; i++) { const ph = (2 * Math.PI * f * i) / fs; re[i] = y[i] * Math.cos(ph); im[i] = -y[i] * Math.sin(ph); }
  for (const z of [re, im]) for (let pass = 0; pass < 4; pass++) { let s = 0; for (let i = 0; i < z.length; i++) { s = a * s + (1 - a) * z[i]; z[i] = s; } }
  return Float64Array.from(re, (r, i) => Math.hypot(r, im[i]));
}

// 1. the strings
{
  let worst = 0, wl = 0, wb = 0, count = 0;
  for (const scale of ['major', 'minor', 'major-pent', 'minor-pent', 'drone', 'chromatic']) for (const key of ['0', '4', '9']) for (const octave of ['1', '2', '3']) {
    const P = W({ scale, key, octave }), got = info(P).strings, mine = strings(P);
    count += got.length === mine.length ? 0 : 1;
    got.forEach((s, j) => { worst = Math.max(worst, Math.abs(cents(s.f0, mine[j].f))); wl = Math.max(wl, Math.abs(s.L / mine[j].L - 1)); wb = Math.max(wb, Math.abs(s.B / mine[j].B - 1)); });
  }
  check(count === 0 && worst < 1e-6 && wl < 1e-9 && wb < 1e-6, 'every string, in every key, scale and octave, is tuned to its note, stiffness and all, at 600 MPa', `worst ${worst.toExponential(1)} cents; lengths within ${wl.toExponential(1)}, B within ${wb.toExponential(1)} of a bisection written here`);
  const e1 = info(W({ key: '4', octave: '1' })).strings[0];
  check(Math.abs(e1.f0 - 41.2034) < 1e-3 && Math.abs(e1.L - 3.36) < 0.01, 'Lowest string: octave 1 is the bass\'s own register, and long strings: 3.4 m for E1', `${e1.f0.toFixed(3)} Hz, ${e1.L.toFixed(2)} m`);
  const P = W({ wire: 1e-3 }), got = modes(P), mine = modesOf(strings(P));
  const wf = got.reduce((w, m, i) => Math.max(w, Math.abs(m.f / mine[i].f - 1)), 0), wk = got.reduce((w, m, i) => Math.max(w, Math.abs(m.K / mine[i].K - 1)), 0);
  check(got.length === mine.length && wf < 1e-9 && wk < 1e-9, 'every partial to 6 kHz at Fletcher\'s n f₀ √(1 + Bn²), each pulling on the bridge with (2/L)(T + EI k²)', `${got.length} partials; frequencies within ${wf.toExponential(1)}, couplings within ${wk.toExponential(1)}`);
}

// 2. the bridge force: the modes against the string's closed form
{
  const s = string(110, 0.3e-3);
  let worst = 0;
  for (const f of [30, 75, 160, 333, 1000, 2500]) { const d = drivingPoint(s, f, 54); worst = Math.max(worst, Math.abs(d.modal / d.closed - 1)); }
  check(worst < 1e-4, 'for a string without stiffness, the bridge\'s own −T/L and its modes\' pull sum to the driving-point force −T k cot(kL)', `worst ${worst.toExponential(1)} from 30 Hz to 2.5 kHz, 54 modes and the rest of the sum by Euler–Maclaurin`);
}

// 3. the engine against every mode summed in double precision
{
  for (const [P, what] of [[wet({}), 'E major, the default'], [wet({ scale: 'chromatic', key: '0', octave: '1', wire: 1e-3, sustain: 15, highs: 4 }), 'C chromatic from octave 1, thick wire, long sustain']]) {
    const inf = info(P), inp = burst(330, 3e-3, 0.02, 0.5);
    const eng = run(P, inp).L, ref = response(inp, fs, { S: strings(P), sustain: P.sustain, highs: P.highs, gain: inf.gain });
    let err = 0, sig = 0;
    for (let i = 0; i < inp.length; i++) { err += (eng[i] - ref[i]) ** 2; sig += ref[i] ** 2; }
    check(Math.sqrt(err / sig) < 2e-3, `the engine against every partial summed at 48 kHz in double precision: ${what}`, `${(100 * Math.sqrt(err / sig)).toFixed(3)} % RMS difference`);
  }
}

// 4. the partials it plays: Fletcher's stretch, heard
{
  const P = wet({ scale: 'drone', key: '9', octave: '1', wire: 1e-3, sustain: 20, highs: 5 });
  const s = info(P).strings[0], click = new Float32Array(4 * fs); click[0] = 1;
  const y = run(P, click).L;
  const n = 40, want = n * s.f0 / Math.sqrt(1 + s.B) * Math.sqrt(1 + s.B * n * n);
  let best = 0, at = 0;
  for (let c = -15; c <= 15; c += 0.05) { const f = want * 2 ** (c / 1200), v = dft(y, f, fs / 10); if (v > best) { best = v; at = f; } }
  check(Math.abs(cents(at, want)) < 1 && cents(want, n * s.f0) > 20, `the strings' partials are stretched: the A1 string's 40th rings at Fletcher's frequency, not at 40 f₀ (the A2 string's 20th and A3's 10th, stretched alike, ring beside it)`, `${at.toFixed(2)} Hz against ${want.toFixed(2)} Hz, ${cents(want, n * s.f0).toFixed(1)} cents above 40 × ${s.f0.toFixed(2)} Hz (B = ${s.B.toExponential(2)})`);
}

// 5. the decay
{
  const P = wet({ scale: 'drone', key: '9', octave: '2', sustain: 6, highs: 1 }), click = new Float32Array(5 * fs); click[0] = 1;
  const y = run(P, click).L, { b1, b3 } = losses(6, 1);
  // A2's fundamental, and its 19th partial, which no other string of the drone shares
  const a2 = info(P).strings[0];
  for (const f of [a2.f0, 19 * a2.f0 / Math.sqrt(1 + a2.B) * Math.sqrt(1 + a2.B * 361)]) {
    const env = envelope(y, f, 5e-3), t0 = Math.round(0.05 * fs), t1 = Math.round((f < 500 ? 3 : 0.6) * fs);
    const slope = Math.log(env[t1] / env[t0]) / ((t1 - t0) / fs), want = b1 + b3 * (2 * Math.PI * f) ** 2;
    check(Math.abs(-slope / want - 1) < 0.05, `a partial at ${f.toFixed(0)} Hz dies at Chaigne and Askenfelt's b₁ + b₃ω²`, `${(-slope).toFixed(3)} /s against ${want.toFixed(3)} /s: T₆₀ ${(6.908 / -slope).toFixed(2)} s`);
  }
}

// 6. the hints
{
  const ring = (P, f) => energy(run(wet(P), tone(f, 1)).L);
  const inE = ring({ key: '4' }, 41.2), inF = ring({ key: '4' }, note(-45 + 5));
  check(inE > 10 * inF, 'Key: in E, an open E rings the strings far more than an F would', `${(10 * Math.log10(inE / inF)).toFixed(1)} dB more`);
  const fNote = note(-45 + 5); // F1
  const chrom = ring({ key: '4', scale: 'chromatic' }, fNote), major = ring({ key: '4', scale: 'major' }, fNote), drone = ring({ key: '4', scale: 'drone' }, fNote);
  check(chrom > 4 * major && major > drone, 'Scale: Chromatic rings along with any note; Drone, the most open, least', `an F in E: chromatic ${(10 * Math.log10(chrom / major)).toFixed(1)} dB above major, drone ${(10 * Math.log10(drone / major)).toFixed(1)} dB`);
  const b3 = info(W({ wire: 0.3e-3 })).strings[0].B, b10 = info(W({ wire: 1e-3 })).strings[0].B;
  check(Math.abs(b10 / b3 / (1 / 0.3) ** 2 - 1) < 0.02, 'Wire diameter: Fletcher\'s B grows as the diameter squared at the same stress', `B ${b3.toExponential(2)} at 0.3 mm, ${b10.toExponential(2)} at 1 mm`);
  const tail = (P) => { const c = new Float32Array(4 * fs); c[0] = 1; const y = run(wet(P), c).L; let e = 0; const tot = energy(y); for (let i = y.length - 1; i >= 0; i--) { e += y[i] * y[i]; if (e > 1e-6 * tot) return i / fs; } return 0; };
  const s2 = tail({ sustain: 2 }), s6 = tail({ sustain: 6 });
  check(s6 > 1.5 * s2, 'Sustain: longer is a longer halo', `60 dB of the energy gone by ${s2.toFixed(2)} s at 2 s, ${s6.toFixed(2)} s at 6 s`);
  // what still rings half a second after a note: its 20th partial against its 2nd
  const bright = (h) => { const inp = new Float32Array(2 * fs); inp.set(tone(41.2, 1)); const y = run(wet({ highs: h }), inp).L, s0 = info(D).strings[0], at = (n) => (n * s0.f0 * Math.sqrt(1 + s0.B * n * n)) / Math.sqrt(1 + s0.B); return dft(y, at(20), 1.5 * fs) / dft(y, at(2), 1.5 * fs); };
  check(bright(4) > 10 * bright(0.3), 'Highs ring: long is a brighter halo, short a darker one', `half a second after the note, its 20th partial against its 2nd: ${(20 * Math.log10(bright(4) / bright(0.3))).toFixed(1)} dB more at 4 s than at 0.3 s`);
  const L1 = losses(1, 5);
  check(L1.b3 === 0 && Math.abs(6.908 / L1.b1 - 1) < 1e-3, 'Highs ring: never longer than Sustain (the losses never fall with frequency)', `Sustain 1 s, Highs 5 s: b₃ = ${L1.b3}`);
  const n = sine(220, fs, 4800, 0.2), dry = run(W({ dry: 1, mix: 0 }), n).L;
  check(dry.every((v, i) => Math.abs(v - n[i]) < 1e-6), 'Dry: the bass as it came in');
  const lv = run(W({ dry: 1, mix: 0, level: -6 }), n).L;
  check(lv.every((v, i) => Math.abs(v - 0.501187 * n[i]) < 1e-6), 'Level: gain after the mix, in decibels');
  const half = run(W({ dry: 0, mix: 0.5 }), n).L, full = run(W({ dry: 0, mix: 1 }), n).L;
  check(half.every((v, i) => Math.abs(v - 0.5 * full[i]) < 1e-6) && peak(full) > 1e-3, 'Strings: how much of the pickup under the bridge is mixed in');
  // the pickup's gain: white noise in comes out at its own level, at the reference losses
  const white = Float32Array.from({ length: 6 * fs }, (_, i) => { const u = Math.sin(i * 12.9898) * 43758.5453; return 0.1 * 2 * (u - Math.floor(u) - 0.5) * Math.sqrt(3); });
  const yw = run(wet({ sustain: 6, highs: 1 }), white).L;
  const ratio = Math.sqrt(energy(yw, 4 * fs) / energy(white, 4 * fs));
  check(Math.abs(ratio - 1) < 0.06, 'the pickup\'s gain: white noise in comes out at its own level (Sustain 6 s, Highs 1 s), the strings\' shared partials counted together', `${(20 * Math.log10(ratio)).toFixed(2)} dB`);
}

// 7. hygiene
{
  const r = run(D, tone(41.2, 1, 0.5));
  check(r.ok && r.L.every(Number.isFinite) && peak(r.L) < 5, 'a loud low note: finite and bounded', `peak ${peak(r.L).toFixed(2)} V`);
  check(r.latency === 0 && r.R.every((v, i) => v === r.L[i]), 'no latency, mono out on both sides (one pickup under the bridge)');
  const e = new Effect(fs); e.setParams(D);
  const bad = new Float32Array(128); bad[5] = NaN;
  const L = new Float32Array(4096), R = new Float32Array(4096);
  const ok = e.process(bad, L.subarray(0, 128), R.subarray(0, 128));
  e.process(sine(100, fs, 4096, 0.1), L, R);
  check(!ok && L.every(Number.isFinite) && peak(L) > 0.01, 'a NaN in comes out as a silent block, and the pedal recovers');
  e.destroy();
  const ids = new Map(PEDAL.groups.flatMap((g) => g.params).map((p) => [p.id, p]));
  const badP = Object.entries(PEDAL.presets).flatMap(([nm, v]) => Object.entries(v).filter(([id, val]) => !ids.has(id) || (typeof val === 'number' && (val < ids.get(id).min || val > ids.get(id).max)) || (ids.get(id).type === 'select' && !ids.get(id).options.some(([o]) => o === val))).map(([id]) => `${nm}: ${id}`));
  check(!badP.length, 'every preset sets real parameters inside their ranges', badP.join(', '));
}

// 8. CPU
if (!CI) {
  const share = (P) => {
    const n = 3 * fs, inp = tone(41.2, 3);
    const e = new Effect(fs); e.setParams(P);
    const L = new Float32Array(128), R = new Float32Array(128), t0 = performance.now();
    for (let at = 0; at < n; at += 128) e.process(inp.subarray(at, at + 128), L, R);
    const s = (performance.now() - t0) / 1000 / 3;
    e.destroy(); return s;
  };
  const worst = share(W({ scale: 'chromatic', octave: '1' })), m = modes(W({ scale: 'chromatic', octave: '1' })).length;
  check(worst < 0.06, `CPU: the most strings and partials (${m}), under 6 % of a core (WebAssembly)`, `${(100 * worst).toFixed(1)} %`);
}

done();
