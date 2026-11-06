// openair-tests.mjs — Open Air against the field worked out independently of the C++
// (test/openair-circuit.mjs): the air's absorption against ISO 9613-2's table; the Faddeeva function
// against its differential equation integrated by Runge–Kutta; the ground's reflection against Weyl
// and van der Pol's formula written out again; its limits (a rigid ground a perfect mirror, a
// plane wave far off, the two paths in phase at the lowest frequencies, and over a hard ground the
// nulls where the paths differ by half a wavelength); then the engine's filter against the response;
// and each knob's hint.

import { check, done, CI } from './harness.mjs';
import { loadPedal } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { amplitudeAt, db, sine } from '../tools/audio-util.mjs';
import { GROUNDS, RANGES, C, iso, speed, miki, faddeeva, field, planeWave, reflection, response } from './openair-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('openair');
const x = Effect.exports;
const fs = 48000;
const D = { ...defaults(PEDAL.groups), level: 0 };
const W = (over) => ({ ...D, ...over });
const knob = (id) => PEDAL.groups.flatMap((g) => g.params).find((p) => p.id === id).hint;

// the C++ model through its exports
function call(fn, P, extra = [], args = []) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length).set(v);
  if (extra.length) s.f64(extra.length, 8 * v.length).set(extra);
  x[fn](s.at, ...args);
  return { n: v.length, read: (count, at = 0) => Array.from(s.f64(count, 8 * at)) };
}
const cppParts = (P) => { const r = call('openair_parts', P).read(6); return { r1: r[0], r2: r[1], cos: r[2], c: r[3], sigma: r[4], lag: r[5] }; };
function cppSpectrum(P, freqs, what = 0) {
  const out = [];
  for (let i = 0; i < freqs.length; i += 1000) {
    const f = freqs.slice(i, i + 1000), c = call('openair_spectrum', P, f, [f.length, what]), r = c.read(2 * f.length, c.n + f.length);
    f.forEach((_, j) => out.push([r[2 * j], r[2 * j + 1]]));
  }
  return out;
}
const cppAbsorption = (P, freqs) => { const c = call('openair_absorption', P, freqs, [freqs.length]); return c.read(freqs.length, c.n + freqs.length); };
const cppFaddeeva = (zs) => { const s = scratch(x); s.f64(2 * zs.length).set(zs.flat()); x.openair_faddeeva(s.at, zs.length); const r = Array.from(s.f64(2 * zs.length)); return zs.map((_, i) => [r[2 * i], r[2 * i + 1]]); };
// the field the knobs make, for the reference
const fieldOf = (P) => field({ d: P.distance, hs: P.source, hr: P.listener, T: P.temperature + 273.15, rh: P.humidity, sigma: GROUNDS[P.ground] });
const dB = (c) => db(C.abs(c));
const logFreqs = (f0, f1, r) => { const f = []; for (let v = f0; v < f1; v *= r) f.push(v); return f; };
// the deepest local minimum of |H| between f0 and f1: [f (Hz), |H| (dB)]
function dip(P, f0 = 50, f1 = 3000) {
  const fr = logFreqs(f0, f1, 1.002), h = cppSpectrum(P, fr).map(dB);
  let m = 1;
  for (let i = 1; i < fr.length - 1; i++) if (h[i] < h[m]) m = i;
  return [fr[m], h[m]];
}

function run(P, input, rate = fs, block = 128) {
  const e = new Effect(rate);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length);
  let ok = true;
  for (let i = 0; i < input.length; i += block) { const j = Math.min(input.length, i + block); ok = e.process(input.subarray(i, j), L.subarray(i, j), R.subarray(i, j)) && ok; }
  const out = { L, R, ok, latency: e.latency(), designs: x.openair_designs(x.px_effect(e.h)) };
  e.destroy();
  return out;
}
const at = (y, f, rate = fs) => amplitudeAt(y, f, rate);

