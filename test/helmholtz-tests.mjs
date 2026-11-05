// helmholtz-tests.mjs — Helmholtz's Resonators against the resonators worked out independently of the
// C++ (test/helmholtz-circuit.mjs): each one's pitch from Helmholtz's own formula and table; the
// radiation's Q as a monopole's; the driven oscillator; the limits (the inside following the outside
// below the resonance, falling 12 dB an octave above it); then the engine against the model; the
// hints and the README's numbers.

import { check, done, CI } from './harness.mjs';
import { loadPedal } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { db, sine } from '../tools/audio-util.mjs';
import { GLASS, air, pitch, NECK, resonator, response } from './helmholtz-circuit.mjs';
import { readFileSync } from 'node:fs';

const { PEDAL, Effect } = await loadPedal('helmholtz');
const x = Effect.exports;
const fs = 48000;
const D = { ...defaults(PEDAL.groups), level: 0, ear: -60 };
const W = (over) => ({ ...D, ...over });
const knob = (id) => PEDAL.groups.flatMap((g) => g.params).find((p) => p.id === id).hint;
const rel = (a, b) => Math.abs(a / b - 1);
const abs = ([a, b]) => Math.hypot(a, b);

function call(fn, P, extra = [], args = []) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length).set(v);
  if (extra.length) s.f64(extra.length, 8 * v.length).set(extra);
  x[fn](s.at, ...args);
  return { n: v.length, read: (count, at = 0) => Array.from(s.f64(count, 8 * at)) };
}
function cppParts(P) {
  const r = call('helmholtz_parts', P).read(65);
  return {
    c: r[0], rho: r[1], mu: r[2], one: r[3], tail: r[4],
    res: Array.from({ length: 10 }, (_, k) => { const o = r.slice(5 + 6 * k, 11 + 6 * k); return { f0: o[0], Q: o[1], Qrad: o[2], Qvisc: o[3], r: o[4], neck: o[5] }; }),
  };
}
function cppResponse(P, freqs, which = -1) {
  const out = [];
  for (let i = 0; i < freqs.length; i += 2000) {
    const f = freqs.slice(i, i + 2000), c = call('helmholtz_response', P, f, [f.length, which]), r = c.read(2 * f.length, c.n + f.length);
    f.forEach((_, j) => out.push([r[2 * j], r[2 * j + 1]]));
  }
  return out;
}
function run(P, input, rate = fs, block = 128) {
  const e = new Effect(rate);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length);
  let ok = true;
  for (let i = 0; i < input.length; i += block) { const j = Math.min(input.length, i + block); ok = e.process(input.subarray(i, j), L.subarray(i, j), R.subarray(i, j)) && ok; }
  e.destroy();
  return { L, R, ok };
}
// the steady response to a sine at f over its last second, as (re, im) against the sine's
function steady(P, f, amp = 0.01, seconds = 4) {
  const n = seconds * fs, y = run(P, sine(f, fs, n, amp)).L;
  let a = 0, b = 0;
  for (let i = n - fs; i < n; i++) { a += y[i] * Math.sin((2 * Math.PI * f * i) / fs); b += y[i] * Math.cos((2 * Math.PI * f * i) / fs); }
  return [(2 * a) / fs / amp, (-2 * b) / fs / amp];
}

// 1. Helmholtz's resonators and his formula
{
  const p = cppParts(W({}));
  let worst = 0;
  p.res.forEach((o, k) => { worst = Math.max(worst, rel(o.f0, pitch(GLASS[k])), rel(o.r, GLASS[k][1] / 2000), rel(o.neck, NECK * GLASS[k][1] / 2000)); });
  check(worst < 1e-4, 'his ten glass resonators, each ringing where his formula with his measured coefficient puts it, n = 47000 σ^¼/√S, at the air\'s sound speed (to the five figures of his 56174)', `worst ${worst.toExponential(1)}`);
  check(NECK.toFixed(3) === '0.544', 'the neck that gives his coefficient, 0.544 of the opening\'s radius, with 0.85 r of end correction at each end', NECK.toFixed(4));
  const theory = 332260 / (Math.SQRT2 * Math.PI ** 1.25);
  check(rel(theory, 56174) < 1e-3, 'his theoretical coefficient for an orifice in a thin wall, a/(√2 π^(5/4)) at 332.26 m/s: 56174', theory.toFixed(0));
  const a0 = air(0), a20 = air(20);
  check(a20.c.toFixed(1) === '343.2' && a0.c.toFixed(1) === '331.3' && Math.abs(p.c - 343.2) < 1e-9, 'the air: 343.2 m/s at 20 °C, 331.3 at 0 °C', `${a20.c.toFixed(2)} ${a0.c.toFixed(2)}`);
}

