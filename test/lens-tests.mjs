// lens-tests.mjs — the Gravitational Lens against its physics worked out independently of the C++
// (test/lens-circuit.mjs: the images from the lens equation, Paczyński's magnification, the time
// delay, Takahashi and Nakamura's wave-optics amplification by its series with a complex Γ and ₁F₁,
// geometric optics, and the area of the lens plane integrated over the angle rather than the
// radius), the engine against its own kernel, and each knob's hint.

import { check, done, CI } from './harness.mjs';
import { loadPedal, loadBass } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { peak, sine } from '../tools/audio-util.mjs';
import { tune } from '../shared/tuner.js';
import { UNIT_SUN, cx, images, paczynski, timeDelay, amplification, geometric, area } from './lens-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('lens');
const x = Effect.exports;
const fs = 48000;
const D = { ...defaults(PEDAL.groups), level: 0 };
const W = (over) => ({ ...D, ...over });
const hint = (id) => PEDAL.groups.flatMap((g) => g.params).find((p) => p.id === id).hint;
const db = (v) => 20 * Math.log10(v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// the C++ model through its exports
function call(fn, P, extra = [], args = []) {
  const s = scratch(x), v = P ? Effect.native(P) : [];
  if (v.length) s.f64(v.length).set(v);
  if (extra.length) s.f64(extra.length, 8 * v.length).set(extra);
  x[fn](s.at, ...args);
  return { n: v.length, read: (count, at = 0) => Array.from(s.f64(count, 8 * at)) };
}
const cppParts = (P) => { const r = call('lens_parts', P).read(11); return { unit: r[0], xp: r[1], xm: r[2], Tp: r[3], Tm: r[4], mup: r[5], mum: r[6], delay: r[7], A: r[8], f1: r[9] }; };
// the waves' (the kernel's), the rays' (as played) and geometric optics' responses at rate r
function cppResponse(P, freqs, r = fs) {
  const n = freqs.length, c = call('lens_response', P, [r, ...freqs], [n]), v = c.read(6 * n, c.n + 1 + n);
  const pair = (k) => freqs.map((_, i) => [v[2 * k * n + i] * Math.cos(v[(2 * k + 1) * n + i]), v[2 * k * n + i] * Math.sin(v[(2 * k + 1) * n + i])]);
  return { waves: pair(0), rays: pair(1), geometric: pair(2) };
}
// the waves' kernel at rate r: its length and first n taps
function cppKernel(P, n, r = fs) { const c = call('lens_kernel', P, [r], [n + 1]), v = c.read(n + 1, c.n + 1); return { length: v[0], h: v.slice(1) }; }
const cppArea = (y, taus) => call('lens_area', null, [y, ...taus], [taus.length]).read(taus.length, 1 + taus.length);

function run(P, input, { blocks = 128 } = {}) {
  const e = new Effect(fs);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length);
  let ok = true;
  for (let i = 0; i < input.length; i += blocks) ok = e.process(input.subarray(i, i + blocks), L.subarray(i, i + blocks), R.subarray(i, i + blocks)) && ok;
  const out = { L, R, ok, messages: e.messages(), latency: e.latency() };
  e.destroy();
  return out;
}
const impulse = (P, n) => { const u = new Float32Array(n); u[0] = 1; return run(P, u).L; };
// a sequence's response at f (Hz), e^{−iωt}
function dft(h, f, r = fs) {
  const w = (2 * Math.PI * f) / r;
  let re = 0, im = 0;
  for (let i = 0; i < h.length; i++) { re += h[i] * Math.cos(w * i); im -= h[i] * Math.sin(w * i); }
  return [re, im];
}

// 1. the images: where they are, how bright, how late
{
  let worst = 0;
  for (const y of [0.02, 0.1, 0.5, 1, 3]) {
    const p = cppParts(W({ offset: y })), im = images(y);
    worst = Math.max(worst, Math.abs(p.xp - im.xp), Math.abs(p.xm - im.xm), Math.abs(p.mup - im.mup) / im.mup, Math.abs(p.mum - im.mum) / Math.abs(im.mum),
      Math.abs(p.A - paczynski(y)) / paczynski(y), Math.abs(p.Tm - p.Tp - timeDelay(y)) / timeDelay(y));
  }
  check(worst < 1e-12, 'the images: positions from the lens equation, magnifications from its Jacobian, Paczyński\'s total and Takahashi and Nakamura\'s delay', `worst ${worst.toExponential(1)}`);
  const p = cppParts(W({ mass: 250, redshift: 0.6 }));
  check(Math.abs(p.unit / (UNIT_SUN * 250 * 1.6) - 1) < 1e-12 && Math.abs(UNIT_SUN * 1e6 - 19.70) < 0.005, 'the time unit is 4GM(1 + z)/c³, 19.70 µs a sun (IAU 2015 B3)', `${(UNIT_SUN * 1e6).toFixed(4)} µs`);
}