// 1. the air: ISO 9613-1's absorption against ISO 9613-2's Table 2 (dB/km, at the exact midbands)
{
  const bands = [-4, -3, -2, -1, 0, 1, 2, 3].map((k) => 1000 * 10 ** (0.3 * k));
  const table = [[20, 70, [0.1, 0.3, 1.1, 2.8, 5.0, 9.0, 22.9, 76.6]], [10, 70, [null, null, null, null, 3.7, 9.7, 32.8, 117]], [15, 50, [null, null, null, null, 4.2, null, 36.2, 129]]];
  let ok = true, worst = 0;
  const rows = [];
  for (const [T, rh, tab] of table) {
    const c = cppAbsorption(W({ temperature: T, humidity: rh }), bands).map((a) => 1000 * a);
    tab.forEach((v, i) => {
      if (v === null) return;
      const digits = v >= 100 ? 0 : 1;
      ok &&= +c[i].toFixed(digits) === v;
      worst = Math.max(worst, Math.abs(c[i] / (1000 * iso(bands[i], T + 273.15, rh)) - 1));
    });
    rows.push(`${T} °C ${rh} %: ${c.filter((_, i) => tab[i] !== null).map((v) => v.toFixed(2)).join(', ')}`);
  }
  check(ok, 'the air: ISO 9613-1\'s absorption rounds to ISO 9613-2\'s Table 2 at 20 °C and 70 % (63 Hz to 8 kHz), 10 °C and 70 %, 15 °C and 50 % (dB/km)', rows.join('; '));
  check(worst < 1e-12, 'the air: the C++ against ISO 9613-1\'s equations written out again', worst.toExponential(1));
  const p = cppParts(W({ temperature: 0 }));
  check(Math.abs(p.c - 331.3) < 0.05 && Math.abs(cppParts(W({})).c - 343.2) < 1e-9, 'the speed of sound, 343.2 √(T/293.15) m/s: 331.3 m/s at 0 °C', p.c.toFixed(2));
}

// 2. the ground: its resistivity, its impedance, and w(z)
{
  check(Object.entries(RANGES).every(([g, [lo, hi]]) => Math.abs(cppParts(W({ ground: g })).sigma / Math.sqrt(lo * hi) - 1) < 1e-3) && cppParts(W({ ground: 'asphalt' })).sigma === 0,
    'the grounds\' flow resistivities: the geometric middles of Piercy and Embleton\'s ranges, asphalt rigid');
  let worst = 0;
  for (const g of ['snow', 'grass', 'dirt']) {
    const fr = [20, 100, 1000, 10000], c = cppSpectrum(W({ ground: g }), fr, 2);
    fr.forEach((f, i) => { worst = Math.max(worst, C.abs(C.sub(c[i], miki(f, GROUNDS[g]))) / C.abs(c[i])); });
  }
  check(worst < 1e-12, 'the ground\'s impedance: Miki\'s form of Delany and Bazley\'s law', worst.toExponential(1));
  const zs = [];
  for (const r of [0.05, 0.5, 1, 2, 3, 4, 6, 8, 12, 15, 20, 40]) for (const a of [-0.5, -0.05, 0, 0.02, 0.3, 0.6, Math.PI / 4]) zs.push([r * Math.cos(a), r * Math.sin(a)]);
  const c = cppFaddeeva(zs);
  let wf = 0, wz = '';
  zs.forEach((z, i) => { const e = C.abs(C.sub(c[i], faddeeva(z))) / C.abs(c[i]); if (e > wf) { wf = e; wz = `${z[0].toFixed(2)} + ${z[1].toFixed(2)}i`; } });
  check(wf < 1e-9, 'the Faddeeva function w(z) = e^(−z²) erfc(−iz) (Weideman\'s rational approximation and the continued fraction) against its differential equation integrated by Runge–Kutta, across the plane the reflection uses and below the real axis', `${wf.toExponential(1)} at ${wz}`);
}

