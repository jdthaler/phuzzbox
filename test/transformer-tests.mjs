// transformer-tests.mjs — the Output Transformer against the stage worked out independently of the
// C++ (test/transformer-circuit.mjs): the cores' published parameters, the major loop integrated by
// Runge–Kutta in the field, the output stage integrated by Runge–Kutta in time with the JA equation
// as published; the small-signal limit against circuit theory, jωL/(Rp + jωL) with the reversible
// susceptibility's inductance; Faraday's law, B = V/(2π f N A); and each knob's hint.

import { check, done, CI } from './harness.mjs';
import { loadPedal } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { amplitudeAt, db, sine } from '../tools/audio-util.mjs';
import { CORES, MU0, TURNS, PATH, LOAD, chi0, loop, tone } from './transformer-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('transformer');
const x = Effect.exports;
const fs = 48000;
const D = { ...defaults(PEDAL.groups), level: 0 };
const W = (over) => ({ ...D, ...over });

// the C++ model through its exports
function call(fn, P, extra = [], args = []) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length).set(v);
  if (extra.length) s.f64(extra.length, 8 * v.length).set(extra);
  x[fn](s.at, ...args);
  return { n: v.length, read: (count, at = 0) => Array.from(s.f64(count, 8 * at)) };
}
const cppParts = (P) => { const r = call('transformer_parts', P).read(14); return { Ms: r[0], a: r[1], alpha: r[2], k: r[3], c: r[4], N: r[5], l: r[6], RL: r[7], A: r[8], Rs: r[9], rp: r[10], divider: r[11], Bs: r[12], L0: r[13] }; };
const cppLoop = (P, Hmax, n) => { const c = call('transformer_loop', P, [Hmax], [n]); const r = c.read(2 * n, c.n + 1); return Array.from({ length: n }, (_, i) => [r[2 * i], r[2 * i + 1]]); };
// the scratch area holds 8192 numbers: P, three inputs and three arrays of n
const cppTone = (P, f, amp, periods, n) => { if (n > 2700) throw new Error('n too large for the scratch area'); const c = call('transformer_tone', P, [f, amp, periods], [n]); return { v: c.read(n, c.n + 3), H: c.read(n, c.n + 3 + n), B: c.read(n, c.n + 3 + 2 * n) }; };

function run(P, input, quality = 'high') {
  const e = new Effect(fs);
  e.setQuality(quality);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length);
  const ok = e.process(input, L, R);
  const ex = x.px_effect(e.h);
  const out = { L, R, ok, evaluations: x.transformer_evaluations(ex), substeps: x.transformer_substeps(ex), latency: e.latency() };
  e.destroy();
  return out;
}
// a steady note: its second second
const steady = (P, f, a, quality = 'high') => run(P, sine(f, fs, 2 * fs, a), quality).L.subarray(fs);
const at = (y, f) => amplitudeAt(y, f, fs);
const coercive = (L) => { for (let i = 1; i < L.length; i++) if (L[i - 1][1] > 0 && L[i][1] <= 0) return -(L[i - 1][0] + (L[i][0] - L[i - 1][0]) * L[i - 1][1] / (L[i - 1][1] - L[i][1])); return NaN; };