// 2. the losses
{
  let worst = 0;
  for (const [o, T] of [[{}, 20], [{ opening: 50 }, 20], [{ opening: 140, temperature: 0 }, 0]]) {
    const p = cppParts(W(o));
    p.res.forEach((r, k) => { const want = resonator(GLASS[k], (o.opening ?? 100) / 100, T); worst = Math.max(worst, rel(r.f0, want.f0), rel(r.Qrad, want.Qrad), rel(r.Qvisc, want.Qvisc), rel(r.Q, want.Q)); });
  }
  check(worst < 1e-9, 'each resonator\'s Q: its neck\'s radiation, ¼ (k r)² ρc, the same as a monopole\'s 4π/(k³V), and the viscous drag of its walls by Kirchhoff', `worst ${worst.toExponential(1)}`);
  const p = cppParts(W({})), qs = p.res.map((r) => r.Q);
  check(Math.min(...qs) > 50 && Math.max(...qs) < 120 && p.res.every((r) => r.Qrad < r.Qvisc || r === p.res[7]), 'the radiation takes most of the energy, but in the narrow-mouthed eighth: Q 61 to 108', qs.map((q) => q.toFixed(0)).join(' '));
}

// 3. the response: the driven oscillator
{
  let worst = 0;
  for (const o of [{}, { opening: 60, temperature: 35 }]) {
    const P = W(o), p = cppParts(P);
    for (let k = 0; k < 10; k++) {
      const fr = [0.2, 0.7, 0.98, 1, 1.03, 2, 5].map((m) => m * p.res[k].f0), got = cppResponse(P, fr, k), want = fr.map((f) => response(resonator(GLASS[k], (o.opening ?? 100) / 100, o.temperature ?? 20), f));
      got.forEach((g, i) => { worst = Math.max(worst, Math.hypot(g[0] - want[i][0], g[1] - want[i][1]) / abs(want[i])); });
    }
  }
  check(worst < 1e-9, 'the pressure inside for a pascal outside, ω0²/(ω0² − ω² − iωω0/Q), against the oscillator worked out on its own', `worst ${worst.toExponential(1)}`);
  const P = W({}), p = cppParts(P), r0 = p.res[0];
  const [low, peak, high] = cppResponse(P, [r0.f0 / 10, r0.f0, 8 * r0.f0], 0).map(abs);
  check(Math.abs(low - 1) < 0.02 && rel(peak, r0.Q) < 1e-9 && Math.abs(db(high) + 36) < 0.3, 'below the resonance the air inside follows the air outside; at it, Q times; above it, falling 12 dB an octave (36 dB down at three octaves)', `${low.toFixed(3)}, ${peak.toFixed(1)} against Q ${r0.Q.toFixed(1)}, ${db(high).toFixed(1)} dB`);
}

// 4. the engine against the model
{
  let worst = 0;
  const rows = [];
  for (const [o, ks] of [[{}, [0.3, 0.9, 1, 1.1, 3]], [{ glass: 5, opening: 70 }, [0.5, 1, 2]], [{ glass: 10, temperature: -5 }, [0.25, 1, 1.5]]]) {
    const P = W(o), r = cppParts(P).res[P.glass - 1];
    for (const m of ks) {
      const f = m * r.f0, got = steady(P, f), want = cppResponse(P, [f])[0];
      worst = Math.max(worst, abs([got[0] - want[0], got[1] - want[1]]) / abs(want));
      rows.push(`${f.toFixed(1)} Hz ${db(abs(got) / abs(want)).toFixed(2)} dB`);
    }
  }
  check(worst < 0.03, 'the engine, a sine steady at the ear, against the model\'s response: within 3 % in amplitude and phase', rows.join(', '));
  const P = W({ ear: 0, level: -6 }), f = 100, got = steady(P, f), h = cppResponse(P, [f])[0], g = 10 ** (-6 / 20);
  check(abs([got[0] - g * (h[0] + 1), got[1] - g * h[1]]) < 0.02 * g * abs([h[0] + 1, h[1]]), 'the other ear adds the bass as it is, and the Level scales the two', `${abs(got).toFixed(3)} against ${(g * abs([h[0] + 1, h[1]])).toFixed(3)}`);
}

