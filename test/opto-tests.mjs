// opto-tests.mjs — the Opto Compressor against physics written here, independently of the C++
// (test/opto-circuit.mjs): the cell's steady state in closed form, its release as the linearised
// rate equations' two eigenmodes, the quasi-static gain from Simpson's rule and the secant method;
// then the engine against those, against the published timing of the electro-optical leveler it
// follows (attack 10 ms; release 60 ms for half, 0.5–5 s for all of it: Universal Audio's LA-2A
// specification), the hints, and the usual hygiene.

import { check, done, CI } from './harness.mjs';
import { loadPedal, loadBass } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { amplitudeAt, db, sine, peak, rms } from '../tools/audio-util.mjs';
import { tune } from '../shared/tuner.js';
import { model, atten, nFromAtten, steady, integrate, linearRelease, quasiStatic, emission, drive, TRAPS } from './opto-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('opto');
const x = Effect.exports;
const fs = 48000;
const D = defaults(PEDAL.groups);
const W = (over) => ({ ...D, ...over });

function cppStatic(P, amps) {
  const s = scratch(x), v = Effect.native(P), n = amps.length;
  s.f64(v.length).set(v);
  s.f64(n, 8 * v.length).set(amps);
  x.opto_static(s.at, n);
  const out = Array.from(s.f64(2 * n, 8 * (v.length + n)));
  return { gr: out.slice(0, n), n: out.slice(n) };
}
function cell(e) {
  const s = scratch(x);
  x.opto_cell(x.px_effect(e.h), s.at);
  const [n, m, light] = s.f64(3);
  return { n, m, light };
}
function run(P, input) {
  const e = new Effect(fs);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length);
  const ok = e.process(input, L, R);
  const out = { L, R, ok, messages: e.messages().filter((m) => m.type === 1), cell: cell(e), latency: e.latency() };
  e.destroy();
  return out;
}
// the cell's gain reduction (dB) every millisecond as the input plays
function track(P, input) {
  const e = new Effect(fs), M = model(P), rest = atten(M, 0), ms = 48;
  e.setParams(P);
  const L = new Float32Array(ms), R = new Float32Array(ms), gr = [], states = [];
  for (let at = 0; at + ms <= input.length; at += ms) {
    e.process(input.subarray(at, at + ms), L, R);
    const c = cell(e);
    states.push(c);
    gr.push(db(atten(M, c.n) / rest));
  }
  e.destroy();
  return { gr, states };
}
// a tone burst of `seconds` at amplitude A, then `after` seconds of silence
const burst = (A, seconds, after, f = 220) => Float32Array.from({ length: Math.round((seconds + after) * fs) }, (_, i) => (i < seconds * fs ? A * Math.sin((2 * Math.PI * f * i) / fs) : 0));
const firstAt = (arr, from, pred) => { for (let i = from; i < arr.length; i++) if (pred(arr[i])) return i - from; return Infinity; };

// 1. the model: a steady light leaves the cell where the closed form says
{
  const M = model(D);
  let worst = 0;
  for (const light of [0.01, 0.2, 1, 4]) {
    const want = steady(M, light), got = integrate(M, () => light, 0, 0, 40, 2e-4);
    worst = Math.max(worst, Math.abs(got.n / want.n - 1), Math.abs(got.m / want.m - 1));
  }
  check(worst < 1e-3, 'model: under a steady light the free electrons settle where Λ = n(1 + n/n₁), and the traps where capture balances release', `worst ${(100 * worst).toFixed(3)} %`);
}

// 2. the C++ quasi-static curve is the one written here
{
  const amps = [0.01, 0.03, 0.1, 0.3, 1, 3];
  let worst = 0;
  for (const P of [W({}), W({ peak: 0.85 }), W({ sense: 'input' }), W({ swing: 60, peak: 0.9 }), W({ litR: 500, panelB: 40 })]) {
    const c = cppStatic(P, amps).gr, M = model(P), rest = atten(M, 0);
    amps.forEach((A, i) => { worst = Math.max(worst, Math.abs(c[i] - db(quasiStatic(M, A) / rest))); });
  }
  check(worst < 0.02, 'model: the C++ quasi-static gain reduction is the one found here (Simpson and the secant method)', `worst ${worst.toFixed(4)} dB`);
}

