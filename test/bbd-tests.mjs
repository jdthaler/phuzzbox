// bbd-tests.mjs — the Bucket Brigade against its chain worked out independently of the C++
// (test/bbd-circuit.mjs): the Butterworth filters from their poles, the transfer loss summed over
// its negative binomial terms, the sample-and-hold's sinc, the sampling theorem's aliases, the
// feedback loop's comb, and the pitch a swinging clock bends, by counting its cycles; and each
// knob's hint.

import { check, done, CI } from './harness.mjs';
import { loadPedal } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { amplitudeAt, db, sine } from '../tools/audio-util.mjs';
import { butterworth, lateBy, transfer, chip, alias, cx } from './bbd-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('bbd');
const x = Effect.exports;
const fs = 48000;
const D = { ...defaults(PEDAL.groups), level: 0 };
const W = (over) => ({ ...D, ...over });
// the chip alone, its clock still
const STILL = W({ mix: 1, depth: 0 });
const S = (over) => ({ ...STILL, ...over });

function call(fn, P, extra = [], args = []) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length).set(v);
  if (extra.length) s.f64(extra.length, 8 * v.length).set(extra);
  x[fn](s.at, ...args);
  return { n: v.length, read: (count, at = 0) => Array.from(s.f64(count, 8 * at)) };
}
function cppParts(P) { const c = call('bbd_parts', P), h = c.read(6); return { N: h[0], clock: h[1], delay: h[2], taps: h[3], eps: h[4], corner: h[5], p: c.read(h[3], 6) }; }
function cppResponse(P, freqs) {
  const c = call('bbd_response', P, freqs, [freqs.length]), n = freqs.length, r = c.read(4 * n, c.n + n);
  return freqs.map((_, i) => ({ mag: r[i], arg: r[n + i], chip: r[2 * n + i], chipArg: r[3 * n + i] }));
}
const chipOf = (P) => { const p = cppParts(P); return { N: p.N, eps: p.eps, corner: p.corner, clock: p.clock }; };

function run(P, input, quality = 'high') {
  const e = new Effect(fs);
  e.setQuality(quality);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length);
  const ok = e.process(input, L, R);
  const out = { L, R, ok, messages: e.messages(), ticks: x.bbd_ticks(x.px_effect(e.h)), latency: e.latency(), tail: e.tail?.() };
  e.destroy();
  return out;
}
// the complex amplitude of y at f (a Hann-windowed single-bin DFT, as amplitudeAt)
function phasor(y, f) {
  let re = 0, im = 0, ws = 0;
  for (let i = 0; i < y.length; i++) { const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (y.length - 1)); re += w * y[i] * Math.cos((2 * Math.PI * f * i) / fs); im -= w * y[i] * Math.sin((2 * Math.PI * f * i) / fs); ws += w; }
  return [(2 * re) / ws, (2 * im) / ws];
}
// the engine's response at f against its own dry path (so the oversampling filters cancel)
function measured(P, f, a = 0.1) {
  const inp = sine(f, fs, fs + 24000, a), seg = (y) => y.subarray(24000);
  const wet = phasor(seg(run(P, inp).L), f), dry = phasor(seg(run({ ...P, mix: 0 }, inp).L), f);
  return cx.div(wet, dry);
}