// 3. the reflection: Weyl–van der Pol against the reference, and its limits
{
  let worst = 0, n = 0;
  for (const [g, d] of [['snow', 10], ['snow', 1000], ['forest', 100], ['grass', 30], ['grass', 300], ['dirt', 100]]) {
    const P = W({ ground: g, distance: d }), F = fieldOf(P), fr = [25, 63, 160, 400, 1000, 2500];
    const c = cppSpectrum(P, fr, 1);
    fr.forEach((f, i) => { worst = Math.max(worst, C.abs(C.sub(c[i], reflection(f, F)))); n++; });
  }
  check(worst < 1e-8, `the ground's reflection Q, the spherical wave's, against Weyl and van der Pol's formula worked out with the reference's w(z) (${n} cases, from fresh snow to a dirt road, 10 m to 1 km)`, worst.toExponential(1));
  // far off and high up, the spherical wave reflects as a plane wave would: Q → Rp
  const P = W({ ground: 'grass', distance: 10, source: 3, listener: 3 }), F = fieldOf(P), qf = cppSpectrum(P, [8000], 1)[0], rp = planeWave(8000, F);
  check(C.abs(C.sub(qf, rp)) < 0.01, 'far off in wavelengths, the spherical wave reflects as a plane wave: Q → Rp = (Z cos θ − 1)/(Z cos θ + 1) (10 m over grass, 3 m up, 8 kHz)', `|Q − Rp| ${C.abs(C.sub(qf, rp)).toFixed(4)}`);
  // at grazing incidence the plane wave would cancel itself, Rp → −1; the ground wave keeps Q from it
  const G = W({ ground: 'grass', distance: 1000 }), qg = cppSpectrum(G, [100], 1)[0], rg = planeWave(100, fieldOf(G));
  check(rg[0].toFixed(2) === '-0.91' && C.abs(qg).toFixed(2) === '1.78', 'grazing, the plane wave\'s reflection is nearly −1, −0.91, cancelling the direct sound, but the spherical wave\'s ground wave lifts |Q| to 1.78 (1 km over grass, 100 Hz)', `Rp ${rg[0].toFixed(3)}, |Q| ${C.abs(qg).toFixed(3)}`);
  const asphalt = cppSpectrum(W({ ground: 'asphalt' }), [10, 1000, 10000], 1);
  check(asphalt.every((q) => q[0] === 1 && q[1] === 0), 'a rigid ground (asphalt): a perfect mirror, Q = 1');
  const low = cppSpectrum(W({ ground: 'snow', distance: 1000 }), [0.01], 1)[0];
  check(C.abs(C.sub(low, [1, 0])) < 0.01, 'at the lowest frequencies even fresh snow is rigid, its impedance going to infinity: Q → 1', `|Q − 1| ${C.abs(C.sub(low, [1, 0])).toFixed(4)}`);
}

// 4. the response: H against the reference; the paths in phase at the lowest frequencies; the
// hard ground's nulls where the reflected path is longer by half a wavelength
{
  let worst = 0;
  for (const o of [{}, { ground: 'snow', distance: 300, humidity: 20 }, { ground: 'dirt', distance: 30, temperature: -10, source: 0.3 }, { ground: 'asphalt', distance: 1000, humidity: 90, listener: 3 }]) {
    const P = W(o), F = fieldOf(P), fr = [31, 98, 330, 1100, 3700, 12000], c = cppSpectrum(P, fr);
    fr.forEach((f, i) => { worst = Math.max(worst, C.abs(C.sub(c[i], response(f, F)))); });
  }
  check(worst < 1e-8, 'the response as heard, the direct and reflected paths summed with the air\'s absorption along each, against the reference', worst.toExponential(1));
  const p = cppParts(W({})), h0 = cppSpectrum(W({}), [0])[0];
  check(Math.abs(h0[0] - (1 + p.r1 / p.r2)) < 1e-12 && h0[1] === 0 && db(h0[0]).toFixed(1) === '6.0', 'at 0 Hz the two paths arrive in phase: H = 1 + r1/r2, 6 dB up');
  // over asphalt H = g1 + g2 e^(−ikΔr): the m-th null at (2m + 1) c/(2Δr), as deep as |g1 − g2|
  let ok = true;
  const rows = [];
  for (const d of [10, 30, 100]) {
    const P = W({ ground: 'asphalt', distance: d }), pp = cppParts(P), F = fieldOf(P), dr = pp.r2 - pp.r1;
    for (const m of [0, 1]) {
      const f = ((2 * m + 1) * pp.c) / (2 * dr), a = iso(f, F.T, F.rh), g1 = 10 ** ((-a * pp.r1) / 20), g2 = (pp.r1 / pp.r2) * 10 ** ((-a * pp.r2) / 20);
      const [hm, lo, hi] = cppSpectrum(P, [f, f * 0.999, f * 1.001]).map(C.abs);
      ok &&= Math.abs(hm - Math.abs(g1 - g2)) < 1e-9 && hm < lo && hm < hi;
      if (!m) rows.push(`${d} m: ${f.toFixed(0)} Hz, ${db(hm).toFixed(1)} dB`);
    }
  }
  const car = cppParts(W({ ground: 'asphalt', distance: 30 })), n30 = car.c / (2 * (car.r2 - car.r1));
  check((n30 / 1000).toFixed(1) === '1.6' && ((3 * n30) / 1000).toFixed(1) === '4.8', 'the README and the tour: over asphalt at 30 m the first null is at 1.6 kHz and the next at 4.8 kHz', `${n30.toFixed(0)} Hz`);
  check(ok, 'over a hard ground, nulls where the reflected path is longer by half a wavelength, (2m + 1) c/(2Δr), as deep as the paths differ, |g1 − g2| (the first two, 10 to 100 m)', rows.join('; '));
}

