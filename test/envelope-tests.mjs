// envelope-tests.mjs — the Envelope Filter against physics written here, independently of the C++
// (test/envelope-circuit.mjs): the cells' steady state in closed form, the follower and the cells
// integrated together by RK4, the state-variable filter's analog response and its bilinear image;
// then the engine against them, each hint, and hygiene.

import { check, done, CI } from './harness.mjs';
import { loadPedal, loadBass } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { amplitudeAt, db, sine, peak } from '../tools/audio-util.mjs';
import { steadyCutoff, ledLight, steadyN, controlPath, svf, svfBilinear, mag } from './envelope-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('envelope');
const x = Effect.exports;
const fs = 48000;
// at the output knob's unity setting (its default is set for loudness: tools/loudness.mjs)
const D = { ...defaults(PEDAL.groups), level: 0 };
const W = (over) => ({ ...D, ...over });
const preset = (name, over) => W({ ...PEDAL.presets[name], ...over });

// run the engine on an input in 100 ms blocks, collecting its messages (one every 10 ms), after
// four seconds of silence in which the cells settle in the light they rest in (the host sets the
// defaults first, so a pedal set to Down starts with dark cells and lights them, its traps filling
// over seconds, as a real one switched on would)
function run(P, input) {
  const e = new Effect(fs);
  e.setParams(P);
  { const z = new Float32Array(4800), zl = new Float32Array(4800), zr = new Float32Array(4800); for (let k = 0; k < 40; k++) e.process(z, zl, zr); e.messages(); }
  const L = new Float32Array(input.length), R = new Float32Array(input.length), ms = [];
  let ok = true;
  for (let at = 0; at < input.length; at += 4800) {
    const m = Math.min(4800, input.length - at);
    ok = e.process(input.subarray(at, at + m), L.subarray(at, at + m), R.subarray(at, at + m)) && ok;
    for (const q of e.messages()) if (q.type === 1) ms.push({ fc: q.values[0], env: q.values[1], led: q.values[2], n: q.values[3], m: q.values[4], cell: q.values[5] });
  }
  const latency = e.latency(), tail = e.tail();
  e.destroy();
  return { L, R, ms, ok, latency, tail };
}
function cppStatic(P, volts) {
  const s = scratch(x), v = Effect.native(P), n = volts.length;
  s.f64(v.length).set(v);
  s.f64(n, 8 * v.length).set(volts);
  x.envelope_static(s.at, n);
  const o = Array.from(s.f64(3 * n, 8 * (v.length + n)));
  return { fc: o.slice(0, n), light: o.slice(n, 2 * n), n: o.slice(2 * n) };
}
function cppResponse(P, fc, freqs) {
  const s = scratch(x), v = Effect.native(P), n = freqs.length;
  s.f64(v.length + 1).set([...v, fc]);
  s.f64(n, 8 * (v.length + 1)).set(freqs);
  x.envelope_response(s.at, n);
  return Array.from(s.f64(n, 8 * (v.length + 1 + n)));
}
// the engine's gain at f for a tiny sine (too small to move the cells), and the cutoff it sat at
function gainAt(P, f, a = 1e-5) {
  const r = run(P, sine(f, fs, fs, a));
  return { g: amplitudeAt(r.L.subarray(fs / 2), f, fs) / a, fc: r.ms.at(-1).fc };
}
const bassNote = (midi, vel, secs = 1.5) => { const b = new TB(fs); b.note(midi, vel); const y = new Float32Array(Math.round(secs * fs)); b.process(y); return y; };
const TB = await loadBass();

// 1. the cells' steady state: the light a follower's voltage gives, the electrons it keeps, the cutoff
{
  let worst = 0;
  const V = [0, 1e-3, 0.01, 0.05, 0.1, 0.3, 1, 3, 30];
  for (const name of Object.keys(PEDAL.presets)) {
    const P = preset(name), c = cppStatic(P, V);
    V.forEach((v, i) => { worst = Math.max(worst, Math.abs(c.fc[i] / steadyCutoff(P, v) - 1), Math.abs(c.light[i] - ledLight(P, v)), Math.abs(c.n[i] - steadyN(ledLight(P, v)))); });
  }
  check(worst < 1e-12, 'model: a steady follower voltage lights the LED, keeps n(1 + n) = Λ electrons in the cells, and sets the cutoff, alike here and in C++', `worst ${worst.toExponential(1)}`);
  const lo = steadyCutoff(D, 0), hi = steadyCutoff(D, 100), lo15 = steadyCutoff(W({ rangeC: 15e-9 }), 0), hi15 = steadyCutoff(W({ rangeC: 15e-9 }), 100);
  check(Math.abs(lo - 101) < 2 && Math.abs(hi - 1537) < 5, `the sweep at 47 nF: ${lo.toFixed(1)} Hz dark (the 33 kΩ across each cell), ${hi.toFixed(0)} Hz at the LED's 20 mA`);
  check(Math.abs(lo15 - 317) < 3 && Math.abs(hi15 - 4815) < 15, `Range: 15 nF sweeps a guitar's range, ${lo15.toFixed(0)} Hz to ${hi15.toFixed(0)} Hz, as 1/C`);
}

