// michelson-tests.mjs — the Michelson Interferometer against its physics worked out independently
// of the C++ (test/michelson-circuit.mjs: each source's spectrum integrated numerically, the mount's
// equation of motion, Bessel functions by their integral), the Jacobi–Anger expansion, the
// Ornstein–Uhlenbeck process's variance and memory, and each knob's hint.

import { check, done, CI } from './harness.mjs';
import { loadPedal, loadBass } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { amplitudeAt, db, sine, peak } from '../tools/audio-util.mjs';
import { tune } from '../shared/tuner.js';
import { intensity, contrast, rest, mount, coupling, besselJ, CENTRE, FULL_SCALE } from './michelson-circuit.mjs';
import { SOURCES } from '../michelson/src/michelson-params.js';

const { PEDAL, Effect } = await loadPedal('michelson');
const x = Effect.exports;
const fs = 48000;
// still air, at unity output, so each check sees only what it is about
const D = { ...defaults(PEDAL.groups), level: 0, air: 0 };
const W = (over) => ({ ...D, ...over });
const LIGHTS = SOURCES.map(([id]) => id);

// the C++ model through its exports
function call(fn, P, extra = [], args = []) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length).set(v);
  if (extra.length) s.f64(extra.length, 8 * v.length).set(extra);
  x[fn](s.at, ...args);
  return { n: v.length, read: (count, at = 0) => Array.from(s.f64(count, 8 * at)) };
}
const cppIntensity = (P, opds) => { const c = call('michelson_intensity', P, opds, [opds.length]); return c.read(opds.length, c.n + opds.length); };
const cppContrast = (P, opds) => { const c = call('michelson_contrast', P, opds, [opds.length]); return c.read(opds.length, c.n + opds.length); };
const cppMount = (P, freqs) => { const c = call('michelson_actuator', P, freqs, [freqs.length]); return c.read(2 * freqs.length, c.n + freqs.length); };
const cppParts = (P) => { const r = call('michelson_parts', P).read(16); return { rest: r[0], lambda0: r[1], stroke: r[11], air: r[12], airTime: r[13] }; };

function run(P, input, quality = 'high') {
  const e = new Effect(fs);
  e.setQuality(quality);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length);
  const ok = e.process(input, L, R);
  const out = { L, R, ok, messages: e.messages(), latency: e.latency() };
  e.destroy();
  return out;
}
const harmonics = (y, f, count) => Array.from({ length: count }, (_, j) => amplitudeAt(y, (j + 1) * f, fs));
const steady = (P, f = 100, a = 0.5, quality = 'high') => run(P, sine(f, fs, fs, a), quality).L.subarray(fs / 2);

// 1. the light: the C++'s closed-form visibilities against each spectrum integrated numerically
{
  for (const light of LIGHTS) {
    const l0 = CENTRE[light], opds = [0, 0.37 * l0, 3.1e-6, 41.3e-6, 290.9e-6, 1.2e-3].flatMap((o) => [o, o + 0.25 * l0]);
    const P = W({ light }), got = cppIntensity(P, opds), want = opds.map((o) => intensity(light, o));
    const worst = Math.max(...got.map((g, i) => Math.abs(g - want[i])));
    check(worst < 1e-6, `light, ${light}: the detector's light is the spectrum's own interference, integrated, out to 1.2 mm of path`, `worst ${worst.toExponential(1)}`);
  }
  const cWorst = Math.max(...LIGHTS.filter((l) => l !== 'white').flatMap((light) => [0, 20e-6, 145.4e-6, 290.9e-6, 600e-6].map((o) => Math.abs(cppContrast(W({ light }), [o])[0] - contrast(light, o)))));
  check(cWorst < 2e-3, 'light: the fringes\' contrast is the light\'s own swing over a wavelength, for the lasers and the lamp', `worst ${cWorst.toExponential(1)}`);
}

// 2. the bench: the micrometer to whole wavelengths, and the Fringe knob's phase
{
  let worst = 0;
  for (const light of LIGHTS) for (const arm of [0, 13.3e-6, 145.4e-6]) for (const fringe of [0, 90, 237]) worst = Math.max(worst, Math.abs(cppParts(W({ light, arm, fringe })).rest - rest({ light, arm, fringe })));
  check(worst < 1e-15, 'bench: the paths differ at rest by whole centre wavelengths (the micrometer) and the Fringe\'s fraction of one', `worst ${worst.toExponential(1)} m`);
  const I = (fringe) => cppIntensity(W({ fringe, arm: 0 }), [cppParts(W({ fringe, arm: 0 })).rest])[0];
  check(I(0) > 0.999 && I(180) < 0.001 && Math.abs(I(90) - 0.5) < 1e-3, 'Fringe: 0° is a bright fringe, 180° a dark one, 90° halfway up a side', `${I(0).toFixed(4)}, ${I(180).toFixed(4)}, ${I(90).toFixed(4)}`);
}