// 1. the parts and the transfer loss's taps
{
  const p = cppParts(W({ stages: '2048', cti: 3e-4 }));
  const want = Array.from({ length: p.taps }, (_, m) => lateBy(2048, 3e-4, m));
  const err = Math.max(...p.p.map((v, m) => Math.abs(v - want[m])));
  check(p.N === 2048 && Math.abs(p.delay - 2048 / (2 * 100e3)) < 1e-15, 'model: 2048 stages at 100 kHz delay by N/(2 fclk), 10.24 ms', `${(1e3 * p.delay).toFixed(3)} ms`);
  check(err < 1e-9 && Math.abs(p.p.reduce((a, b) => a + b, 0) - 1) < 1e-12, 'the transfer loss\'s taps are the negative binomial\'s, C(N + m − 1, m)(1 − ε)^N ε^m, and pass DC whole', `${p.taps} taps, worst ${err.toExponential(1)}`);
  // the closed form ((1 − ε)/(1 − ε z⁻¹))^N against the sum over the taps
  let worst = 0;
  for (const [N, eps] of [[1024, 1e-4], [4096, 5e-4], [512, 1e-3]]) for (const f of [100, 3000, 12000, 25000]) {
    const P = W({ stages: String(N), cti: eps, clock: 50e3 });
    const r = cppResponse(P, [f])[0], want2 = cx.mul(cx.mul(butterworth(f, P.filter), butterworth(f, P.filter)), transfer(N, eps, f, 50e3));
    const sinc = Math.sin((Math.PI * f) / 50e3) / ((Math.PI * f) / 50e3);
    worst = Math.max(worst, Math.abs(r.chip / (cx.abs(want2) * sinc) - 1));
  }
  check(worst < 1e-9, 'the chip\'s response: the Butterworth filters from their poles, the hold\'s sinc and the transfer loss summed term by term', `worst ${worst.toExponential(1)}`);
  // ε N sets the loss at half the clock: ((1 − ε)/(1 + ε))^N
  const half = (N, eps) => db(cx.abs(transfer(N, eps, 50e3, 100e3)));
  check(Math.abs(half(1024, 1e-4) + 1.78) < 0.01 && Math.abs(half(4096, 5e-4) + 35.6) < 0.1, 'the hint: at half the clock the transfer loss is ((1 − ε)/(1 + ε))^N: 1.8 dB through 1024 stages at 100 ppm, and through 4096 at 500 ppm 35.6 dB', `${half(1024, 1e-4).toFixed(2)} dB, ${half(4096, 5e-4).toFixed(1)} dB`);
}

// 2. the engine against the chip's response, in amplitude to the filters' corner and in phase
for (const [what, P] of [['1024 stages at 100 kHz', S({})], ['4096 stages at 20 kHz, 500 ppm', S({ stages: '4096', clock: 20e3, cti: 5e-4 })], ['1024 at 30 kHz, filters open to 20 kHz', S({ clock: 30e3, filter: 20e3 })]]) {
  const c = chipOf(P), errs = [], parts = [];
  for (const f of [60, 400, 1500, 0.5 * Math.min(c.corner, 8000), 0.95 * Math.min(c.corner, c.clock / 2, 8000)]) {
    const got = measured(P, f), want = chip(c, f);
    errs.push(Math.abs(db(cx.abs(got) / cx.abs(want))));
    parts.push(`${f.toFixed(0)} Hz ${db(cx.abs(got)).toFixed(2)} dB`);
  }
  // the delay: the phase's slope at low frequency, against N/(2 fclk) and the filters'
  const f1 = 200, f2 = f1 + 0.25 / (c.N / 2 / c.clock + 1e-3), g1 = measured(P, f1), g2 = measured(P, f2), w1 = chip(c, f1), w2 = chip(c, f2);
  const unwrap = (d) => d - 2 * Math.PI * Math.round(d / (2 * Math.PI));
  const tau = -unwrap(cx.arg(g2) - cx.arg(g1)) / (2 * Math.PI * (f2 - f1)), want = -unwrap(cx.arg(w2) - cx.arg(w1)) / (2 * Math.PI * (f2 - f1));
  check(Math.max(...errs) < 0.1 && Math.abs(tau / want - 1) < 0.01, `the engine, ${what}: as the chip\'s response says, to 0.1 dB up to the corner or 7.6 kHz, and its delay to 1 %`, `${parts.join(', ')}; delay ${(1e3 * tau).toFixed(3)} ms against ${(1e3 * want).toFixed(3)} ms (N/2fclk ${(1e3 * c.N / 2 / c.clock).toFixed(2)})`);
}

// 3. the sampling theorem: above half the clock a tone comes out at its alias
{
  const P = S({ stages: '4096', clock: 8e3, filter: 20e3 }), c = chipOf(P), f = 6500, fa = alias(f, 8e3);
  const y = run(P, sine(f, fs, 2 * fs, 0.1)).L.subarray(fs);
  // the samples of the tone are those of its alias: the input's filter at f, then the rest of the
  // chip at the alias
  const want = 0.1 * cx.abs(butterworth(f, c.corner)) * cx.abs(chip(c, fa)) / cx.abs(butterworth(fa, c.corner));
  const got = at(y, fa);
  check(fa === 1500 && Math.abs(db(got / want)) < 0.3, 'Clock: a 6.5 kHz tone through an 8 kHz clock comes out at its alias, 1.5 kHz, as loud as the sampling theorem says (0.3 dB)', `${(1e3 * got).toFixed(2)} mV against ${(1e3 * want).toFixed(2)} mV`);
  const closed = run(S({ stages: '4096', clock: 8e3, filter: 3e3 }), sine(f, fs, 2 * fs, 0.1)).L.subarray(fs);
  check(db(at(closed, fa) / got) < -18, 'Filter corner: with the filters at 3 kHz, below half the clock, the alias is kept down (20 dB)', `${db(at(closed, fa) / got).toFixed(1)} dB`);
}
function at(y, f) { return amplitudeAt(y, f, fs); }