// 3. the engine settles on the quasi-static curve (a 1 kHz tone, where the cell can't follow the
// panel's flicker)
{
  let worst = 0, detail = [];
  for (const P of [W({}), W({ peak: 0.85 }), W({ sense: 'input', peak: 0.5 })]) for (const A of [0.1, 0.3, 1]) {
    const r = run(P, sine(1000, fs, 8 * fs, A));
    const got = db(amplitudeAt(r.L.subarray(7 * fs), 1000, fs) / (A * 10 ** (P.gain / 20))), M = model(P);
    const want = db(quasiStatic(M, A));
    worst = Math.max(worst, Math.abs(got - want));
    detail.push(`${got.toFixed(2)}/${want.toFixed(2)}`);
  }
  check(worst < 0.25, 'engine: a steady 1 kHz tone settles on the quasi-static curve', `worst ${worst.toFixed(3)} dB (${detail.join(', ')})`);
}

// 4. the timing, against the leveler's published specification
let spec;
{
  const P = W({ peak: 0.7 }), held = 1, input = burst(0.5, held, 6);
  const { gr } = track(P, input), end = Math.round(held * 1000) - 1, g0 = gr[end];
  const attack = firstAt(gr, 0, (g) => g < 0.9 * g0), half = firstAt(gr, end, (g) => g > 0.5 * g0), all = firstAt(gr, end, (g) => g > -0.25);
  spec = { attack, half, all, g0 };
  check(attack >= 4 && attack <= 20, 'attack: about 10 ms to 90 % of the gain reduction (the specification: 10 ms)', `${attack} ms to 90 % of ${g0.toFixed(1)} dB`);
  check(half >= 35 && half <= 100, 'release: about 60 ms for half of it (the specification: 0.06 s)', `${half} ms`);
  check(all >= 500 && all <= 5000, 'and 0.5 to 5 s for all of it (the specification), within a quarter of a decibel', `${all} ms`);
}

// 5. the release in the dark is the rate equations' own: two eigenmodes when the cell is lightly lit
{
  const P = W({ peak: 0.3 }), M = model(P);
  const { states } = track(P, burst(0.2, 1.5, 3));
  const t0 = 1500 + 20, s0 = states[t0 - 1]; // 20 ms after the light goes: the phosphor is dark
  const lin = linearRelease(M, s0.n, s0.m);
  let worstExact = 0, worstLin = 0;
  for (const t of [0.01, 0.05, 0.2, 0.5, 1, 2]) {
    const k = t0 - 1 + Math.round(1000 * t), got = states[k].n;
    const exact = integrate(M, () => 0, s0.n, s0.m, t, 1e-4).n;
    worstExact = Math.max(worstExact, Math.abs(got / exact - 1));
    worstLin = Math.max(worstLin, Math.abs(got / lin.n(t) - 1));
  }
  check(s0.n < 0.05 && worstExact < 0.01, 'engine: in the dark the cell\'s electrons follow the rate equations, integrated here by Runge–Kutta', `n from ${s0.n.toFixed(4)}; worst ${(100 * worstExact).toFixed(2)} %`);
  check(worstLin < 0.06, `and, lightly lit, the linearised equations' two modes: ${(1000 * lin.fast).toFixed(0)} ms and ${lin.slow.toFixed(2)} s`, `worst ${(100 * worstLin).toFixed(1)} %`);
}

// 6. memory: the longer the cell is lit, the longer the last decibels take to come back
{
  const P = W({ peak: 0.7 });
  const rel = (held) => { const { gr } = track(P, burst(0.5, held, 6)); return firstAt(gr, Math.round(held * 1000) - 1, (g) => g > -1); };
  const short = rel(0.15), long = rel(4);
  check(long > 3 * short, 'memory: after 4 s of compression the last decibel takes far longer to come back than after 0.15 s', `${short} ms against ${long} ms to within 1 dB`);
}