// 3. the mount: the C++'s response and the engine's against the equation of motion
{
  const freqs = [30, 80, 200, 1000, 5000];
  for (const m of ['piezo', 'speaker']) {
    const P = W({ mount: m }), got = cppMount(P, freqs);
    const worst = Math.max(...freqs.map((f, i) => Math.abs(got[i] / mount(P, f).abs - 1)));
    check(worst < 1e-12, `mount, ${m}: the mirror's travel per volt is its equation of motion's`, `worst ${worst.toExponential(1)}`);
  }
  const sp = W({ mount: 'speaker' }), oct = db(mount(sp, 640).abs / mount(sp, 320).abs);
  check(Math.abs(oct + 12) < 0.5, 'the hint: above its 80 Hz resonance, the loudspeaker\'s cone travels 12 dB less each octave up', `${oct.toFixed(2)} dB from 320 to 640 Hz`);
  const pz = W({}), flat = Math.max(...[41, 100, 400, 1000].map((f) => Math.abs(db(mount(pz, f).abs / pz.stroke))));
  check(flat < 0.05, 'the piezo stack follows the voltage across a bass\'s range', `within ${flat.toFixed(3)} dB, 41 Hz–1 kHz`);
  // the engine's small-signal gain, mid-fringe: full scale × ½ × 2k × the mount × the coupling
  for (const m of ['piezo', 'speaker']) {
    let worst = 0;
    for (const f of [20, 50, 80, 200, 1000, 4000]) {
      const P = W({ mount: m, arm: 0 }), a = 1e-4, n = 16384, settle = 24000;
      const g = amplitudeAt(run(P, sine(f, fs, n + settle, a)).L.subarray(settle), f, fs) / a;
      const want = FULL_SCALE * 0.5 * ((4 * Math.PI) / CENTRE.hene) * mount(P, f).abs * coupling(f);
      worst = Math.max(worst, Math.abs(db(g / want)));
    }
    check(worst < 0.2, `small signal, ${m}: mid-fringe the engine is a linear sensor of the mirror's travel, as the fringe's slope says`, `worst ${worst.toFixed(3)} dB, 20 Hz–4 kHz`);
  }
}

// 4. a sine on the mirror: Jacobi–Anger, harmonic by harmonic, against Bessel functions
{
  const f = 100, a = 0.5;
  for (const [fringe, name] of [[90, 'mid-fringe'], [0, 'bright fringe'], [45, 'between']]) {
    for (const stroke of [100e-9, 400e-9, 1.5e-6]) {
      const P = W({ fringe, stroke, arm: 0 }), beta = ((4 * Math.PI) / CENTRE.hene) * mount(P, f).abs * a;
      const got = harmonics(steady(P, f, a), f, 8);
      const want = got.map((_, j) => { const n = j + 1, c = n % 2 ? Math.sin((fringe * Math.PI) / 180) : Math.cos((fringe * Math.PI) / 180); return FULL_SCALE * Math.abs(besselJ(n, beta) * c) * coupling(n * f); });
      const worst = Math.max(...got.map((g, j) => Math.abs(g - want[j])));
      check(worst < 2e-3, `Bessel, ${name}, ${(stroke * 1e9).toFixed(0)} nm/V: the first eight harmonics are |J_n(β)| (β = ${beta.toFixed(2)})`, `worst ${(1000 * worst).toFixed(2)} mV`);
    }
  }
  const odd = harmonics(steady(W({ fringe: 90 })), 100, 6), even = harmonics(steady(W({ fringe: 0 })), 100, 6);
  check(odd[1] + odd[3] + odd[5] < 1e-3 * odd[2] && even[0] + even[2] + even[4] < 1e-3 * even[1], 'Fringe: mid-fringe makes odd harmonics only; on a crest, even ones only, the note an octave up',
    `even at 90°: ${(1000 * (odd[1] + odd[3] + odd[5])).toFixed(3)} mV; odd at 0°: ${(1000 * (even[0] + even[2] + even[4])).toFixed(3)} mV`);
  const quiet = harmonics(steady(W({ fringe: 90 }), 100, 0.02), 100, 3);
  check(quiet[2] < 0.01 * quiet[0], 'and a quiet note mid-fringe comes through nearly unchanged', `3rd harmonic ${db(quiet[2] / quiet[0]).toFixed(1)} dB`);
}