// 2. the area of the lens plane arriving before τ: over the radius (C++) and over the angle (here)
{
  let worst = 0;
  for (const y of [0.05, 0.5, 2]) {
    const im = images(y), taus = [im.Tp + 1e-3, (im.Tp + im.Tm) / 2, im.Tm - 1e-4, im.Tm + 1e-4, im.Tm + 0.5, im.Tm + 30];
    const c = cppArea(y, taus);
    taus.forEach((t, i) => { worst = Math.max(worst, Math.abs(c[i] - area(t, y)) / Math.max(1e-6, area(t, y))); });
  }
  check(worst < 1e-8, 'the area arriving before τ: integrated over the radius in C++, over the angle here', `worst relative ${worst.toExponential(1)}`);
}

// 3. waves: the kernel's response against Takahashi and Nakamura's eq. 17 (Peters's exact solution)
{
  let worstDb = 0, worstPh = 0, count = 0;
  for (const y of [0.1, 0.5, 1, 2]) for (const w of [0.1, 0.3, 1, 3, 10, 20]) {
    if ((w * y * y) / 2 > 8) continue; // the series loses its digits beyond
    // a mass that puts w at 200 Hz
    const M = Math.min(1000, Math.max(1, w / (2 * Math.PI * 200 * UNIT_SUN))), P = W({ mass: M, offset: y }), p = cppParts(P), f = w / (2 * Math.PI * p.unit);
    const H = cppResponse(P, [f]).waves[0], F = cx.conj(amplification(w, y)); // their e^{+iwt}, ours e^{−iωt}
    worstDb = Math.max(worstDb, Math.abs(db(cx.abs(H)) - db(cx.abs(F))));
    worstPh = Math.max(worstPh, Math.abs(wrap(cx.arg(H) - cx.arg(F))));
    count++;
  }
  check(worstDb < 0.005 && worstPh < 0.002, `waves: the kernel's response is Takahashi and Nakamura's F(w, y) (eq. 17) at ${count} points, w from 0.1 to 20, y from 0.1 to 2`, `worst ${worstDb.toFixed(4)} dB, ${worstPh.toFixed(4)} rad`);
}

// 4. waves: the long-wave limit and the spike
{
  const P = W({}), k = cppKernel(P, 6000);
  const sum = k.h.reduce((a, v) => a + v, 0);
  check(k.length < 6000 && Math.abs(sum - 1) < 1e-9, 'waves: the kernel sums to one, F(0) = 1: the longest waves pass round the lens untouched', `Σh − 1 = ${(sum - 1).toExponential(1)}, ${k.length} taps`);
  // 20 Hz behind 10 suns, w = 0.025
  const P10 = W({ mass: 10 }), w20 = 2 * Math.PI * 20 * cppParts(P10).unit, H = cppResponse(P10, [20]).waves[0], F = cx.conj(amplification(w20, 0.5));
  check(Math.abs(cx.abs(H) - cx.abs(F)) < 1e-3 && cx.abs(F) < 1.02, `waves: at 20 Hz behind 10 suns (w = ${w20.toFixed(3)}) the lens barely brightens, as eq. 17 has it`, `|F| ${cx.abs(H).toFixed(4)} against ${cx.abs(F).toFixed(4)}`);
  const im = images(0.5);
  check(Math.abs(k.h[0] / Math.sqrt(im.mup) - 1) < 2e-3, 'waves: the kernel begins with the first image\'s spike, √μ₊', `${k.h[0].toFixed(4)} against ${Math.sqrt(im.mup).toFixed(4)}`);
}