// 1. the parts: the published cores, the geometry, the source
{
  let ok = true;
  for (const [id, p] of Object.entries(CORES)) {
    const c = cppParts(W({ material: id }));
    ok &&= ['Ms', 'a', 'alpha', 'k', 'c'].every((q) => Math.abs(c[q] / p[q] - 1) < 1e-12);
  }
  check(ok, 'model: the cores\' Jiles–Atherton parameters as published: Jiles and Atherton\'s iron (1986, through Holters and Zölzer\'s Table 1), Plucinski et al.\'s 50 % nickel–iron at 30 °C, Szewczyk\'s permalloy');
  const bs = Object.keys(CORES).map((id) => cppParts(W({ material: id })).Bs);
  check(bs[0].toFixed(1) === '2.0' && bs[1].toFixed(1) === '1.2' && bs[2].toFixed(2) === '0.77', 'saturation µ0 Ms: 2.0 T for the iron, 1.2 T for 50 % nickel, 0.77 T for permalloy', bs.map((b) => b.toFixed(3)).join(', ') + ' T');
  const p = cppParts(W({}));
  check(p.N === TURNS && p.l === PATH && p.RL === LOAD && Math.abs(p.rp - 2000 * 4200 / 6200) < 1e-9 && Math.abs(p.divider - 4200 / 6200) < 1e-12,
    'the stage: 1500 turns, a 15 cm path, the speaker reflected as 4.2 kΩ (Hammond\'s 1750L, 4.2 kΩ to 4 Ω); the source seen through it, Rs ∥ RL and Vth = Vs RL/(Rs + RL)');
}

// 2. the loop: against Runge–Kutta in the field
{
  let worst = 0;
  const rows = [];
  for (const [id, p] of Object.entries(CORES)) for (const Hmax of [3 * p.k, 30 * p.a]) {
    const a = cppLoop(W({ material: id }), Hmax, 400), b = loop(p, Hmax, 400);
    const err = Math.max(...a.map((q, i) => Math.abs(q[1] - b[i][1]))) / (MU0 * p.Ms);
    worst = Math.max(worst, err);
    rows.push(`${id} ${Hmax.toPrecision(3)}: Hc ${coercive(a).toPrecision(3)}/${coercive(b).toPrecision(3)}`);
  }
  check(worst < 0.005, 'the core\'s loop, minor (to 3k) and major (to 30a), against the JA equation integrated by Runge–Kutta in the field: within 0.5 % of saturation', `${(100 * worst).toFixed(2)} % at worst; ${rows.join('; ')} A/m`);
  const hc = Object.entries(CORES).map(([id, p]) => coercive(cppLoop(W({ material: id }), 3 * p.k, 2000)));
  check(Math.round(hc[0] / 10) === 39 && hc[1].toFixed(1) === '3.9' && hc[2].toFixed(2) === '0.57', 'the hint (Iron): coercive fields of 390, 3.9 and 0.57 A/m (on loops to three times k)', hc.map((h) => h.toPrecision(3)).join(', ') + ' A/m');
  const big = cppLoop(W({}), 30 * CORES.iron.a, 400), top = Math.max(...big.map(([, b]) => b));
  check(top > 0.95 * MU0 * CORES.iron.Ms && top < MU0 * (CORES.iron.Ms + 30 * CORES.iron.a), 'the loop saturates: at 30a the iron\'s flux is within 5 % of µ0 (Ms + H)', `${top.toFixed(3)} T`);
}