// 5. the engine: the minimum-phase filter with H's magnitude, through a partitioned convolution
{
  const rows = [];
  let worst = 0;
  const imp = (rate) => { const v = new Float32Array(Math.round(rate / 2)); v[0] = 1; return v; };
  const dtft = (y, f, rate) => { let re = 0, im = 0; for (let j = 0; j < y.length; j++) { const ph = (2 * Math.PI * f * j) / rate; re += y[j] * Math.cos(ph); im -= y[j] * Math.sin(ph); } return Math.hypot(re, im); };
  for (const rate of [44100, 48000, 96000]) for (const o of [{}, { ground: 'snow', distance: 1000 }, { ground: 'forest', distance: 300 }, { ground: 'dirt', distance: 30 }, { ground: 'asphalt' }, { ground: 'grass', distance: 1000, humidity: 5, temperature: 40 }]) {
    const r = run(W(o), imp(rate), rate, 100), fr = logFreqs(40, 16000, 1.04), H = cppSpectrum(W(o), fr).map(C.abs), peak = Math.max(...H), y = r.L.subarray(0, rate / 4);
    let e = 0;
    fr.forEach((f, i) => { if (H[i] > peak / 100) e = Math.max(e, Math.abs(db(dtft(y, f, rate) / H[i]))); });
    worst = Math.max(worst, e);
    if (rate === 48000) rows.push(`${o.ground ?? 'grass'} ${o.distance ?? 100} m ${e.toFixed(3)}`);
  }
  check(worst < 0.1, 'the engine\'s filter has H\'s magnitude, from 40 Hz to 16 kHz wherever it is within 40 dB of its peak, at 44.1, 48 and 96 kHz in blocks of 100: within 0.1 dB (85 ms long, for the slow ground wave over soft ground)', `${worst.toFixed(3)} dB at worst; ${rows.join(', ')} dB`);
  // over a hard ground the paths\' response is already minimum phase (the reflection the weaker):
  // the direct sound at once, the reflection Δr/c later and r1/r2 as strong
  const P = W({ ground: 'asphalt', distance: 3, source: 3, listener: 3 }), pp = cppParts(P), y = run(P, imp(fs), fs, 100).L;
  const lag = pp.lag * fs, j0 = Math.floor(lag), near = y.subarray(j0 - 8, j0 + 10).reduce((a, v) => a + v, 0);
  let next = 1;
  for (let j = 2; j < 2000; j++) if (Math.abs(y[j]) > Math.abs(y[next])) next = j;
  const direct = y.subarray(0, 18).reduce((a, v) => a + v, 0);
  check(Math.abs(direct - 1) < 0.02 && Math.abs(next - lag) < 1 && Math.abs(near / (pp.r1 / pp.r2) - 1) < 0.02, 'over asphalt, the filter is the two paths: the direct sound at once, the reflection Δr/c later (10.8 ms at 3 m with both 3 m up) and r1/r2 as strong (each summed over its few samples: the air\'s filter spreads them; within 2 %)', `${direct.toFixed(4)}; ${next} against ${lag.toFixed(2)} samples, ${near.toFixed(4)} against ${(pp.r1 / pp.r2).toFixed(4)}`);
  const lat = [44100, 48000, 96000, 192000].map((rate) => run(W({}), new Float32Array(16), rate).latency);
  check(lat.every((l) => l === 0), 'no latency: the filter is causal and the convolution\'s first partition runs sample by sample', lat.join(', '));
  // a note through it: its gain is |H| at the note's frequency
  let wg = 0;
  for (const f of [55, 196, 523, 1500]) for (const g of ['snow', 'grass']) {
    const Pn = W({ ground: g }), yn = run(Pn, sine(f, fs, fs, 0.2)).L.subarray(fs / 2);
    wg = Math.max(wg, Math.abs(db(at(yn, f) / 0.2) - dB(cppSpectrum(Pn, [f])[0])));
  }
  check(wg < 0.1, 'a note through it comes out |H| louder or quieter, in the dip too (100 m over fresh snow and grass, 55 Hz to 1.5 kHz)', `${wg.toFixed(3)} dB at worst`);
}