// 4. feedback and mix: the comb, from the chip's response in its loop
{
  const P = W({ depth: 0, feedback: 0.7, mix: 0.5, stages: '512', clock: 150e3 }), c = chipOf(P);
  const errs = [], parts = [];
  const tau = c.N / 2 / c.clock;
  for (const f of [1 / tau, 1.5 / tau, 2 / tau, 2.5 / tau, 400]) {
    // the engine returns the delayed sound one step late, 1/192 kHz at high quality
    const got = measured({ ...P }, f), H = chip(c, f), step = [Math.cos((-2 * Math.PI * f) / (4 * fs)), Math.sin((-2 * Math.PI * f) / (4 * fs))], Hl = cx.mul(H, step);
    const want = cx.abs(cx.div([0.5 * H[0], 0.5 * H[1]], [1 - 0.7 * Hl[0], -0.7 * Hl[1]]).map((v, i) => v + (i ? 0 : 0.5)));
    // measured() divides by the dry path at mix 0, which is the input itself
    errs.push(Math.abs(db(cx.abs(got) / want)));
    parts.push(`${f.toFixed(0)} Hz ${db(cx.abs(got)).toFixed(2)} (${db(want).toFixed(2)})`);
  }
  check(Math.max(...errs) < 0.2, 'Feedback 70 %, Mix 50 %: the comb\'s peaks and notches, (1 − mix) + mix H/(1 − g H) (0.2 dB)', `${parts.join(', ')} dB; worst ${Math.max(...errs).toFixed(3)} dB`);
  const notch = cx.abs(measured(W({ depth: 0, mix: 0.5, feedback: 0 }), 1 / (2 * 5.12e-3)));
  check(db(notch) < -20, 'the hint: at Mix 50 % the delayed and dry cancel at half the delay\'s inverse', `${db(notch).toFixed(1)} dB at ${(1 / (2 * 5.12e-3)).toFixed(1)} Hz`);
}

// 5. the swinging clock bends the pitch: the output at t left the input when the clock had counted
//    N/2 fewer cycles, so its frequency is the input's times fclk(t)/fclk(t_in)
function pitchSwing(P, seconds = 4) {
  const N = Number(P.stages), dt = 1e-5, n = Math.round(seconds / dt);
  const tri = (ph) => { const q = ph - Math.floor(ph); return q < 0.5 ? 4 * q - 1 : 3 - 4 * q; };
  const fclk = (t) => P.clock * (1 + P.depth * tri(0.25 + P.rate * t));
  const count = new Float64Array(n);
  for (let i = 1; i < n; i++) count[i] = count[i - 1] + 0.5 * dt * (fclk((i - 1) * dt) + fclk(i * dt));
  let lo = Infinity, hi = -Infinity, j = 0;
  for (let i = Math.round(1 / dt); i < n; i++) {
    while (count[j + 1] < count[i] - N / 2) j++;
    const r = fclk(i * dt) / fclk(j * dt);
    lo = Math.min(lo, r); hi = Math.max(hi, r);
  }
  return [1200 * Math.log2(lo), 1200 * Math.log2(hi)];
}
{
  const P = W({ mix: 1, rate: 2, depth: 0.3 }), f = 440, n = 4 * fs;
  const y = run(P, sine(f, fs, n, 0.1)).L;
  // the output's frequency from its rising zero crossings, over each 10 ms
  const cross = [];
  for (let i = fs; i < n - 1; i++) if (y[i] <= 0 && y[i + 1] > 0) cross.push(i + y[i] / (y[i] - y[i + 1]));
  let lo = Infinity, hi = -Infinity;
  for (let k = 5; k < cross.length; k++) { const fr = (5 * fs) / (cross[k] - cross[k - 5]); lo = Math.min(lo, fr); hi = Math.max(hi, fr); }
  const [wl, wh] = pitchSwing(P), cl = 1200 * Math.log2(lo / f), ch = 1200 * Math.log2(hi / f);
  check(Math.abs(cl - wl) < 0.1 * Math.abs(wl) + 1 && Math.abs(ch - wh) < 0.1 * wh + 1, 'Rate and Depth: the clock\'s triangle bends the pitch as counting its cycles says (10 %)', `${cl.toFixed(1)} to +${ch.toFixed(1)} cents against ${wl.toFixed(1)} to +${wh.toFixed(1)}`);
  const [, chorus] = pitchSwing(W({})), [, vib] = pitchSwing(PEDAL.presets['Vibrato'] && W(PEDAL.presets['Vibrato']));
  check(chorus > 5 && chorus < 7 && vib > 45 && vib < 60, 'the hint: at 15 % and 0.8 Hz the pitch wavers about 6 cents either way; the Vibrato preset about half a semitone', `${chorus.toFixed(1)} cents, ${vib.toFixed(1)} cents`);
}