// 3. the stage played: against the circuit integrated by Runge–Kutta in time
{
  let worst = 0;
  const rows = [];
  for (const [core, f, amp, Rs, A] of [['iron', 41.2, 0.3, 2000, 1e-3], ['iron', 98, 1, 2000, 1e-3], ['iron', 41.2, 1, 500, 3e-4], ['nickel', 41.2, 1, 2000, 5e-4], ['permalloy', 41.2, 1, 2000, 1e-3], ['permalloy', 98, 0.3, 20000, 1e-3]]) {
    const P = W({ material: core, source: Rs, area: A }), g = P.drive * cppParts(P).divider * amp, n = 800;
    const js = tone({ core, A, Rs }, g, f, 6, n), c = cppTone(P, f, amp, 6, n);
    const vmax = Math.max(...js.v.map(Math.abs)), err = Math.max(...js.v.map((v, i) => Math.abs(v - c.v[i]))) / vmax;
    worst = Math.max(worst, err);
    rows.push(`${core} ${f} Hz ${amp} V: ${(100 * err).toFixed(2)} %`);
  }
  check(worst < 0.01, 'the primary\'s voltage over a note\'s first six periods, against the stage integrated in time by Runge–Kutta, saturated or not: within 1 % of its peak', rows.join('; '));
  // small signals: the core moves only reversibly, an inductor of µ0 (1 + χ0) N² A/l
  let ws = 0;
  for (const f of [41.2, 98, 392]) {
    const P = W({}), pp = cppParts(P), g = P.drive * pp.divider * 1e-5, c = cppTone(P, f, 1e-5, 40, 800);
    const L0 = (MU0 * (1 + chi0(CORES.iron)) * TURNS * TURNS * P.area) / PATH, w = 2 * Math.PI * f;
    const want = (w * L0) / Math.hypot(pp.rp, w * L0), got = (Math.max(...c.v) - Math.min(...c.v)) / 2 / g;
    ws = Math.max(ws, Math.abs(got / want - 1));
  }
  check(ws < 0.005 && Math.abs(cppParts(W({})).L0 / ((MU0 * (1 + chi0(CORES.iron)) * TURNS * TURNS * 1e-3) / PATH) - 1) < 1e-8, 'small signals through the iron: a highpass, jωL/(Rp + jωL), with the inductance of its reversible susceptibility, χ0 = c/(1 + c) of the anhysteretic\'s Ms/3a (0.5 %)', `${(100 * ws).toFixed(2)} % at worst`);
}

// 4. Faraday's law: a note's flux swings V/(2π f N A) for the voltage across the primary, harmonic
// by harmonic (dΦ/dt = v is linear): the fundamentals compared, over the two periods the tone gives
{
  const fund = (y) => { let c = 0, s = 0; y.forEach((v, i) => { c += v * Math.cos((4 * Math.PI * i) / y.length); s += v * Math.sin((4 * Math.PI * i) / y.length); }); return (2 * Math.hypot(c, s)) / y.length; };
  const rows = [];
  let worst = 0;
  for (const [core, f, amp, A] of [['nickel', 98, 0.3, 1e-3], ['permalloy', 55, 0.3, 1e-3], ['iron', 196, 0.3, 3e-3], ['iron', 41.2, 1, 3e-4]]) {
    const P = W({ material: core, area: A }), c = cppTone(P, f, amp, 400, 800);
    const b1 = fund(c.B), want = fund(c.v) / (2 * Math.PI * f * TURNS * A);
    worst = Math.max(worst, Math.abs(b1 / want - 1));
    rows.push(`${core} ${f} Hz: ${b1.toFixed(4)}/${want.toFixed(4)} T`);
  }
  check(worst < 0.002, 'Faraday\'s law: the flux density\'s fundamental is the primary\'s over 2π f N A (the transformer equation, V = 4.44 f N A B in rms), saturated or not (0.2 %)', rows.join('; '));
}