// 6. the hints
{
  const air = (f, T, rh) => 1000 * cppAbsorption(W({ temperature: T, humidity: rh }), [f])[0];
  const [, d100] = dip(W({})), [, d1k] = dip(W({ distance: 1000 }));
  check((-d100).toFixed(0) === '18' && (-d1k).toFixed(0) === '40' && air(4000, 20, 50).toFixed(0) === '30' && PEDAL.expression === 'distance' && /expression pedal/.test(knob('distance')),
    'the hint (Distance): over grass the dip is 18 dB deep at 100 m and 40 dB at 1 km; the air takes 30 dB from 4 kHz over the kilometre; an expression pedal moves it', `${d100.toFixed(1)}, ${d1k.toFixed(1)} dB; ${air(4000, 20, 50).toFixed(1)} dB`);
  const tens = (f) => (f >= 1000 ? `${(f / 1000).toFixed(1)}k` : `${Math.round(f / 10) * 10}`);
  const dips = ['snow', 'forest', 'grass', 'dirt'].map((g) => tens(dip(W({ ground: g }))[0]));
  const pa = cppParts(W({ ground: 'asphalt' })), null0 = pa.c / (2 * (pa.r2 - pa.r1));
  check(dips.join() === '190,240,500,1.6k' && tens(null0) === '5.4k', 'the hint (Ground): at 100 m the dip is at 190 Hz over fresh snow, 240 over a forest floor, 500 over grass, 1.6 kHz over a dirt road; asphalt\'s first null at 5.4 kHz', `${dips.join(', ')}; ${null0.toFixed(0)} Hz`);
  check(air(2000, 20, 10).toFixed(0) === '45' && air(2000, 20, 50).toFixed(0) === '10', 'the hint (Humidity): over a kilometre at 20 °C, 2 kHz loses 45 dB at 10 % but 10 dB at 50 %', `${air(2000, 20, 10).toFixed(2)}, ${air(2000, 20, 50).toFixed(2)}`);
  check(air(4000, 0, 50).toFixed(0) === '71' && air(4000, 20, 50).toFixed(0) === '30' && cppParts(W({ temperature: 0 })).c.toFixed(0) === '331' && cppParts(W({})).c.toFixed(0) === '343',
    'the hint (Temperature): at 50 %, 4 kHz loses 71 dB over a kilometre at 0 °C and 30 dB at 20 °C; sound goes 331 m/s at 0 °C, 343 at 20 °C', `${air(4000, 0, 50).toFixed(2)}, ${air(4000, 20, 50).toFixed(2)}`);
  const lo = run(W({}), sine(41.2, fs, fs, 0.2)).L.subarray(fs / 2);
  check(db(at(lo, 41.2) / 0.2).toFixed(0) === '6', 'the hint (Level): at 0 dB, over grass at 100 m, the low E comes 6 dB up, the ground\'s reflection added to the direct sound at its strength a metre out', `${db(at(lo, 41.2) / 0.2).toFixed(2)} dB`);
  const hs = [0.2, 1, 3].map((h) => dip(W({ source: h }))[0]);
  check(hs[0] > hs[1] && hs[1] > hs[2] && (hs[0] / 1000).toFixed(1) === '1.2' && tens(hs[1]) === '500' && tens(hs[2]) === '400', 'the hint (Source height): over grass at 100 m the dip is at 1.2 kHz with the speaker at 0.2 m, 500 Hz at 1 m, 400 Hz at 3 m', hs.map((f) => f.toFixed(0)).join(', '));
  const [f5, d5] = dip(W({ listener: 0.5 })), [f3, d3] = dip(W({ listener: 3 }));
  check(tens(f5) === '680' && (-d5).toFixed(0) === '24' && tens(f3) === '480' && (-d3).toFixed(0) === '12', 'the hint (Listener height): over grass at 100 m the dip is at 680 Hz and 24 dB deep with your ears at 0.5 m, 480 Hz and 12 dB at 3 m', `${f5.toFixed(0)} Hz ${d5.toFixed(1)} dB; ${f3.toFixed(0)} Hz ${d3.toFixed(1)} dB`);
}