// 6. the hints on the chip
{
  const P = (N, clk) => cppParts(W({ stages: N, clock: clk })).delay;
  check(Math.abs(P('1024', 100e3) - 5.12e-3) < 1e-12 && Math.abs(P('1024', 5e3) - 0.1024) < 1e-12, 'the hint: 5.12 ms through 1024 stages at 100 kHz, 102 ms at 5 kHz');
  check(PEDAL.expression === 'clock', 'an expression pedal sweeps the clock');
  // the clock runs: the engine's cycles over a second are the clock's
  const r = run(S({ clock: 37e3 }), new Float32Array(fs));
  check(Math.abs(r.ticks - 37e3) <= 1, 'the clock: 37 000 cycles in a second at 37 kHz', `${r.ticks}`);
}

// 7. hygiene
{
  const r = run(W({ feedback: 0.95 }), new Float32Array(fs));
  check(Math.max(...r.L.map(Math.abs)) === 0, 'silence in, silence out, even at 95 % feedback');
  const e = new Effect(fs);
  e.setParams(W({}));
  const bad = new Float32Array(128); bad[5] = NaN;
  const L = new Float32Array(8192), R = new Float32Array(8192);
  const ok = e.process(bad, L.subarray(0, 128), R.subarray(0, 128));
  e.process(sine(100, fs, 8192, 0.1), L, R);
  check(!ok && L.every(Number.isFinite) && Math.max(...L.map(Math.abs)) > 0.01, 'a NaN in comes out as a silent block, and the pedal recovers');
  e.destroy();
  check(L.every(Number.isFinite) && R.every((v, i) => v === L[i]), 'mono out on both sides');
  // a loud bass at 95 % feedback stays bounded: the loop's gain is under one everywhere
  const loud = run(W({ feedback: 0.95, mix: 1 }), sine(41.2, fs, 2 * fs, 1)).L;
  check(loud.every(Number.isFinite) && Math.max(...loud.map(Math.abs)) < 25, 'at 95 % feedback the loop stays bounded', `${Math.max(...loud.map(Math.abs)).toFixed(2)} V peak`);
  const lat = ['high', 'medium', 'low'].map((qu) => run(W({}), new Float32Array(128), qu).latency);
  check(lat[2] === 0 && lat[0] > 0 && lat[0] <= 5, 'latency: the oversampling filters\' few samples, none at low quality', lat.join(', '));
}

// 8. presets
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
  const n = 10 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 82.4 * i) / fs) * Math.exp(-(i % fs) / fs));
  for (const [qu, budget, P] of [['high', 0.06, W({})], ['high', 0.06, W({ stages: '4096', clock: 200e3, cti: 1e-3 })]]) {
    const e = new Effect(fs);
    e.setQuality(qu);
    e.setParams(P);
    const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
    e.process(inp, L, R);
    const share = (performance.now() - t0) / 1000 / 10;
    e.destroy();
    check(share < budget, `CPU: ${P.stages} stages at ${P.clock / 1e3} kHz, under ${(100 * budget).toFixed(0)} % of a core (WebAssembly)`, `${(100 * share).toFixed(1)} %`);
  }
}

done();