// 5. the hints
{
  const knob = (id) => PEDAL.groups.flatMap((g) => g.params).find((p) => p.id === id).hint;
  const h3 = (y, f) => at(y, 3 * f) / at(y, f);
  const peakB = (P, f, a) => { const c = cppTone(P, f, a, Math.round(2 * f), 800); return Math.max(...c.B.map(Math.abs)); };
  // Drive: a 1 V low E takes the iron to 1.4 T with an 11 % third; a 1 V G 0.7 T and 3 %
  const E1 = steady(W({}), 41.2, 1), G1 = steady(W({}), 98, 1), bE = peakB(W({}), 41.2, 1), bG = peakB(W({}), 98, 1);
  check(bE.toFixed(1) === '1.4' && (100 * h3(E1, 41.2)).toFixed(0) === '11' && bG.toFixed(1) === '0.7' && (100 * h3(G1, 98)).toFixed(0) === '3',
    'the hint (Drive): stock, a 1 V low E reaches 1.4 T with an 11 % third harmonic, a 1 V G 0.7 T with 3 %', `${bE.toFixed(3)} T, ${(100 * h3(E1, 41.2)).toFixed(1)} %; ${bG.toFixed(3)} T, ${(100 * h3(G1, 98)).toFixed(1)} %`);
  const loudA = at(steady(W({ drive: 100 }), 196, 0.1), 196), loudB = at(steady(W({ drive: 3000 }), 196, 0.1), 196);
  check(Math.abs(db(loudB / loudA)) < 1.5, 'the hint (Drive): the output is divided by Drive, so it works the iron without making the pedal louder (a G an octave up, 0.1 V: 100 against 3000 V/V within 1.5 dB)', `${db(loudB / loudA).toFixed(2)} dB`);
  check(PEDAL.expression === 'drive' && /expression pedal/.test(knob('drive')), 'an expression pedal moves the Drive');
  // Plate resistance: 0.3 V low E, 0.7 dB down and 2.4 % at 500 Ω; 15 dB down and 19 % at 20 kΩ
  const s5 = steady(W({ source: 500 }), 41.2, 0.3), s20 = steady(W({ source: 20000 }), 41.2, 0.3);
  const d5 = -db(at(s5, 41.2) / 0.3), d20 = -db(at(s20, 41.2) / 0.3);
  check(d5.toFixed(1) === '0.7' && (100 * h3(s5, 41.2)).toFixed(1) === '2.4' && d20.toFixed(0) === '15' && (100 * h3(s20, 41.2)).toFixed(0) === '19',
    'the hint (Plate resistance): a 0.3 V low E 0.7 dB down with a 2.4 % third at 500 Ω, 15 dB down with 19 % at 20 kΩ', `${d5.toFixed(2)} dB, ${(100 * h3(s5, 41.2)).toFixed(2)} %; ${d20.toFixed(2)} dB, ${(100 * h3(s20, 41.2)).toFixed(1)} %`);
  // Core: 0.3 V low E, 4.7 % at 30 cm², 18 % at 3 cm²; 1 V at 3 cm² saturates, 10 dB down, third half the note
  const a30 = steady(W({ area: 3e-3 }), 41.2, 0.3), a3 = steady(W({ area: 3e-4 }), 41.2, 0.3), a3l = steady(W({ area: 3e-4 }), 41.2, 1), b3 = peakB(W({ area: 3e-4 }), 41.2, 1);
  check((100 * h3(a30, 41.2)).toFixed(1) === '4.7' && (100 * h3(a3, 41.2)).toFixed(0) === '18' && (-db(at(a3l, 41.2))).toFixed(0) === '10' && Math.abs(h3(a3l, 41.2) - 0.5) < 0.03 && b3 > 0.8 * cppParts(W({})).Bs,
    'the hint (Core): a 0.3 V low E with a 4.7 % third at 30 cm² and 18 % at 3 cm², where a 1 V low E saturates it, 10 dB down, its third half the note',
    `${(100 * h3(a30, 41.2)).toFixed(2)} %, ${(100 * h3(a3, 41.2)).toFixed(1)} %; ${(-db(at(a3l, 41.2))).toFixed(1)} dB, ${(100 * h3(a3l, 41.2)).toFixed(1)} %, ${b3.toFixed(2)} T`);
  // Iron: permalloy on a small core flattens a firm low E; nickel doesn't, at 0.3 V
  const pm = steady(W({ material: 'permalloy', area: 5e-4 }), 41.2, 0.3), ni = steady(W({ material: 'nickel', area: 5e-4 }), 41.2, 0.3);
  check(h3(pm, 41.2) > 0.2 && h3(ni, 41.2) < 0.01 && h3(steady(W({ material: 'permalloy', area: 5e-4 }), 98, 0.3), 98) < 0.01,
    'the hint (Iron): clean until it saturates; on a 5 cm² core permalloy flattens a 0.3 V low E, nickel doesn\'t, and permalloy\'s G stays clean', `${(100 * h3(pm, 41.2)).toFixed(1)} %, ${(100 * h3(ni, 41.2)).toFixed(2)} %`);
  // Level: a perfect core would pass the bass unchanged; the real one is quieter, low notes most
  const lo = at(steady(W({}), 41.2, 0.1), 41.2) / 0.1, hi = at(steady(W({}), 392, 0.1), 392) / 0.1;
  check(lo < hi && hi < 1 && hi > 0.85, 'the hint (Level): at 0 dB the iron makes the pedal quieter than its input, the low notes most', `E ${db(lo).toFixed(1)} dB, G an octave up ${db(hi).toFixed(1)} dB`);
}