// 7. hygiene
{
  const r = run(W({}), new Float32Array(fs));
  check(Math.max(...r.L.map(Math.abs)) === 0, 'silence in, silence out');
  check(r.R.every((v, i) => v === r.L[i]), 'mono out on both sides');
  // walking away mid-note fades between the filters: no step past the note's own
  const e = new Effect(fs);
  e.setParams(W({}));
  const n = fs, inp = sine(98, fs, n, 0.3), L = new Float32Array(n), R = new Float32Array(n);
  let designs0 = 0;
  for (let i = 0; i < n; i += 128) {
    if (i === n / 2) designs0 = x.openair_designs(x.px_effect(e.h));
    if (i >= n / 2 && i < n / 2 + 12800) e.setParams(W({ distance: 100 + (i - n / 2) / 16, ground: i < n / 2 + 6400 ? 'grass' : 'snow' }));
    e.process(inp.subarray(i, i + 128), L.subarray(i, i + 128), R.subarray(i, i + 128));
  }
  const designs = x.openair_designs(x.px_effect(e.h)) - designs0;
  e.destroy();
  const steps = L.map((v, i) => (i ? Math.abs(v - L[i - 1]) : 0)), before = Math.max(...steps.subarray(n / 4, n / 2)), after = Math.max(...steps.subarray(n / 2, n));
  check(after < 1.5 * before, 'walking away and onto snow mid-note, the pedal fades from filter to filter: no step past the note\'s own', `${(1e3 * after).toFixed(2)} mV a sample against ${(1e3 * before).toFixed(2)}`);
  check(designs <= 100 / 8 + 3, 'a knob turned every block designs a new filter only as each fade ends, every 8 blocks', `${designs} designs in 100 blocks`);
  const e2 = new Effect(fs);
  e2.setParams(W({}));
  const bad = new Float32Array(128); bad[5] = NaN;
  const L2 = new Float32Array(4096), R2 = new Float32Array(4096);
  const ok = e2.process(bad, L2.subarray(0, 128), R2.subarray(0, 128));
  e2.process(sine(100, fs, 4096, 0.3), L2, R2);
  check(!ok && L2.every(Number.isFinite) && Math.max(...L2.map(Math.abs)) > 0.1, 'a NaN in comes out as a silent block, and the pedal recovers');
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
  const n = 10 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.8 * Math.sin((2 * Math.PI * 41.2 * i) / fs) * Math.exp(-(i % fs) / fs));
  for (const rate of [48000, 96000]) {
    const e = new Effect(rate);
    e.setParams(W({}));
    const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
    for (let i = 0; i < n; i += 128) e.process(inp.subarray(i, i + 128), L.subarray(i, i + 128), R.subarray(i, i + 128));
    const share = (performance.now() - t0) / 1000 / (n / rate);
    e.destroy();
    check(share < 0.05, `CPU: at ${rate / 1000} kHz under 5 % of a core (WebAssembly)`, `${(100 * share).toFixed(1)} %`);
  }
}

done();
