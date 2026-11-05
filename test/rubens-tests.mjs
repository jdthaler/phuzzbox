// rubens-tests.mjs — Rubens' Tube against the pipe worked out independently of the C++
// (test/rubens-circuit.mjs): the gases' constants from NIST's numbers; Kirchhoff's losses; the
// C++'s sum of modes against the pipe as a transmission line in closed form, driven by the speaker;
// the limits (the modes at n c/2L, the speaker damping the lowest, a microphone in the middle
// hearing only the even modes); then the engine against the model; and each knob's hint.

import { check, done, CI } from './harness.mjs';
import { loadPedal } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { db, sine } from '../tools/audio-util.mjs';
import { GASES, gamma, prandtl, kirchhoff, pipe, response, C, meanFlow } from './rubens-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('rubens');
const x = Effect.exports;
const fs = 48000;
const D = { ...defaults(PEDAL.groups), level: 0 };
const W = (over) => ({ ...D, ...over });
const knob = (id) => PEDAL.groups.flatMap((g) => g.params).find((p) => p.id === id).hint;
const MIC = 0.001; // V/Pa

function call(fn, P, extra = [], args = []) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length).set(v);
  if (extra.length) s.f64(extra.length, 8 * v.length).set(extra);
  x[fn](s.at, ...args);
  return { n: v.length, read: (count, at = 0) => Array.from(s.f64(count, 8 * at)) };
}
function cppParts(P) {
  const r = call('rubens_parts', P).read(11);
  return { c: r[0], rho: r[1], mu: r[2], gamma: r[3], prandtl: r[4], St: r[5], cutoff: r[6], modes: r[7], xm: r[8], Sd: r[9], tail: r[10] };
}
const cppModes = (P) => { const n = cppParts(P).modes, r = call('rubens_modes', P).read(4 * n); return Array.from({ length: n }, (_, i) => ({ f0: r[4 * i], alpha: r[4 * i + 1], f: r[4 * i + 2], sigma: r[4 * i + 3] })); };
function cppResponse(P, freqs, at = -1) {
  const out = [];
  for (let i = 0; i < freqs.length; i += 1000) {
    const f = freqs.slice(i, i + 1000), c = call('rubens_response', P, f, [f.length, at]), r = c.read(4 * f.length, c.n + f.length);
    f.forEach((_, j) => out.push({ p: [r[4 * j], r[4 * j + 1]], v: [r[4 * j + 2], r[4 * j + 3]] }));
  }
  return out;
}
const logFreqs = (f0, f1, r) => { const f = []; for (let v = f0; v < f1; v *= r) f.push(v); return f; };
// the response's peaks (Hz) and their quality factors, by the half-power width
function peaks(P, f0 = 20, f1 = 1500, at = -1) {
  const fr = logFreqs(f0, f1, 1.0005), m = cppResponse(P, fr, at).map((r) => C.abs(r.p)), out = [];
  for (let i = 1; i < fr.length - 1; i++) {
    if (!(m[i] > m[i - 1] && m[i] >= m[i + 1])) continue;
    let j = i, k = i;
    while (j > 0 && m[j] > m[i] / Math.SQRT2) j--;
    while (k < fr.length - 1 && m[k] > m[i] / Math.SQRT2) k++;
    out.push({ f: fr[i], Q: fr[i] / (fr[k] - fr[j]), p: m[i] });
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
// the steady amplitude of a sine's response at f, over its last second
function steady(P, f, amp = 0.1, seconds = 4) {
  const n = seconds * fs, y = run(P, sine(f, fs, n, amp)).L;
  let a = 0, b = 0;
  for (let i = n - fs; i < n; i++) { a += y[i] * Math.cos((2 * Math.PI * f * i) / fs); b += y[i] * Math.sin((2 * Math.PI * f * i) / fs); }
  return (2 * Math.hypot(a, b)) / fs;
}
const rel = (a, b) => Math.abs(a / b - 1);

// 1. the gases and the pipe
{
  let worst = 0;
  for (const g of ['propane', 'methane']) {
    const c = cppParts(W({ gas: g })), G = GASES[g];
    worst = Math.max(worst, rel(c.c, G.c), rel(c.rho, G.rho), rel(c.mu, G.mu), rel(c.gamma, gamma(G)), rel(c.prandtl, prandtl(G)));
  }
  check(worst < 1e-12, 'the gases: NIST\'s sound speed, density and viscosity, Cp/Cv and the Prandtl number μ Cp/k from its numbers', `worst ${worst.toExponential(1)}`);
  const pr = cppParts(W({})), me = cppParts(W({ gas: 'methane' }));
  check(pr.gamma.toFixed(3) === '1.139' && pr.prandtl.toFixed(3) === '0.748' && me.gamma.toFixed(3) === '1.308' && me.prandtl.toFixed(3) === '0.728', 'propane\'s γ 1.139 and Pr 0.748; methane\'s 1.308 and 0.728', `${pr.gamma.toFixed(4)} ${pr.prandtl.toFixed(4)}; ${me.gamma.toFixed(4)} ${me.prandtl.toFixed(4)}`);
  check(rel(pr.cutoff, (1.8412 * 246.59) / (2 * Math.PI * 0.026)) < 1e-9 && pr.cutoff.toFixed(0) === '2779', 'the pipe carries plane waves only, below its first cross mode, 1.84 c/(2π a): 2779 Hz for the stock 5.2 cm bore of propane', pr.cutoff.toFixed(1));
  const m = cppModes(W({}));
  check(m.length === Math.floor(pr.cutoff / (246.59 / (2 * 1.524))) && m.every((o, i) => rel(o.f0, ((i + 1) * 246.59) / (2 * 1.524)) < 1e-12), 'its modes, n c/2L under the cutoff: 34 of them, 80.9 Hz apart', `${m.length}, ${m[0].f0.toFixed(2)} Hz`);
}

// 2. Kirchhoff's losses
{
  let worst = 0;
  for (const o of [{}, { gas: 'methane' }, { diameter: 12 }]) {
    const P = W(o), T = pipe(P);
    for (const md of cppModes(P)) worst = Math.max(worst, rel(md.alpha, kirchhoff(T.g, T.a, md.f0)), rel(md.sigma, T.g.c * md.alpha), Math.abs(md.f - (md.f0 - md.sigma / (2 * Math.PI))) / md.f);
  }
  check(worst < 1e-12, 'each mode loses to the walls\' boundary layers Kirchhoff\'s α = √(π f μ/ρ)(1 + (γ − 1)/√Pr)/(a c), dying at σ = c α and rung σ/2π lower', `worst ${worst.toExponential(1)}`);
  const m = cppModes(W({}));
  const Q1 = (Math.PI * m[0].f) / m[0].sigma;
  check(Q1.toFixed(0) === '172', 'the walls alone would let the first mode ring with a quality factor of 172', Q1.toFixed(1));
}

// 3. the sum of modes against the pipe in closed form, the speaker driving it
{
  const rows = [];
  let worst = 0, worstV = 0;
  for (const o of [{}, { gas: 'methane' }, { mic: 50 }, { mic: 30, length: 3 }, { diameter: 10 }, { length: 0.6, mic: 75 }]) {
    const P = W(o), cut = cppParts(P).cutoff, fr = logFreqs(20, 0.7 * cut, 1.003), cpp = cppResponse(P, fr);
    const peak = Math.max(...fr.map((f) => C.abs(response(P, f).p)));
    let w = 0;
    fr.forEach((f, i) => {
      const js = response(P, f), a = C.abs(js.p);
      if (a > peak / 100) w = Math.max(w, Math.abs(db(C.abs(cpp[i].p) / a)));
      worstV = Math.max(worstV, Math.abs(db(C.abs(cpp[i].v) / C.abs(js.v))));
    });
    worst = Math.max(worst, w);
    rows.push(`${JSON.stringify(o)} ${w.toFixed(2)}`);
  }
  check(worst < 0.6 && worstV < 0.6, 'the pressure at the microphone and the cone\'s velocity, summed over the modes, against the pipe as a transmission line in closed form: within 0.6 dB to 70 % of the cutoff (where within 40 dB of the loudest)', rows.join('; '));
}

// 4. the limits
{
  const P = W({}), pk = peaks(P), m = cppModes(P);
  const high = pk.filter((p) => p.f > 350 && p.f < 1500);
  const near = high.every((p) => { const n = Math.round(p.f / m[0].f0); return Math.abs(p.f / m[n - 1].f - 1) < 0.01; });
  check(near && high.length >= 10, 'above the speaker\'s range the peaks are the pipe\'s own modes, within 1 %: the cone is too heavy to move, and the pipe is closed at both ends', high.slice(0, 6).map((p) => p.f.toFixed(1)).join(', '));
  const wall = (n) => (Math.PI * m[n - 1].f) / m[n - 1].sigma;
  check(pk[0].Q < wall(1) / 5 && pk[1].Q < wall(2) / 3, 'the speaker damps the lowest modes most (as Gardner, Gee and Dix found): the first peak\'s Q a fifth or less of the walls\' alone', `${pk[0].Q.toFixed(0)} against ${wall(1).toFixed(0)}, ${pk[1].Q.toFixed(0)} against ${wall(2).toFixed(0)}`);
  const odd = cppResponse(W({ mic: 50 }), [m[0].f, m[2].f]), cap = cppResponse(P, [m[0].f, m[2].f]);
  const drop = [0, 1].map((i) => db(C.abs(cap[i].p) / C.abs(odd[i].p)));
  check(drop.every((d) => d > 20), 'a microphone in the middle sits on the odd modes\' pressure nodes: the first and third modes 20 dB or more under the cap\'s', drop.map((d) => d.toFixed(1)).join(', ') + ' dB');
}

// 5. the engine against the model
{
  let worst = 0;
  const rows = [];
  for (const [o, fsweep] of [[{}, [41.2, 80.7, 98, 250, 700, 1500]], [{ gas: 'methane', mic: 30 }, [55, 146, 400]], [{ diameter: 12, length: 3 }, [40, 120, 300]]]) {
    const P = W(o);
    for (const f of fsweep) {
      const got = steady(P, f, 0.1), r = cppResponse(P, [f])[0], hp = f / Math.hypot(f, 5);
      const want = 0.1 * P.drive * hp * MIC * C.abs(r.p);
      worst = Math.max(worst, rel(got, want));
      rows.push(`${f} Hz ${db(got / want).toFixed(2)}`);
    }
  }
  check(worst < 0.02, 'the engine, a sine steady at the microphone, against the model\'s response through the amplifier\'s 5 Hz coupling: within 2 %', rows.join(', '));
}

// 6. the hints
{
  const first = (o) => peaks(W(o))[0].f, Qs = (o) => peaks(W(o)).slice(0, 5).map((p) => p.Q.toFixed(0)).join(' ');
  const tell = (got, want, text) => check(got === want, `the hint (${text})`, got);
  tell([first({}).toFixed(1), first({ length: 3.5 }).toFixed(1), first({ length: 0.6 }).toFixed(0)].join(' '), '80.9 34.5 208', 'Length): the first peak at 80.9 Hz at 1.524 m, 34.5 Hz at 3.5 m, 208 Hz at 0.6 m');
  tell(`${first({ gas: 'methane' }).toFixed(0)} ${GASES.methane.c.toFixed(0)} ${GASES.propane.c.toFixed(0)}`, '147 445 247', 'Gas): sound at 445 m/s in methane, 247 in propane; the first peak at 147 Hz in methane');
  const P0 = W({}), at = C.abs(cppResponse(P0, [peaks(P0)[0].f])[0].p);
  tell(at.toFixed(0), '528', 'Drive): 528 Pa at the cap at the first peak for each volt on the speaker');
  const m = cppModes(P0), mid = cppResponse(W({ mic: 50 }), [m[0].f, m[2].f]), cap = cppResponse(P0, [m[0].f, m[2].f]);
  tell(String([0, 1].every((i) => db(C.abs(cap[i].p) / C.abs(mid[i].p)) > 40)), 'true', 'Microphone): in the middle, the odd modes more than 40 dB down');
  check(PEDAL.expression === 'mic' && /expression pedal/.test(knob('mic')), 'an expression pedal moves the Microphone');
  tell(`${Qs({})}; ${Qs({ diameter: 10.2 })}; ${cppParts(W({})).cutoff.toPrecision(2)} ${cppParts(W({ diameter: 10.2 })).cutoff.toPrecision(2)}`, '14 42 87 154 200; 3 13 35 67 118; 2.8e+3 1.4e+3', 'Diameter): the first five peaks\' Q 14, 42, 87, 154, 200 at 5.2 cm, 3, 13, 35, 67, 118 at 10.2 cm; plane waves to 2.8 kHz, 1.4 kHz');
  const a = steady(W({}), 98, 0.1), b = steady(W({ pressure: 2000 }), 98, 0.1);
  tell(String(a === b), 'true', 'Gas pressure): the flames only; the sound is the same');
  const hints = PEDAL.groups.flatMap((g) => g.params).map((p) => p.hint);
  check(hints.every((h) => h && !/TODO/.test(h)), 'every knob has its hint');
}

// the README's numbers
{
  const P = W({}), m = cppModes(P), wall = (n) => ((Math.PI * m[n - 1].f) / m[n - 1].sigma).toFixed(0);
  check(`${wall(1)} ${wall(2)}` === '172 244', 'the README: the walls alone would give the first two modes a Q of 172 and 244', `${wall(1)} ${wall(2)}`);
  const pk = peaks(P).slice(0, 3).map((p) => p.f.toFixed(1)).join(' ');
  check(pk === '80.9 162.7 243.5', 'the README: the stock pipe\'s first three peaks at 80.9, 162.7 and 243.5 Hz', pk);
  const mid = cppResponse(W({ mic: 50 }), [m[0].f, m[2].f]), cap = cppResponse(P, [m[0].f, m[2].f]);
  const drop = [0, 1].map((i) => db(C.abs(cap[i].p) / C.abs(mid[i].p)).toFixed(0)).join(' ');
  check(drop === '47 42', 'the README: a microphone in the middle hears the first and third modes 47 dB and 42 dB under the cap', drop);
  const tails = `${cppParts(W({ gas: 'methane' })).tail.toFixed(1)} ${cppParts(P).tail.toFixed(1)}`;
  check(tails === '1.5 4.7', 'the README: the methane pipe\'s tail rings 1.5 s, the propane\'s 4.7 s', tails);
  const long = cppParts(W({ length: 3.5 })).modes;
  check(long === 78, 'the README: a 3.5 m pipe has 78 modes under its cutoff', String(long));
  const E2 = 440 * 2 ** ((40 - 69) / 12), swing = 0.3 * P.drive * C.abs(cppResponse(P, [E2])[0].p);
  check(swing.toFixed(0) === '1410', 'the README: E2 at 0.3 V from the bass swings 1410 Pa at the cap', swing.toFixed(1));
  let least = 9, at = 0, over = 0;
  for (let r = 0.01; r < 6; r += 0.001) { const q = meanFlow(r, 1); if (q < least) { least = q; at = r; } if (!over && r > 1 && q >= 1) over = r; }
  const fl = `${(100 * least).toFixed(0)} ${at.toFixed(2)} ${over.toFixed(1)}`;
  check(fl === '84 1.55 4.3', 'the README: the flames shrink most, to 84 % of their height, where the swing is 1.55 times the gas\'s pressure, and turn over past 4.3 times it', fl);
}

// 7. hygiene
{
  const r = run(W({}), new Float32Array(fs));
  check(Math.max(...r.L.map(Math.abs)) === 0, 'silence in, silence out');
  check(r.R.every((v, i) => v === r.L[i]), 'mono out on both sides');
  // the microphone slid along mid-note: no step past the note's own, for its height
  const e = new Effect(fs);
  e.setParams(W({}));
  const n = 2 * fs, inp = sine(98, fs, n, 0.3), L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i += 128) {
    if (i >= n / 2 && i < n / 2 + 12800) e.setParams(W({ mic: 100 - (i - n / 2) / 200, drive: 10 + (i - n / 2) / 1000, level: (i - n / 2) / 2000 }));
    e.process(inp.subarray(i, i + 128), L.subarray(i, i + 128), R.subarray(i, i + 128));
  }
  e.destroy();
  const worstStep = (a, b) => {
    let worst = 0;
    for (let i = a; i < b; i += 1024) {
      let step = 0, height = 0;
      for (let j = i; j < i + 1024; j++) { step = Math.max(step, Math.abs(L[j] - L[j - 1])); height = Math.max(height, Math.abs(L[j])); }
      worst = Math.max(worst, step / height);
    }
    return worst;
  };
  const before = worstStep(n / 4, n / 2), after = worstStep(n / 2, n - 1024);
  check(after < 1.5 * before, 'the microphone slid along the pipe and the Drive and Level turned mid-note glide: no step past the note\'s own, for its height', `${(1e3 * after).toFixed(1)} of the height a sample against ${(1e3 * before).toFixed(1)}`);
  // the pipe lengthened mid-note: its modes move, the pipe's state carried along
  const e3 = new Effect(fs);
  e3.setParams(W({}));
  const L3 = new Float32Array(n), R3 = new Float32Array(n);
  for (let i = 0; i < n; i += 128) {
    if (i >= n / 2 && i < n / 2 + 12800) e3.setParams(W({ length: 1.524 + (i - n / 2) / 12800, gas: i < n / 2 + 6400 ? 'propane' : 'methane' }));
    e3.process(inp.subarray(i, i + 128), L3.subarray(i, i + 128), R3.subarray(i, i + 128));
  }
  e3.destroy();
  check(L3.every(Number.isFinite) && Math.max(...L3.map(Math.abs)) < 10, 'the pipe lengthened and its gas changed mid-note: the modes move, nothing blows up', `${Math.max(...L3.map(Math.abs)).toFixed(2)} V at most`);
  const e2 = new Effect(fs);
  e2.setParams(W({}));
  const bad = new Float32Array(128); bad[5] = NaN;
  const L2 = new Float32Array(4096), R2 = new Float32Array(4096);
  const ok = e2.process(bad, L2.subarray(0, 128), R2.subarray(0, 128));
  e2.process(sine(100, fs, 4096, 0.3), L2, R2);
  check(!ok && L2.every(Number.isFinite) && Math.max(...L2.map(Math.abs)) > 0.05, 'a NaN in comes out as a silent block, and the pedal recovers');
  e2.destroy();
}

// 8. presets stay in range, and set real choices
{
  const ids = new Map(PEDAL.groups.flatMap((g) => g.params).map((p) => [p.id, p]));
  const bad = Object.entries(PEDAL.presets).flatMap(([nm, v]) => Object.entries(v).filter(([id, val]) => {
    const p = ids.get(id);
    if (!p) return true;
    if (p.type === 'select') return !p.options.some(([o]) => o === val);
    return typeof val === 'number' && (val < p.min || val > p.max);
  }).map(([id]) => `${nm}: ${id}`));
  check(!bad.length, 'every preset sets real parameters inside their ranges', bad.join(', '));
}

// 9. CPU
if (!CI) {
  const quiet = (pre) => {
    const e = new Effect(fs); e.setParams(W({}));
    const L = new Float32Array(fs), R = new Float32Array(fs);
    if (pre) { e.process(sine(41.2, fs, fs, 0.3), L, R); for (let k = 0; k < 60; k++) e.process(new Float32Array(fs), L, R); }
    const t0 = performance.now(); for (let k = 0; k < 4; k++) e.process(new Float32Array(fs), L, R); const ms = performance.now() - t0;
    e.destroy(); return ms / 4;
  };
  const rest = Math.min(quiet(false), quiet(false)), after = Math.min(quiet(true), quiet(true));
  check(after < 2 * rest + 1, 'CPU: once the tail has died, silence costs what silence from rest does', `${after.toFixed(1)} ms a second after a note, ${rest.toFixed(1)} ms from rest`);
  const n = 10 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.8 * Math.sin((2 * Math.PI * 41.2 * i) / fs) * Math.exp(-(i % fs) / fs));
  for (const [o, rate] of [[{}, 48000], [{ length: 4, diameter: 2 }, 96000]]) {
    const e = new Effect(rate);
    e.setParams(W(o));
    const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
    for (let i = 0; i < n; i += 128) e.process(inp.subarray(i, i + 128), L.subarray(i, i + 128), R.subarray(i, i + 128));
    const share = (performance.now() - t0) / 1000 / (n / rate);
    e.destroy();
    const budget = rate > 48000 ? 0.1 : 0.05;
    check(share < budget, `CPU: ${cppParts(W(o)).modes} modes at ${rate / 1000} kHz under ${100 * budget} % of a core (WebAssembly)`, `${(100 * share).toFixed(1)} %`);
  }
}

done();