// 5b. the README's and the tour's other numbers
{
  const pp = cppParts(W({})), chi = chi0(CORES.iron), corner = pp.rp / (2 * Math.PI * pp.L0);
  check(chi.toFixed(0) === '93' && pp.L0.toFixed(2) === '1.77' && corner.toFixed(0) === '122', 'the README: the iron\'s reversible susceptibility 93, its 10 cm² core 1.77 H, a highpass at 122 Hz with the stock 2 kΩ source', `${chi.toFixed(2)}, ${pp.L0.toFixed(4)} H, ${corner.toFixed(1)} Hz`);
  const V = 1000 * pp.divider * 0.3, bE = V / (2 * Math.PI * 41.2 * TURNS * 1e-3), bG = V / (2 * Math.PI * 98 * TURNS * 1e-3);
  check(V.toFixed(0) === '203' && bE.toFixed(2) === '0.52' && bG.toFixed(2) === '0.22', 'the README: stock, a 0.3 V note gives 203 V, 0.52 T at the low E and 0.22 T at the G with a core that took no current', `${V.toFixed(1)} V, ${bE.toFixed(3)}, ${bG.toFixed(3)} T`);
  check(chi0(CORES.nickel).toFixed(1) === '3.2' && chi0(CORES.permalloy).toFixed(1) === '8.1', 'the README: nickel\'s and permalloy\'s reversible susceptibility, 3.2 and 8.1');
  // Hussain et al.'s B35AV1900 at 150 °C: Ms 1.2594e6, a 27.1854, α 7.7459e-5
  const hussain = (7.7459e-5 * 1.2594e6) / (3 * 27.1854);
  check(hussain.toFixed(1) === '1.2' && [CORES.iron, CORES.nickel, CORES.permalloy].every((p) => (p.alpha * p.Ms) / (3 * p.a) < 0.8), 'the README: the steel fit left out has α Ms/3a = 1.2, the three cores used under 0.8', hussain.toFixed(3));
  const pm = steady(W({ material: 'permalloy', area: 5e-4 }), 41.2, 0.3);
  check((100 * at(pm, 123.6) / at(pm, 41.2)).toFixed(0) === '30', 'the README: on a 5 cm² core permalloy flattens a 0.3 V low E with a 30 % third harmonic');
}

// 6. the solver: on a loud bass, every preset, every quality
for (const [qu, most] of [['high', 4], ['medium', 4], ['low', 4]]) {
  let worst = 0, subs = 0, finite = true;
  const loud = sine(41.2, fs, fs / 2, 1.5);
  for (const v of Object.values(PEDAL.presets)) {
    const r = run(W(v), loud, qu);
    worst = Math.max(worst, r.evaluations); subs = Math.max(subs, r.substeps); finite &&= r.L.every(Number.isFinite);
  }
  check(finite && worst < most && subs < 3, `the field solved on a loud bass through every preset (${qu} quality: under ${most} evaluations of the core a step, each under 3 substeps)`, `${worst.toFixed(2)} a step, ${subs.toFixed(2)} substeps at worst`);
}