// 5. waves at high frequency approach geometric optics (eq. 18), averaged over the comb
{
  const rows = [];
  let worst = 0;
  for (const y of [0.5, 1]) {
    const P = W({ mass: 1000, offset: y }), p = cppParts(P);
    for (const w of [30, 100, 300]) {
      // the power over one period of the comb around w
      const fc = w / (2 * Math.PI * p.unit), freqs = Array.from({ length: 64 }, (_, i) => fc + (i / 64 - 0.5) / p.delay), r = cppResponse(P, freqs);
      const pw = r.waves.reduce((a, v) => a + cx.abs(v) ** 2, 0) / 64, pg = freqs.reduce((a, f) => a + cx.abs(geometric(2 * Math.PI * f * p.unit, y)) ** 2, 0) / 64;
      worst = Math.max(worst, Math.abs(10 * Math.log10(pw / pg)));
      rows.push(`${(10 * Math.log10(pw / pg)).toFixed(3)}`);
      // and the average is Paczyński's
      worst = Math.max(worst, Math.abs(10 * Math.log10(pg / paczynski(y))));
    }
  }
  check(worst < 0.05, 'waves: from w = 30 to 300 (up to 2.4 kHz behind 1000 suns) the comb\'s average power is geometric optics\' (eq. 18), which is Paczyński\'s |μ₊| + |μ₋|', `${rows.join(', ')} dB`);
}

// 6. rays: geometric optics, causally
{
  let worst = 0, worstModel = 0;
  for (const P of [W({ optics: 'rays' }), W({ optics: 'rays', mass: 3 }), W({ optics: 'rays', mass: 1000, offset: 1 })]) {
    const p = cppParts(P), freqs = Array.from({ length: 80 }, (_, i) => 20 * 1000 ** (i / 79)), r = cppResponse(P, freqs);
    freqs.forEach((f, i) => { worst = Math.max(worst, Math.abs(db(cx.abs(r.rays[i])) - db(cx.abs(geometric(2 * Math.PI * f * p.unit, P.offset))))); });
    // the engine plays what the model says, below 0.3 fs (above, the sinc that reads between samples rolls off)
    const h = impulse(P, 1 << 16), low = freqs.filter((f) => f < 0.3 * fs);
    low.forEach((f) => { const i = freqs.indexOf(f); worstModel = Math.max(worstModel, cx.abs(cx.sub(dft(h, f), r.rays[i])) / cx.abs(r.rays[i])); });
  }
  check(worst < 0.06, 'rays: the two allpass chains give geometric optics\' size (eq. 18) from 20 Hz to 20 kHz, the second image turned a quarter cycle', `worst ${worst.toFixed(3)} dB`);
  check(worstModel < 1e-3, 'rays: the engine\'s impulse response is the model\'s below 0.3 fs', `worst relative ${worstModel.toExponential(1)}`);
  // the sinc's top end, for the README: the second image at 0.42 fs
  const P = W({ optics: 'rays', mass: 30, offset: 0.5 }), p = cppParts(P), f = 0.42 * fs, h = impulse(P, 1 << 15);
  const model = cppResponse(P, [f]).rays[0], got = dft(h, f);
  check(Math.abs(db(cx.abs(got)) - db(cx.abs(model))) < 0.4, 'rays: at 20 kHz (0.42 fs) the windowed sinc still passes the saddle\'s image within 0.4 dB', `${(db(cx.abs(got)) - db(cx.abs(model))).toFixed(2)} dB, delay ${(p.delay * fs).toFixed(2)} samples`);
}

// 7. the engine is the kernel: its impulse response, in blocks of any size, and its changes
{
  for (const P of [W({}), W({ mass: 1000, offset: 3 }), W({ mass: 1, offset: 0.02 })]) {
    const k = cppKernel(P, 8000), h = impulse(P, 8000);
    let err = 0;
    for (let i = 0; i < 8000; i++) err = Math.max(err, Math.abs(h[i] - k.h[i]));
    check(err < 2e-6, `${P.mass} suns, ${P.offset} θE: the engine's impulse response is the kernel, tap for tap`, `worst ${err.toExponential(1)} (float), ${k.length} taps`);
  }
  // odd block sizes
  const u = sine(110, fs, 20000, 0.2), a = run(W({}), u, { blocks: 128 }).L, b = run(W({}), u, { blocks: 37 }).L;
  let d = 0;
  for (let i = 0; i < u.length; i++) d = Math.max(d, Math.abs(a[i] - b[i]));
  check(d < 1e-6, 'blocks of 37 samples give what blocks of 128 do', `${d.toExponential(1)}`);
  check(run(W({}), new Float32Array(128)).latency === 0, 'no latency: the first image arrives with the input');
  // a change of lens: built a little each block, then faded to
  const e = new Effect(fs);
  e.setParams(W({}));
  const n = fs, inp = new Float32Array(n), L = new Float32Array(n), R = new Float32Array(n);
  e.process(inp.subarray(0, 4800), L.subarray(0, 4800), R.subarray(0, 4800));
  e.setParams(W({ mass: 400, offset: 1.5 }));
  e.process(inp.subarray(4800, 4800 + 9600), L.subarray(4800, 4800 + 9600), R.subarray(4800, 4800 + 9600)); // 0.2 s
  inp[24000] = 1;
  e.process(inp.subarray(14400), L.subarray(14400), R.subarray(14400));
  const msgs = e.messages().filter((m) => m.type === 1);
  e.destroy();
  const k = cppKernel(W({ mass: 400, offset: 1.5 }), 8000);
  let err = 0;
  for (let i = 0; i < 8000 && 24000 + i < n; i++) err = Math.max(err, Math.abs(L[24000 + i] - k.h[i]));
  check(err < 2e-6, 'a new lens is built and faded to within 0.2 s, and then is heard exactly', `worst ${err.toExponential(1)}`);
  check(msgs.some((m) => m.values[2] > 0.5) && msgs.at(-1).values[2] === 0, 'the page hears that a new lens is on its way, and when it has arrived');
}