// 5. the hints
{
  const sw = (2 * 400e-9 * 0.5) / CENTRE.hene;
  check(Math.abs(sw - 0.63) < 0.01, 'Stroke: at 400 nm/V a 0.5 V note swings the red laser\'s paths by 0.63 of a wavelength each way', sw.toFixed(3));
  const folds = (stroke) => { const y = steady(W({ stroke, arm: 0 })); let n = 0; for (let i = 2; i < 480; i++) if ((y[i] - y[i - 1]) * (y[i - 1] - y[i - 2]) < 0) n++; return n; };
  check(folds(4e-6) > folds(400e-9) && folds(400e-9) > folds(50e-9), 'more Stroke, more folds a cycle', `${folds(50e-9)}, ${folds(400e-9)}, ${folds(4e-6)} turns a period at 50, 400, 4000 nm/V`);
  check(Math.abs(CENTRE.hene / CENTRE.violet - 1.6) < 0.05, 'Light: violet folds 1.6 times as often as red', (CENTRE.hene / CENTRE.violet).toFixed(2));
  const c = (light, arm) => cppContrast(W({ light }), [rest({ light, arm, fringe: 90 })])[0];
  check(Math.abs(c('violet', 36e-6) - 0.5) < 0.05 && c('violet', 0) > 0.99, 'Arm difference: the violet diode\'s contrast halves at about 36 µm', `${c('violet', 36e-6).toFixed(3)}`);
  check(Math.abs(c('sodium', 145.4e-6) - 1 / 3) < 0.01 && c('sodium', 290.9e-6) > 0.99 && c('sodium', 0) > 0.99, 'and the sodium lamp\'s falls to a third at 145 µm and is back at 291 µm', `${c('sodium', 0).toFixed(3)}, ${c('sodium', 145.4e-6).toFixed(3)}, ${c('sodium', 290.9e-6).toFixed(3)}`);
  check(c('white', 0) > 0.99 && c('white', 1e-6) < 0.5 && c('white', 2e-6) > 0.05 && c('white', 2e-6) < 0.3 && c('white', 5e-6) < 0.05, 'and the white LED\'s is strong only within a micrometre, faint (blue) out to a few', `${c('white', 0).toFixed(2)}, ${c('white', 1e-6).toFixed(2)} at 1 µm, ${c('white', 2e-6).toFixed(3)} at 2 µm, ${c('white', 5e-6).toFixed(3)} at 5 µm`);
  check(c('hene', 600e-6) > 0.99, 'with the red laser it hardly matters', c('hene', 600e-6).toFixed(4));
  // the white LED: a big stroke carries the mirror out of its fringes and back
  const wl = run(W({ light: 'white', arm: 0, stroke: 4e-6 }), sine(50, fs, fs, 0.5)).messages.filter((m) => m.type === 1).flatMap((m) => [0, 1, 2, 3, 4, 5, 6, 7, 8].map((j) => [m.values[3 * j], m.values[3 * j + 2]]));
  const inside = wl.filter(([xx]) => Math.abs(xx) < 100).map(([, I]) => I), outside = wl.filter(([xx]) => Math.abs(xx) > 1500).map(([, I]) => I);
  const swing = (v) => Math.max(...v) - Math.min(...v);
  check(swing(inside) > 0.5 && swing(outside) < 0.15, 'white light: near zero path the light swings, a micrometre and more away it hardly does', `${swing(inside).toFixed(2)} within 0.1 µm, ${swing(outside).toFixed(2)} beyond 1.5 µm`);
  // Level: never more than a volt from lowest to highest
  let span = 0;
  for (const fringe of [0, 45, 90, 180]) { const y = steady(W({ fringe, stroke: 2e-6 }), 100, 1); span = Math.max(span, Math.max(...y) - Math.min(...y)); }
  check(span <= 1.02, 'Level: from its lowest to its highest the output spans no more than a volt, however hard you play', `${span.toFixed(3)} V`);
  // the air: its drift's size and memory (Ornstein–Uhlenbeck), from the engine's own record
  const P = W({ air: 80e-9 }), msgs = run(P, new Float32Array(60 * fs), 'low').messages.filter((m) => m.type === 1);
  const wv = msgs.flatMap((m) => [0, 1, 2, 3, 4, 5, 6, 7, 8].map((j) => m.values[3 * j + 1] * 1e-9));
  const mean = wv.reduce((a, b) => a + b, 0) / wv.length, sd = Math.sqrt(wv.reduce((a, b) => a + (b - mean) ** 2, 0) / wv.length);
  const lag = Math.round((0.5 * fs) / 36); // half a second, in points
  let num = 0, den = 0;
  for (let i = 0; i + lag < wv.length; i++) { num += (wv[i] - mean) * (wv[i + lag] - mean); den += (wv[i] - mean) ** 2; }
  check(Math.abs(sd / 80e-9 - 1) < 0.3 && Math.abs(num / den - Math.exp(-1)) < 0.15, 'Air currents: the arm drifts by the RMS set, and forgets over half a second (e^−1)', `${(sd * 1e9).toFixed(0)} nm RMS, ${(num / den).toFixed(2)} correlated after 0.5 s`);
  check(Math.abs((80e-9 / (CENTRE.hene / 2)) - 0.25) < 0.01, 'at 80 nm, a quarter of a red fringe', (80e-9 / (CENTRE.hene / 2)).toFixed(3));
}