// 2. the filter: the engine at rest (dark cells, Up; the standing 10 mA, Down) is the state-variable
// filter's bilinear image, all three outputs
{
  let worst = 0;
  const F = [40, 80, 150, 300, 600, 1200, 3000];
  for (const direction of ['up', 'down']) for (const mode of ['lp', 'bp', 'hp']) {
    const P = W({ mode, direction, sens: 0, blend: 0 });
    for (const f of F) {
      const { g, fc } = gainAt(P, f);
      worst = Math.max(worst, Math.abs(db(g) - db(mag(svfBilinear(mode, P.reso, fc, f, fs)))));
    }
  }
  check(worst < 0.02, 'engine: at rest, each output is the state-variable filter\'s response under the bilinear transform (the trapezoidal rule), dark and lit', `worst ${worst.toFixed(4)} dB`);
  const rest = run(W({ sens: 0 }), new Float32Array(fs / 10)).ms.at(-1).fc, down = run(W({ sens: 0, direction: 'down' }), new Float32Array(fs / 10)).ms.at(-1).fc;
  check(Math.abs(rest / steadyCutoff(W({}), 0) - 1) < 1e-4 && Math.abs(down / steadyCutoff(W({ direction: 'down' }), 0) - 1) < 1e-4, 'and rests where the closed form says: the cells dark (Up), or lit by the standing 5 mA (Down)', `${rest.toFixed(1)} Hz and ${down.toFixed(0)} Hz`);
  // the C++ analog response, for the page, is the one written here
  let w2 = 0;
  for (const mode of ['lp', 'bp', 'hp']) for (const f of [50, 200, 700, 2500]) w2 = Math.max(w2, Math.abs(cppResponse(W({ mode }), 400, [f])[0] / mag(svf(mode, D.reso, 400, f)) - 1));
  check(w2 < 1e-12, 'model: the C++ analog response for the page is the state-variable filter\'s', `worst ${w2.toExponential(1)}`);
}

// 3. the control path: the follower and the cells on the test bass, against RK4 of their equations
{
  let worst = 0, k = 0;
  for (const name of ['Quack (band-pass)', 'Downward', 'Slow cells']) {
    const P = preset(name), inp = bassNote(33, 0.9, 1.2), r = run(P, inp), ref = controlPath(P, inp, fs);
    r.ms.forEach((m, i) => { worst = Math.max(worst, Math.abs(m.fc / ref.fc[480 * (i + 1) - 1] - 1)); k++; });
  }
  check(worst < 0.003, 'engine: the cutoff the follower and the cells make on the test bass\'s A is the RK4 integration of their equations, three presets', `${k} points, worst ${(100 * worst).toFixed(3)} %`);
}