// 5. the hints
{
  const tell = (got, want, text) => check(got === want, `the hint (${text})`, got);
  const p = cppParts(W({}));
  tell(`${GLASS[0][0]} ${p.res[0].f0.toFixed(1)} ${GLASS[9][0]} ${p.res[9].f0.toFixed(1)}`, '154 204.5 43 920.2', 'Resonator): the largest, 154 mm across, at 204.5 Hz; the smallest, 43 mm, at 920.2 Hz');
  check(PEDAL.expression === 'glass' && /expression pedal/.test(knob('glass')), 'an expression pedal steps through the resonators');
  const n70 = cppParts(W({ opening: 70 })).res[0], n30 = cppParts(W({ opening: 30 })).res[0];
  tell(`${n70.f0.toFixed(0)} ${n70.Q.toFixed(0)} ${p.res[0].Q.toFixed(0)} ${n30.Q.toFixed(0)}`, '163 124 105 43', 'Opening): at 70 %, 163 Hz and a Q of 124, against 105; at 30 %, 43');
  const sharpest = [];
  for (let o = 30; o <= 150; o += 1) sharpest.push([o, cppParts(W({ opening: o })).res[0].Q]);
  const best = sharpest.reduce((a, b) => (b[1] > a[1] ? b : a));
  tell(String(Math.abs(best[0] - 70) <= 5), 'true', `Opening): the Q highest at about 70 % (${best[0]} %)`);
  const cold = cppParts(W({ temperature: 0 }));
  tell(`${p.c.toFixed(1)} ${cold.c.toFixed(1)} ${(100 * (1 - cold.res[0].f0 / p.res[0].f0)).toFixed(1)}`, '343.2 331.3 3.5', 'Temperature): 343.2 m/s at 20 °C, 331.3 at 0 °C, the pitch 3.5 % lower');
  const below = abs(steady(W({}), 20)), atRes = abs(steady(W({}), p.res[0].f0));
  tell(`${below.toFixed(2)} ${(atRes / p.res[0].Q).toFixed(2)}`, '1.01 1.00', 'Level): at 0 dB the bass far below the resonance comes out as it went in, Q times at it');
  const hints = PEDAL.groups.flatMap((g) => g.params).map((q) => q.hint);
  check(hints.every((h) => h && !/TODO/.test(h)), 'every knob has its hint');
}

// 6. the README's numbers
{
  const md = readFileSync(new URL('../helmholtz/README.md', import.meta.url), 'utf8');
  const p = cppParts(W({}));
  const table = p.res.every((r, k) => md.includes(`| ${k + 1} | ${GLASS[k][0]} | ${GLASS[k][1]} | ${GLASS[k][2]} | ${r.f0.toFixed(1)} | ${r.Q.toFixed(0)} |`));
  check(table, 'the README: its table of the ten resonators, their pitches and their Qs, is the model\'s');
  const off = db(abs(cppResponse(W({}), [1.01 * p.res[0].f0], 0)[0]) / abs(cppResponse(W({}), [p.res[0].f0], 0)[0]));
  check(off.toFixed(1) === '-7.4', 'the README: a partial 1 % off the largest\'s pitch comes through 7.4 dB under one on it', off.toFixed(2));
  const tuned = cppParts(W({ opening: 112.6 })).res[0], mid = cppParts(W({ glass: 5 }));
  const nums = `${tuned.f0.toFixed(1)} ${tuned.Q.toFixed(0)} ${p.tail.toFixed(2)} ${mid.tail.toFixed(2)}`;
  check(nums === '220.0 92 1.13 0.52', 'the README: opened to 112.6 % the largest rings at 220.0 Hz with a Q of 92; it rings on 1.13 s, the fifth 0.52 s', nums);
}