// 7. hygiene
{
  const r = run(W({}), new Float32Array(fs));
  check(Math.max(...r.L.map(Math.abs)) === 0, 'silence in, silence out');
  // turning the core's area and the drive glides: no click
  const e = new Effect(fs);
  e.setParams(W({}));
  const n = fs, inp = sine(98, fs, n, 0.3), L = new Float32Array(n), R = new Float32Array(n);
  e.process(inp.subarray(0, n / 2), L.subarray(0, n / 2), R.subarray(0, n / 2));
  e.setParams(W({ area: 3e-4, drive: 3000, source: 20000 }));
  e.process(inp.subarray(n / 2), L.subarray(n / 2), R.subarray(n / 2));
  e.destroy();
  const steps = L.map((v, i) => (i ? Math.abs(v - L[i - 1]) : 0)), before = Math.max(...steps.subarray(n / 4, n / 2)), after = Math.max(...steps.subarray(n / 2, n / 2 + 4800));
  check(after < 2 * before, 'turning the Core, the Drive and the Plate resistance mid-note glides: no step past the note\'s own', `${(1e3 * after).toFixed(2)} mV a sample against ${(1e3 * before).toFixed(2)}`);
  const e2 = new Effect(fs);
  e2.setParams(W({}));
  const bad = new Float32Array(128); bad[5] = NaN;
  const L2 = new Float32Array(4096), R2 = new Float32Array(4096);
  const ok = e2.process(bad, L2.subarray(0, 128), R2.subarray(0, 128));
  e2.process(sine(100, fs, 4096, 0.3), L2, R2);
  check(!ok && L2.every(Number.isFinite) && Math.max(...L2.map(Math.abs)) > 0.1, 'a NaN in comes out as a silent block, and the pedal recovers');
  e2.destroy();
  check(R2.every((v, i) => v === L2[i]), 'mono out on both sides');
  const lat = ['high', 'medium', 'low'].map((qu) => run(W({}), new Float32Array(128), qu).latency);
  check(lat[1] === 0 && lat[2] === 0 && lat[0] > 0 && lat[0] <= 5, 'latency: the oversampling filters\' few samples at high quality, none otherwise', lat.join(', '));
  // aliasing: a saturated 1010 Hz note keeps what folds back well under its harmonics
  const y = steady(W({ material: 'permalloy', area: 2e-4, drive: 3000 }), 1010, 1);
  let worstAlias = 0;
  for (let f = 50; f < 20000; f += 10) { if (Math.abs(f % 1010) < 15 || 1010 - (f % 1010) < 15) continue; worstAlias = Math.max(worstAlias, at(y, f)); }
  check(db(worstAlias / at(y, 1010)) < -50, 'aliasing: a 1010 Hz note saturating a 2 cm² permalloy core, nothing between its harmonics within 50 dB of the note (high quality)', `${db(worstAlias / at(y, 1010)).toFixed(1)} dB; its third ${(100 * at(y, 3030) / at(y, 1010)).toFixed(1)} %`);
}

// 8. presets stay in range, and set real choices
{
  const ids = new Map(PEDAL.groups.flatMap((g) => g.params).map((p) => [p.id, p]));
  const bad = Object.entries(PEDAL.presets).flatMap(([n, v]) => Object.entries(v).filter(([id, val]) => {
    const p = ids.get(id);
    if (!p) return true;
    if (p.type === 'select') return !p.options.some(([o]) => o === val);
    return typeof val === 'number' && (val < p.min || val > p.max);
  }).map(([id]) => `${n}: ${id}`));
  check(!bad.length, 'every preset sets real parameters inside their ranges', bad.join(', '));
}

// 9. CPU
if (!CI) {
  const n = 10 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.8 * Math.sin((2 * Math.PI * 41.2 * i) / fs) * Math.exp(-(i % fs) / fs));
  for (const [qu, budget] of [['high', 0.08], ['medium', 0.06]]) for (const P of [W({}), W(PEDAL.presets.Permalloy)]) {
    const e = new Effect(fs);
    e.setQuality(qu);
    e.setParams(P);
    const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
    e.process(inp, L, R);
    const share = (performance.now() - t0) / 1000 / 10;
    e.destroy();
    check(share < budget, `CPU: ${P.material} at ${qu} quality under ${(100 * budget).toFixed(0)} % of a core (WebAssembly)`, `${(100 * share).toFixed(1)} %`);
  }
}

done();