// 7. the hints
const settled = (P, A, f = 220, s = 5) => { const r = run(P, sine(f, fs, s * fs, A)); return db(amplitudeAt(r.L.subarray((s - 1) * fs), f, fs) / A); };
const grOf = (P, A, f = 220) => settled(P, A, f) - P.gain;
{
  const steps = [0.3, 0.5, 0.7, 0.9].map((p) => grOf(W({ peak: p }), 0.3));
  check(steps.every((g, i) => !i || g < steps[i - 1] - 1), 'Peak Reduction: turned up, a 0.3 V note is turned down further', steps.map((g) => g.toFixed(1)).join(' → ') + ' dB');
  const hard = grOf(W({ peak: 0.3 }), 0.3), soft = grOf(W({ peak: 0.3 }), 0.1), gentle = grOf(W({ peak: 0.72 }), 0.03);
  check(hard < -2 && soft > -0.5 && gentle < -3, 'at 30 % only hard notes reach it; past 70 % even a gentle 30 mV note loses several decibels', `30 %: ${soft.toFixed(2)} dB at 0.1 V, ${hard.toFixed(1)} dB at 0.3 V; 72 %: ${gentle.toFixed(1)} dB at 30 mV`);
  const g0 = grOf(W({ gain: 0 }), 0.3), g20 = grOf(W({ gain: 20 }), 0.3);
  check(Math.abs(g0 - g20) < 0.01, 'Gain: make-up only; how hard it compresses is unchanged', `${g0.toFixed(3)} against ${g20.toFixed(3)} dB`);
  const a = settled(W({ gain: 0 }), 0.3), b = settled(W({ gain: 6.0206 }), 0.3);
  check(Math.abs(b - a - 6.0206) < 0.01, 'and +6 dB doubles the output', `${(b - a).toFixed(3)} dB`);
  // Sense: feedback, louder in is always louder out; feed-forward dug in, louder in comes out quieter
  const levels = [0.02, 0.04, 0.08, 0.16, 0.32, 0.64];
  const outFb = levels.map((A) => settled(W({ peak: 0.5 }), A) + db(A)), outFf = levels.map((A) => settled(W({ peak: 0.5, sense: 'input' }), A) + db(A));
  check(outFb.every((o, i) => !i || o > outFb[i - 1]), 'Sense, after the cell: louder in is always a little louder out', outFb.map((o) => o.toFixed(1)).join(', ') + ' dBV');
  check(outFf.some((o, i) => i && o < outFf[i - 1]), 'before it, dug in hard enough, a louder note comes out quieter', outFf.map((o) => o.toFixed(1)).join(', ') + ' dBV');
  // the attack, each set for the same 8 dB on a 0.2 V note
  const attackFor = (o) => { let lo = 0, hi = 1; for (let k = 0; k < 14; k++) { const p = (lo + hi) / 2; if (grOf(W({ ...o, peak: p }), 0.2) < -8) hi = p; else lo = p; } const gr = track(W({ ...o, peak: lo }), burst(0.2, 1, 0)).gr; return firstAt(gr, 0, (g) => g < 0.9 * gr[gr.length - 1]); };
  const aFb = attackFor({}), aFf = attackFor({ sense: 'input' });
  check(aFb <= 15 && aFf > 3 * aFb, 'after the cell, it catches a note in about 10 ms; before it, set for the same gain reduction, it settles more slowly and lets the front through', `${aFb} ms to 90 % of 8 dB after the cell, ${aFf} ms before it`);
  // Clean blend: the dry signal back after the make-up gain
  const pl = burst(0.5, 0.5, 0), dry = run(W({ blend: 1, gain: 0 }), pl).L;
  check(dry.every((v, i) => Math.abs(v - pl[i]) < 1e-6), 'Clean blend all the way up: the dry signal unchanged');
  const at40 = grOf(W({ peak: 0.85, blend: 0.4 }), 0.5), at0 = grOf(W({ peak: 0.85 }), 0.5);
  check(at40 > at0 + 3, 'and blended in, less of the gain reduction is heard', `${at0.toFixed(1)} → ${at40.toFixed(1)} dB`);
}
{
  // the panel
  const b40 = grOf(W({ panelB: 40, peak: 0.5 }), 0.15), b100 = grOf(W({ panelB: 100, peak: 0.5 }), 0.15);
  check(b100 > b40 + 1, 'Panel\'s voltage constant: larger, it lights on fewer notes', `${b40.toFixed(1)} dB at 40 √V, ${b100.toFixed(1)} at 100 √V (0.15 V)`);
  const att = (b) => { const P = W({ panelB: b }); let lo = 0, hi = 1; for (let k = 0; k < 12; k++) { const p = (lo + hi) / 2; if (grOf({ ...P, peak: p }, 0.5) < -10) hi = p; else lo = p; } const gr = track({ ...P, peak: lo }, burst(0.5, 0.5, 0)).gr; return firstAt(gr, 0, (g) => g < 0.9 * gr[gr.length - 1]); };
  const a40 = att(40), a100 = att(100);
  check(a100 < a40, 'and its flare makes the attack faster, for the same gain reduction', `${a40} ms at 40 √V, ${a100} ms at 100 √V, to 90 % of 10 dB`);
  const thd = (P, f) => { const s = 4 * fs, y = run(P, sine(f, fs, s, 0.5)).L.subarray(3 * fs); const h1 = amplitudeAt(y, f, fs); return db(Math.sqrt([2, 3, 4, 5].reduce((t, k) => t + amplitudeAt(y, k * f, fs) ** 2, 0)) / h1); };
  const low = thd(W({ peak: 0.8 }), 41.2), high = thd(W({ peak: 0.8 }), 1000), lowLong = thd(W({ peak: 0.8, afterglow: 8e-3 }), 41.2);
  check(low > high + 10, 'Afterglow: the panel flashes on every half-cycle, so a low E flickers the cell and distorts more than a high note', `low E ${low.toFixed(1)} dB, 1 kHz ${high.toFixed(1)} dB`);
  check(lowLong < low - 3, 'a longer afterglow smooths the flicker: less low-note distortion', `${low.toFixed(1)} → ${lowLong.toFixed(1)} dB at 8 ms`);
  const s150 = grOf(W({ peak: 1 }), 2), s60 = grOf(W({ peak: 1, swing: 60 }), 2);
  check(s60 > s150 + 2, 'Driver\'s swing: lower, the loudest notes are turned down less', `${s150.toFixed(1)} dB at 150 V, ${s60.toFixed(1)} dB at 60 V`);
}
{
  // the cell
  const lit = [500, 2e3, 8e3].map((r) => grOf(W({ litR: r }), 0.3));
  check(lit[0] < lit[1] && lit[1] < lit[2], 'Cell\'s resistance, lit: lower, more gain reduction', lit.map((g) => g.toFixed(1)).join(', ') + ' dB at 0.5, 2, 8 kΩ');
  const rest = (r) => settled(W({ darkR: r, gain: 0 }), 1e-3);
  check(Math.abs(rest(5e6) + 0.081) < 0.01 && Math.abs(rest(0.5e6) + 0.78) < 0.02, 'Dark resistance: the loss at rest, 0.1 dB at 5 MΩ, 0.8 dB at 0.5 MΩ', `${rest(5e6).toFixed(3)} and ${rest(0.5e6).toFixed(3)} dB`);
  const timing = (o) => { const { gr } = track(W({ peak: 0.7, ...o }), burst(0.5, 1, 3)); const end = 999; return { half: firstAt(gr, end, (g) => g > 0.5 * gr[end]), attack: firstAt(gr, 0, (g) => g < 0.9 * gr[end]), last: firstAt(gr, end, (g) => g > -0.5) }; };
  const quick = timing({ lifetime: 20e-3 }), slow = timing({ lifetime: 150e-3 });
  check(quick.half < spec.half && spec.half < slow.half && quick.attack <= spec.attack && spec.attack <= slow.attack, 'Carrier lifetime: shorter, a quicker release and attack; longer, both slower', `half release ${quick.half}, ${spec.half}, ${slow.half} ms; attack ${quick.attack}, ${spec.attack}, ${slow.attack} ms (20, 60, 150 ms)`);
  const t1 = timing({ trapTime: 0.5 }).last, t6 = timing({ trapTime: 6 }).last;
  check(t6 > 2 * t1, 'Trap release time: longer, the last decibels come back later', `${t1} ms at 0.5 s, ${t6} ms at 6 s, to within 0.5 dB`);
}