// 6. aliasing: averaging each cosine over its step, and oversampling, keep a deep fold's inharmonic products down
{
  const f = 1000, n = 4800; // 100 periods, so the harmonics fall on bins exactly
  const inharmonic = (q) => {
    const y = run(W({ stroke: 1e-6 }), sine(f, fs, fs + n, 0.5), q).L.subarray(fs);
    let tot = 0, bad = 0;
    for (let k = 1; k < n / 2; k++) {
      let re = 0, im = 0;
      for (let i = 0; i < n; i++) { const w = (2 * Math.PI * k * i) / n; re += y[i] * Math.cos(w); im -= y[i] * Math.sin(w); }
      const pw = re * re + im * im, h = (k * fs) / n / f;
      tot += pw;
      if (Math.abs(h - Math.round(h)) > 1e-6) bad += pw;
    }
    return 10 * Math.log10(bad / tot);
  };
  const hi = inharmonic('high'), lo = inharmonic('low');
  check(hi < -40 && hi < lo, 'aliasing: a deep fold of a 1 kHz note keeps its inharmonic products 40 dB down at high quality', `${hi.toFixed(1)} dB at high, ${lo.toFixed(1)} dB at low`);
}

// 7. hygiene
{
  const r = run(W({}), new Float32Array(fs));
  check(peak(r.L) < 1e-9, 'silence in, silence out (still air)', `${peak(r.L).toExponential(1)} V`);
  const e = new Effect(fs);
  e.setParams(W({}));
  const bad = new Float32Array(128); bad[5] = NaN;
  const L = new Float32Array(4096), R = new Float32Array(4096);
  const ok = e.process(bad, L.subarray(0, 128), R.subarray(0, 128));
  e.process(sine(100, fs, 4096, 0.1), L, R);
  check(!ok && L.every(Number.isFinite) && peak(L) > 0.01, 'a NaN in comes out as a silent block, and the pedal recovers');
  e.destroy();
  check(R.every((v, i) => v === L[i]), 'mono out on both sides');
  const lat = ['high', 'medium', 'low'].map((q) => run(W({}), new Float32Array(128), q).latency);
  check(lat[2] === 0 && lat[0] > 0 && lat[0] <= 5, 'latency: the oversampling filters\' few samples, none at low quality', lat.join(', '));
  const ids = new Map(PEDAL.groups.flatMap((g) => g.params).map((p) => [p.id, p]));
  const badP = Object.entries(PEDAL.presets).flatMap(([n, v]) => Object.entries(v).filter(([id, val]) => {
    const p = ids.get(id);
    if (!p) return true;
    if (p.type === 'select') return !p.options.some(([o]) => o === val);
    return typeof val === 'number' && (val < p.min || val > p.max);
  }).map(([id]) => `${n}: ${id}`));
  check(!badP.length, 'every preset sets real parameters inside their ranges', badP.join(', '));
}

// 8. end to end: the test bass's note keeps its pitch through a gentle stroke mid-fringe
{
  const TB = await loadBass(), b = new TB(fs);
  b.note(33, 0.8);
  const dry = new Float32Array(fs);
  b.process(dry);
  const y = run(W({ stroke: 100e-9 }), dry).L;
  const f0 = tune(y.subarray(4800, 4800 + 16384), fs), want = tune(dry.subarray(4800, 4800 + 16384), fs);
  check(f0 && want && Math.abs(1200 * Math.log2(f0 / want)) < 2, 'the test bass\'s A keeps its pitch through the light, to the tuner\'s eye (2 cents)', `${f0?.toFixed(3)} Hz out for ${want?.toFixed(3)} Hz in`);
}

// 9. CPU
if (!CI) {
  const n = 10 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 82.4 * i) / fs) * Math.exp(-(i % fs) / fs));
  for (const [q, budget, P] of [['high', 0.06, W({})], ['high', 0.08, W({ light: 'white', air: 50e-9 })], ['medium', 0.04, W({})]]) {
    const e = new Effect(fs);
    e.setQuality(q);
    e.setParams(P);
    const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
    e.process(inp, L, R);
    const share = (performance.now() - t0) / 1000 / 10;
    e.destroy();
    check(share < budget, `CPU: ${q} quality, ${P.light}, under ${(100 * budget).toFixed(0)} % of a core (WebAssembly)`, `${(100 * share).toFixed(1)} %`);
  }
}

done();