// 4. the hints
const fcTrace = (P, inp) => run(P, inp).ms.map((m) => m.fc);
{
  const P = W({ blend: 0, sens: 0 }), fc = run(P, new Float32Array(fs / 10)).ms.at(-1).fc;
  const lp = gainAt(W({ mode: 'lp', reso: Math.SQRT1_2, blend: 0, sens: 0 }), 25).g, bp = gainAt(W({ mode: 'bp', blend: 0, sens: 0 }), fc).g, hp = gainAt(W({ mode: 'hp', reso: Math.SQRT1_2, blend: 0, sens: 0 }), 1500).g;
  check(Math.abs(db(lp)) < 0.5 && Math.abs(db(hp)) < 0.5 && Math.abs(db(bp) - db(D.reso)) < 0.3, 'Mode: low-pass passes what is below the cutoff, high-pass what is above, band-pass peaks at the cutoff', `${db(lp).toFixed(2)} dB at 25 Hz, ${db(hp).toFixed(2)} dB at 1.5 kHz, band-pass ${db(bp).toFixed(1)} dB at ${fc.toFixed(0)} Hz`);
  const flat = Math.max(...[30, 50, 70, 90].map((f) => db(gainAt(W({ mode: 'lp', reso: Math.SQRT1_2, blend: 0, sens: 0 }), f).g)));
  const tall = gainAt(W({ mode: 'bp', reso: 12, blend: 0, sens: 0 }), fc).g;
  check(flat < 0.05 && Math.abs(db(tall) - db(12)) < 0.5, 'Resonance: more, a taller peak (Q at the cutoff); at 0.7 the low-pass has no peak', `low-pass at most ${flat.toFixed(3)} dB below the cutoff; band-pass ${db(tall).toFixed(1)} dB at Q 12`);
  const note = bassNote(33, 0.8, 0.8);
  const top = (o) => Math.max(...fcTrace(W(o), note));
  check(top({ sens: 28 }) > 1.3 * top({ sens: 16 }), 'Sensitivity: more, and the same note sweeps higher', `${top({ sens: 16 }).toFixed(0)} Hz at 16 dB, ${top({ sens: 28 }).toFixed(0)} Hz at 28 dB`);
  const dn = fcTrace(W({ direction: 'down' }), note);
  const restDn = steadyCutoff(W({ direction: 'down' }), 0);
  check(restDn > 900 && Math.min(...dn) < 0.5 * restDn && dn.at(-1) > Math.min(...dn) * 1.3, 'Direction, down: it rests high, each pluck pulls it down, and it rises as the note fades', `${restDn.toFixed(0)} Hz at rest, down to ${Math.min(...dn).toFixed(0)} Hz, back to ${dn.at(-1).toFixed(0)} Hz`);
  const up = fcTrace(W({}), note);
  const restUp = steadyCutoff(W({}), 0);
  check(Math.max(...up) > 4 * restUp && up.at(-1) < 0.8 * Math.max(...up), 'Up: each pluck sweeps it up, and it falls as the note fades', `${restUp.toFixed(0)} Hz at rest → ${Math.max(...up).toFixed(0)} Hz → ${up.at(-1).toFixed(0)} Hz`);
  const t90 = (o) => { const t = fcTrace(W({ sens: 20, ...o }), sine(110, fs, fs / 2, 0.3)), r = steadyCutoff(W({}), 0); return 10 * (t.findIndex((v) => v - r > 0.9 * (t.at(-1) - r)) + 1); };
  check(t90({ attack: 60e-3 }) > 2.5 * t90({ attack: 2e-3 }), 'Attack: longer, and the sweep slides up rather than jumping', `90 % of the way in ${t90({ attack: 2e-3 })} ms at 2 ms, ${t90({ attack: 60e-3 })} ms at 60 ms`);
  const held = (o) => { const inp = new Float32Array(fs); inp.set(sine(110, fs, fs / 2, 0.3)); const t = fcTrace(W(o), inp); return t[64] / t[49]; };
  check(held({ decay: 1 }) > 0.8 && held({ decay: 0.03 }) < 0.5, 'Decay: short, and the sweep follows the note down; long, it hangs', `150 ms after the note, ${(100 * held({ decay: 0.03 })).toFixed(0)} % of the cutoff at 30 ms, ${(100 * held({ decay: 1 })).toFixed(0)} % at 1 s`);
  check(held({ decay: 0.02, lifetime: 0.15 }) > held({ decay: 0.02, lifetime: 5e-3 }) + 0.15, 'Carrier lifetime: longer, and the cells darken lazily, the sweep falling back slower than the follower', `${(100 * held({ decay: 0.02, lifetime: 5e-3 })).toFixed(0)} % at 5 ms, ${(100 * held({ decay: 0.02, lifetime: 0.15 })).toFixed(0)} % at 150 ms`);
  // memory: after a long hard note, the last of the way to rest takes the traps' time
  const tail = (secs, trapTime) => {
    const inp = new Float32Array(Math.round((secs + 3) * fs)); inp.set(sine(110, fs, Math.round(secs * fs), 0.3));
    const t = fcTrace(W({ decay: 0.03, trapTime }), inp), rest = steadyCutoff(W({}), 0), from = Math.round(secs * 100);
    return 10 * (t.slice(from).findIndex((v) => v < rest * 1.05));
  };
  const short = tail(0.15, 2), long = tail(3, 2), longFast = tail(3, 0.2);
  check(long > 2 * short && longFast < long / 2, 'Trap release time: after a long hard note the filter takes longer to come all the way down, and longer with slower traps', `to within 5 % of rest: ${short} ms after 0.15 s, ${long} ms after 3 s; ${longFast} ms with 0.2 s traps`);
  // 0.22 V on the follower puts 1 mA through the LED's 220 Ω
  check(Math.abs(ledLight(W({}), 0.22) - 1) < 1e-12 && steadyCutoff(W({ litR: 2e3 }), 0.22) > 1.4 * steadyCutoff(W({ litR: 8e3 }), 0.22), 'Cell resistance, lit: lower, and the same light opens the filter further', `${steadyCutoff(W({ litR: 8e3 }), 0.22).toFixed(0)} Hz at 8 kΩ, ${steadyCutoff(W({ litR: 2e3 }), 0.22).toFixed(0)} Hz at 2 kΩ, 1 mA`);
  const ratio = 1 / (1 / 2e6 + steadyN(1) / 5e3) / 5e3;
  check(Math.abs(ratio - 1.62) < 0.01, 'and a cell is 1.6 times it at 1 mA (n = 0.618)', `${ratio.toFixed(3)} ×`);
  const dry = gainAt(W({ mode: 'hp', blend: 0.5, sens: 0 }), 30).g, wet = gainAt(W({ mode: 'hp', blend: 0, sens: 0 }), 30).g;
  check(db(dry) - db(wet) > 12, 'Clean blend: the dry signal brings back the bottom the high-pass took', `${db(wet).toFixed(1)} → ${db(dry).toFixed(1)} dB at 30 Hz`);
  const l6 = gainAt(W({ level: 6, sens: 0 }), 300).g / gainAt(W({ sens: 0 }), 300).g;
  check(Math.abs(l6 - 10 ** (6 / 20)) < 1e-4, 'Level: +6 dB doubles the output', `× ${l6.toFixed(4)}`);
}