// 8. what it does to a bass: the test bass's notes come out more even
const TB = await loadBass();
function notes(list) {
  const b = new TB(fs), out = new Float32Array(Math.round(list.length * 0.5 * fs));
  list.forEach(([key, vel], i) => { b.note(key, vel); b.process(out.subarray(Math.round(i * 0.5 * fs), Math.round((i + 1) * 0.5 * fs))); });
  return out;
}
{
  const dry = notes([[28, 0.3], [28, 1], [28, 0.5], [28, 0.9]]), y = run(W({}), dry).L;
  // each note's level once the cell has caught it, 50 to 400 ms after it is plucked
  const levels = (v) => [0, 1, 2, 3].map((i) => rms(v.subarray(Math.round((i * 0.5 + 0.05) * fs), Math.round((i * 0.5 + 0.4) * fs))));
  const spread = (p) => db(Math.max(...p) / Math.min(...p));
  check(spread(levels(y)) < spread(levels(dry)) - 3, 'soft and hard notes from the test bass come out closer in level', `${spread(levels(dry)).toFixed(1)} dB apart in, ${spread(levels(y)).toFixed(1)} dB out`);
  const one = notes([[33, 0.8]]), z = run(W({}), one).L;
  const f0 = tune(z.subarray(4800, 4800 + 16384), fs), want = tune(one.subarray(4800, 4800 + 16384), fs);
  check(f0 && want && Math.abs(1200 * Math.log2(f0 / want)) < 1, 'and keep their pitch, to the tuner\'s eye', `${f0?.toFixed(3)} Hz out for ${want?.toFixed(3)} Hz in`);
}