// 8. redshift is mass: M at z is M(1 + z) nearby
{
  const a = cppKernel(W({ mass: 50, redshift: 1 }), 4000), b = cppKernel(W({ mass: 100 }), 4000);
  check(a.length === b.length && a.h.every((v, i) => Math.abs(v - b.h[i]) < 1e-12), '50 suns at z = 1 is 100 suns nearby: the same kernel');
}

// 9. the hints
{
  const p100 = cppParts(W({})), p1000 = cppParts(W({ mass: 1000 })), p1 = cppParts(W({ mass: 1 }));
  const said = (id, v) => hint(id).includes(v);
  check(said('mass', `${(UNIT_SUN * 1e6).toFixed(1)} µs`) && said('mass', `${(p100.delay * 1e3).toFixed(2)} ms`) && said('mass', `${(p1000.delay * 1e3).toFixed(1)} ms`) && said('mass', `${p100.f1.toFixed(0)} Hz`) && said('mass', `${(p1.f1 / 1e3).toFixed(1)} kHz`),
    'the Mass hint: 19.7 µs a sun, 1.99 and 19.9 ms, 81 Hz and 8.1 kHz', `${(p100.delay * 1e3).toFixed(3)}, ${(p1000.delay * 1e3).toFixed(2)} ms; ${p100.f1.toFixed(1)} Hz, ${p1.f1.toFixed(0)} Hz`);
  const o05 = cppParts(W({ offset: 0.05 })), o3 = cppParts(W({ offset: 3 }));
  check(said('offset', `${p100.A.toFixed(2)} times`) && said('offset', `${(10 * Math.log10(p100.A)).toFixed(1)} dB`) && said('offset', `${o05.A.toFixed(1)} times`) && said('offset', `(${(o05.delay * 1e3).toFixed(2)} ms)`)
    && said('offset', `${(100 * Math.sqrt(-o3.mum / o3.mup)).toFixed(1)} %`) && said('offset', `${(o3.delay * 1e3).toFixed(1)} ms`),
  'the Offset hint: 2.18 times (3.4 dB) at 0.5; 20.0 times, 0.20 ms at 0.05; 9.2 % as loud and 15.4 ms late at 3', `${p100.A.toFixed(3)}, ${o05.A.toFixed(2)}, ${(100 * Math.sqrt(-o3.mum / o3.mup)).toFixed(2)} %, ${(o3.delay * 1e3).toFixed(2)} ms`);
  // the open E behind 3 suns, through each optics: what the engine plays, by its own response
  const E = 41.2034, gainOf = (P) => { const h = impulse(P, 1 << 15); return db(cx.abs(dft(h, E))); };
  const gw = gainOf(W({ mass: 3 })), gr = gainOf(W({ mass: 3, optics: 'rays' }));
  check(said('optics', `${gw.toFixed(1)} dB louder`) && said('optics', `${gr.toFixed(1)} dB on the same E`), 'the Optics hint: behind 3 suns the open E 0.1 dB louder in waves, 3.4 dB in rays', `${gw.toFixed(2)}, ${gr.toFixed(2)} dB`);
  const z1 = cppParts(W({ redshift: 1 }));
  check(said('redshift', `${(z1.delay * 1e3).toFixed(2)} ms late`) && Math.abs(z1.delay / p100.delay - 2) < 1e-12, 'the Redshift hint: z = 1 doubles the delay, 3.98 ms', `${(z1.delay * 1e3).toFixed(3)} ms`);
  const u = sine(200, fs, 9600, 0.1), a = run(W({ level: -8 }), u).L, b = run(W({ level: 12 }), u).L;
  check(Math.abs(peak(b.subarray(4800)) / peak(a.subarray(4800)) - 10) < 1e-3, 'the Level hint: gain in decibels (20 dB more is ten times)');
}