// 7. hygiene
{
  const r = run(W({}), new Float32Array(fs));
  check(Math.max(...r.L.map(Math.abs)) === 0, 'silence in, silence out');
  check(r.R.every((v, i) => v === r.L[i]), 'mono out on both sides');
  // the resonator stepped and the knobs turned mid-note: no step past the note's own, for its height
  const n = 2 * fs, inp = sine(204.5, fs, n, 0.01), L = new Float32Array(n), R = new Float32Array(n);
  const e = new Effect(fs);
  e.setParams(W({ ear: 0 }));
  for (let i = 0; i < n; i += 128) {
    if (i >= n / 2 && i < n / 2 + 12800) { const t = (i - n / 2) / 12800; e.setParams(W({ ear: -30 * t, glass: 1 + Math.floor(3 * t), opening: 100 - 20 * t, level: -6 * t, temperature: 20 + 10 * t })); }
    e.process(inp.subarray(i, i + 128), L.subarray(i, i + 128), R.subarray(i, i + 128));
  }
  e.destroy();
  const worstStep = (a, b) => {
    let worst = 0;
    for (let i = a; i < b; i += 1024) {
      let step = 0, height = 0;
      for (let j = i; j < i + 1024; j++) { step = Math.max(step, Math.abs(L[j] - L[j - 1])); height = Math.max(height, Math.abs(L[j])); }
      if (height > 0) worst = Math.max(worst, step / height);
    }
    return worst;
  };
  const before = worstStep(n / 4, n / 2), after = worstStep(n / 2, n - 1024);
  check(L.every(Number.isFinite) && after < 1.5 * before, 'the resonator stepped and every knob turned mid-note glide: no step past the note\'s own, for its height', `${(1e3 * after).toFixed(1)} of the height a sample against ${(1e3 * before).toFixed(1)}`);
  const e2 = new Effect(fs);
  e2.setParams(W({}));
  const bad = new Float32Array(128); bad[5] = NaN;
  const L2 = new Float32Array(4096), R2 = new Float32Array(4096);
  const ok = e2.process(bad, L2.subarray(0, 128), R2.subarray(0, 128));
  e2.process(sine(100, fs, 4096, 0.3), L2, R2);
  check(!ok && L2.every(Number.isFinite) && Math.max(...L2.map(Math.abs)) > 0.05, 'a NaN in comes out as a silent block, and the pedal recovers');
  e2.destroy();
  // its tail: the resonator at the ear rung and left, 60 dB down after tail()
  const p = cppParts(W({})), m = Math.ceil((p.tail + 0.2) * fs), imp = new Float32Array(m); imp[0] = 1;
  const y = run(W({}), imp).L, peak = Math.max(...y.slice(0, fs / 10).map(Math.abs));
  const at = Math.round(p.tail * fs), late = Math.max(...y.slice(at, at + 480).map(Math.abs));
  check(Math.abs(db(late / peak) + 60) < 3, 'its tail: the resonator at the ear rung and left is 60 dB down after it', `${db(late / peak).toFixed(1)} dB at ${p.tail.toFixed(2)} s`);
}

// 8. presets stay in range, and set real choices
{
  const ids = new Map(PEDAL.groups.flatMap((g) => g.params).map((p) => [p.id, p]));
  const bad = Object.entries(PEDAL.presets).flatMap(([nm, v]) => Object.entries(v).filter(([id, val]) => {
    const p = ids.get(id);
    if (!p) return true;
    if (p.type === 'select') return !p.options.some(([o]) => o === val);
    return typeof val === 'number' && (val < p.min || val > p.max || (p.step && Math.abs(val - p.min) % p.step));
  }).map(([id]) => `${nm}: ${id}`));
  check(!bad.length, 'every preset sets real parameters inside their ranges', bad.join(', '));
}

// 9. CPU
if (!CI) {
  const n = 10 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.8 * Math.sin((2 * Math.PI * 41.2 * i) / fs) * Math.exp(-(i % fs) / fs));
  for (const rate of [48000, 96000]) {
    const e = new Effect(rate);
    e.setParams(W({}));
    const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
    for (let i = 0; i < n; i += 128) e.process(inp.subarray(i, i + 128), L.subarray(i, i + 128), R.subarray(i, i + 128));
    const share = (performance.now() - t0) / 1000 / (n / rate);
    e.destroy();
    check(share < 0.03, `CPU: ten resonators at ${rate / 1000} kHz under 3 % of a core (WebAssembly)`, `${(100 * share).toFixed(1)} %`);
  }
}

done();