// 9. the page's messages
{
  const r = run(W({ peak: 0.7 }), burst(0.5, 1, 0.5));
  const m = r.messages;
  check(m.length >= 140 && m.every((q) => q.values.length >= 8), 'a message every 10 ms with the cell\'s state', `${m.length} in 1.5 s`);
  const at = m[95].values, M = model(W({ peak: 0.7 }));
  check(Math.abs(at[0] - db(atten(M, at[1]) / atten(M, 0))) < 0.01 && Math.abs(at[4] - 1 / (1 / M.darkR + at[1] / M.litR)) / at[4] < 1e-4 && at[2] > 0 && at[2] < 1, 'each one consistent: the gain reduction and the resistance are the electrons\'', `${at[0].toFixed(2)} dB, n ${at[1].toFixed(3)}, ${(at[4] / 1e3).toFixed(1)} kΩ, traps ${(100 * at[2]).toFixed(0)} % full`);
}

// 10. hygiene
{
  const r = run(W({}), new Float32Array(fs));
  check(peak(r.L) === 0 && r.cell.n === 0, 'silence in, silence out, and the cell stays dark');
  const e = new Effect(fs);
  e.setParams(W({}));
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

// 11. CPU
if (!CI) {
  // the silence after a note costs what silence from rest does: the cell's glow and electrons
  // decay without running into denormals
  const quiet = (pre) => {
    const e = new Effect(fs); e.setParams(W({}));
    const L = new Float32Array(fs), R = new Float32Array(fs);
    if (pre) { e.process(burst(0.5, 1, 0), L, R); for (let k = 0; k < 8; k++) e.process(new Float32Array(fs), L, R); }
    const t0 = performance.now(); for (let k = 0; k < 4; k++) e.process(new Float32Array(fs), L, R); const ms = performance.now() - t0;
    e.destroy(); return ms / 4;
  };
  quiet(false);
  const after = quiet(true), rest = quiet(false);
  check(after < 2 * rest + 1, 'CPU: the silence after a note costs what silence from rest does (no denormals)', `${after.toFixed(1)} ms a second after a note, ${rest.toFixed(1)} ms from rest`);
  const n = 10 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 82.4 * i) / fs) * Math.exp(-(i % fs) / fs));
  const e = new Effect(fs);
  e.setParams(W({}));
  const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
  e.process(inp, L, R);
  const share = (performance.now() - t0) / 1000 / 10;
  e.destroy();
  check(share < 0.03, 'CPU: under 3 % of a core (WebAssembly)', `${(100 * share).toFixed(2)} %`);
}

done();