// 10. hygiene
{
  const r = run(W({}), new Float32Array(fs));
  check(peak(r.L) < 1e-9, 'silence in, silence out', `${peak(r.L).toExponential(1)} V`);
  for (const P of [W({}), W({ optics: 'rays' })]) {
    const e = new Effect(fs);
    e.setParams(P);
    const bad = new Float32Array(128); bad[5] = NaN;
    const L = new Float32Array(4096), R = new Float32Array(4096);
    const ok = e.process(bad, L.subarray(0, 128), R.subarray(0, 128));
    e.process(sine(100, fs, 4096, 0.1), L, R);
    check(!ok && L.every(Number.isFinite) && peak(L) > 1e-3, `${P.optics}: a NaN in comes out as a silent block, and the pedal recovers`);
    e.destroy();
    check(R.every((v, i) => v === L[i]), `${P.optics}: mono out on both sides`);
  }
  const ids = new Map(PEDAL.groups.flatMap((g) => g.params).map((p) => [p.id, p]));
  const badP = Object.entries(PEDAL.presets).flatMap(([nm, v]) => Object.entries(v).filter(([id, val]) => {
    const p = ids.get(id);
    if (!p) return true;
    if (p.type === 'select') return !p.options.some(([o]) => o === val);
    return typeof val === 'number' && (val < p.min || val > p.max);
  }).map(([id]) => `${nm}: ${id}`));
  check(!badP.length, 'every preset sets real parameters inside their ranges', badP.join(', '));
  // sweeping the lens and the optics mid-note stays finite and bounded
  const e = new Effect(fs), n = 2 * fs, L = new Float32Array(n), R = new Float32Array(n), u = sine(82.4, fs, n, 0.3);
  e.setParams(W({}));
  for (let i = 0; i < n; i += 128) {
    if (i % 2048 === 0) e.setParams(W({ offset: 0.02 + 2.9 * (i / n), mass: 1 + 999 * (i / n), optics: i > n / 2 ? 'rays' : 'waves' }));
    e.process(u.subarray(i, i + 128), L.subarray(i, i + 128), R.subarray(i, i + 128));
  }
  e.destroy();
  check(L.every(Number.isFinite) && peak(L) < 10, 'sweeping mass, offset and optics mid-note stays finite and bounded', `${peak(L).toFixed(3)} V`);
}

// 11. end to end: the test bass's note keeps its pitch through the lens (it is linear and still)
{
  const TB = await loadBass(), b = new TB(fs);
  b.note(33, 0.8);
  const dry = new Float32Array(fs);
  b.process(dry);
  for (const P of [W({}), W({ optics: 'rays' })]) {
    const y = run(P, dry).L;
    const f0 = tune(y.subarray(4800, 4800 + 16384), fs), want = tune(dry.subarray(4800, 4800 + 16384), fs);
    check(f0 && want && Math.abs(1200 * Math.log2(f0 / want)) < 2, `${P.optics}: the test bass's A keeps its pitch through the lens (2 cents)`, `${f0?.toFixed(3)} Hz out for ${want?.toFixed(3)} Hz in`);
  }
}

// 12. CPU, at the heaviest: the longest kernel, rebuilt as the offset sweeps
if (!CI) {
  const n = 10 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 82.4 * i) / fs));
  const e = new Effect(fs);
  e.setParams(W({ mass: 1000, offset: 3 }));
  const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
  for (let i = 0; i < n; i += 128) {
    if (i % 4800 === 0) e.setParams(W({ mass: 1000, offset: 3 - 2 * (i / n) }));
    e.process(inp.subarray(i, i + 128), L.subarray(i, i + 128), R.subarray(i, i + 128));
  }
  const share = (performance.now() - t0) / 1000 / 10;
  e.destroy();
  check(share < 0.05, 'CPU, 1000 suns three Einstein radii off, the lens moving ten times a second: under 5 % of a core (WebAssembly)', `${(100 * share).toFixed(1)} %`);
}

done();