// 5. the test bass through the quack keeps its pitch
{
  const inp = bassNote(28, 0.8, 1), y = run(preset('Quack (band-pass)'), inp).L;
  check(y.every(Number.isFinite) && peak(y) > 0.1 * peak(inp), 'the test bass\'s low E through the quack plays', `peak ${db(peak(y) / peak(inp)).toFixed(1)} dB`);
}

// 6. hygiene
{
  const r = run(D, new Float32Array(fs));
  check(peak(r.L) === 0, 'silence in, silence out');
  const e = new Effect(fs);
  e.setParams(D);
  const bad = new Float32Array(128); bad[5] = NaN;
  const L = new Float32Array(4096), R = new Float32Array(4096);
  const ok = e.process(bad, L.subarray(0, 128), R.subarray(0, 128));
  e.process(sine(100, fs, 4096, 0.1), L, R);
  check(!ok && L.every(Number.isFinite) && peak(L) > 0.01, 'a NaN in comes out as a silent block, and the pedal recovers');
  e.destroy();
  check(r.latency === 0 && r.R.every((v, i) => v === r.L[i]), 'no latency, mono out on both sides');
  const ids = new Map(PEDAL.groups.flatMap((g) => g.params).map((p) => [p.id, p]));
  const badP = Object.entries(PEDAL.presets).flatMap(([n, v]) => Object.entries(v).filter(([id, val]) => !ids.has(id) || (typeof val === 'number' && (val < ids.get(id).min || val > ids.get(id).max))).map(([id]) => `${n}: ${id}`));
  check(!badP.length, 'every preset sets real parameters inside their ranges', badP.join(', '));
}

// 7. CPU
if (!CI) {
  const quiet = (pre) => {
    const e = new Effect(fs); e.setParams(D);
    const L = new Float32Array(fs), R = new Float32Array(fs);
    if (pre) { e.process(sine(41.2, fs, fs, 0.3), L, R); for (let k = 0; k < 30; k++) e.process(new Float32Array(fs), L, R); }
    const t0 = performance.now(); for (let k = 0; k < 4; k++) e.process(new Float32Array(fs), L, R); const ms = performance.now() - t0;
    e.destroy(); return ms / 4;
  };
  const rest = Math.min(quiet(false), quiet(false)), after = Math.min(quiet(true), quiet(true));
  check(after < 2 * rest + 1, 'CPU: the silence after a note costs what silence from rest does (no denormals)', `${after.toFixed(1)} ms a second after a note, ${rest.toFixed(1)} ms from rest`);
  const n = 10 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 55 * i) / fs) * Math.exp(-(i % fs) / (0.3 * fs)));
  const e = new Effect(fs); e.setParams(preset('Quack (band-pass)'));
  const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
  e.process(inp, L, R);
  const share = (performance.now() - t0) / 1000 / 10;
  e.destroy();
  check(share < 0.02, 'CPU: under 2 % of a core (WebAssembly)', `${(100 * share).toFixed(2)} %`);
}

done();
