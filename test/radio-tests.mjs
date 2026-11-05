// radio-tests.mjs — the Crystal Radio against the set worked out independently of the C++
// (test/radio-circuit.mjs): the diode's current averaged round the carrier's cycle by summing it,
// the detector's steady voltage by bisection, and the whole set simulated at radio frequency, cycle
// by cycle of the carrier, with no envelope taken anywhere; the textbook square and peak laws, the
// square law's second harmonic m/4, the onset of diagonal clipping at mωRC = √(1 − m²), the tuned
// circuit's bandwidth, and each knob's hint.

import { check, done, CI } from './harness.mjs';
import { loadPedal } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { amplitudeAt, db, sine } from '../tools/audio-util.mjs';
import { diode, meanCurrent, settle, squareLaw, peakLaw, simulate, component } from './radio-circuit.mjs';
import { DIODES } from '../radio/src/radio-params.js';

const { PEDAL, Effect } = await loadPedal('radio');
const x = Effect.exports;
const fs = 48000;
const D = { ...defaults(PEDAL.groups), level: 0 };
const W = (over) => ({ ...D, ...over });
// a quiet dial: no next station to speak of
const Q0 = (over) => W({ neighbour: -80, ...over });

// the C++ model through its exports
function call(fn, P, extra = [], args = []) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length).set(v);
  if (extra.length) s.f64(extra.length, 8 * v.length).set(extra);
  x[fn](s.at, ...args);
  return { n: v.length, read: (count, at = 0) => Array.from(s.f64(count, 8 * at)) };
}
const cppParts = (P) => { const r = call('radio_parts', P).read(11); return { is: r[0], nvt: r[1], A0: r[2], V0: r[3], slope: r[4], gain: r[5], gamma: r[6], delta: r[7], B: r[8], spacing: r[9], Ac: r[10] }; };
const cppSettle = (P, A) => { const c = call('radio_settle', P, A, [A.length]); return c.read(A.length, c.n + A.length); };
const cppCurrent = (P, pairs) => { const c = call('radio_current', P, pairs.flat(), [pairs.length]); return c.read(pairs.length, c.n + 2 * pairs.length); };
const cppTank = (P, f) => { const c = call('radio_tank', P, f, [f.length]); const r = c.read(2 * f.length, c.n + f.length); return f.map((_, i) => [r[2 * i], r[2 * i + 1]]); };
const cppTone = (P, f, amp, n) => { const c = call('radio_tone', P, [f, amp], [n]); return { env: c.read(n, c.n + 2), A: c.read(n, c.n + 2 + n), V: c.read(n, c.n + 2 + 2 * n) }; };

function run(P, input, quality = 'high') {
  const e = new Effect(fs);
  e.setQuality(quality);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length);
  const ok = e.process(input, L, R);
  const out = { L, R, ok, iterations: x.radio_iterations(x.px_effect(e.h)), latency: e.latency() };
  e.destroy();
  return out;
}
// a steady sine of amplitude a at f through the pedal; the last half second
const steady = (P, f, a, quality = 'high') => run(P, sine(f, fs, fs, a), quality).L.subarray(fs / 2);
const at = (y, f) => amplitudeAt(y, f, fs);
// the harmonics 1, 2, 3 of a note f at a volts
const harmonics = (P, f, a) => { const y = steady(P, f, a); return [1, 2, 3].map((k) => at(y, k * f)); };
const h2 = (P, f, a) => { const h = harmonics(P, f, a); return h[1] / h[0]; };
// the detector's slope dV/dA at the carrier, from the JS bisection
const jsSlope = (P) => { const d = diode(P.diode), e = 1e-4; return (settle(d, P.load, P.signal * (1 + e)) - settle(d, P.load, P.signal * (1 - e))) / (2 * e * P.signal); };

// 1. the parts
{
  for (const [id] of DIODES) {
    const p = cppParts(W({ diode: id })), d = diode(id);
    check(Math.abs(p.is / d.is - 1) < 1e-12 && Math.abs(p.nvt / d.nvt - 1) < 1e-12, `model: the ${id} diode passes 1 mA at its family's voltage (the Bandgap's)`, `Is ${p.is.toExponential(3)} A, nVT ${(1e3 * p.nvt).toFixed(2)} mV`);
  }
  const p = cppParts(W({ tuning: 3000, q: 80, station: 700e3 }));
  check(Math.abs(p.gamma / ((Math.PI * 703e3) / 80) - 1) < 1e-12 && Math.abs(p.delta / (2 * Math.PI * 3000) - 1) < 1e-12 && p.spacing === 10e3,
    'model: the tuned circuit\'s half bandwidth γ = πf0/Q about f0 = the station + the tuning; the next station 10 kHz up');
  const r = cppTank(W({ tuning: 3000, q: 80, station: 700e3 }), [-5000, 0, 3000, 12000]);
  const want = (f) => { const u = (2 * Math.PI * f - p.delta) / p.gamma, m = 1 + u * u; return [1 / m, -u / m]; };
  check(r.every((z, i) => Math.hypot(z[0] - want([-5000, 0, 3000, 12000][i])[0], z[1] - want([-5000, 0, 3000, 12000][i])[1]) < 1e-12), 'model: the tuned circuit\'s response, 1/(1 + 2iQ(f − f0)/f0)');
}

// 2. the diode's current averaged over the carrier's cycle: e^{−v} I0(a) − 1, against the sum
// round the cycle, from the square law's corner to far past the knee
{
  let worst = 0;
  for (const [id] of DIODES) {
    const d = diode(id), P = W({ diode: id });
    const pairs = [];
    for (const A of [1e-4, 1e-3, 0.01, 0.05, 0.2, 0.5, 1, 3]) for (const fr of [-0.5, 0, 0.3, 0.9, 0.99]) pairs.push([A, fr * A]);
    const c = cppCurrent(P, pairs);
    pairs.forEach(([A, V], i) => { const j = meanCurrent(d, A, V, 2048); worst = Math.max(worst, Math.abs(c[i] - j) / (Math.abs(j) + 1e-6 * d.is)); });
  }
  check(worst < 1e-9, 'the diode\'s mean current, Is(e^{−V/nVT} I0(A/nVT) − 1), against Shockley\'s current summed round the carrier\'s cycle', `worst ${worst.toExponential(1)} relative`);
}

// 3. the detector's steady voltage, against bisection on the summed current, and the textbook limits
{
  let worst = 0;
  for (const [id] of DIODES) for (const R of [10e3, 100e3, 1e6]) {
    const d = diode(id), P = W({ diode: id, load: R }), A = [1e-3, 3e-3, 0.01, 0.03, 0.1, 0.3, 1, 3];
    const c = cppSettle(P, A);
    A.forEach((a, i) => { const j = settle(d, R, a); worst = Math.max(worst, Math.abs(c[i] / j - 1)); });
  }
  check(worst < 1e-7, 'the detector\'s steady voltage, ⟨i⟩(A, V) = V/R, against bisection', `worst ${worst.toExponential(1)} relative`);
  const d = diode('ge'), P = W({});
  const weak = cppSettle(P, [1e-3])[0], strong = cppSettle(P, [3])[0];
  check(Math.abs(weak / squareLaw(d, 100e3, 1e-3) - 1) < 0.01, 'the square law at 1 mV: V = (A/nVT)²/4 · Is R/(1 + Is R/nVT), within 1 %', `${(1e6 * weak).toFixed(3)} µV, the law ${(1e6 * squareLaw(d, 100e3, 1e-3)).toFixed(3)} µV`);
  check(Math.abs(strong / peakLaw(d, 100e3, 3) - 1) < 0.001, 'the peak law at 3 V: V = A − nVT ln(√(2πA/nVT)(1 + V/(Is R))), within 0.1 %', `${strong.toFixed(4)} V, the law ${peakLaw(d, 100e3, 3).toFixed(4)} V`);
  const p = cppParts(W({}));
  check(Math.abs(p.slope / jsSlope(W({})) - 1) < 1e-5 && Math.abs(p.gain * p.slope * 0.8 * 0.3 - 1) < 1e-9, 'the amplifier\'s gain is 1/(k Ac dV/dA)', `dV/dA ${p.slope.toFixed(4)}, ${db(p.gain).toFixed(1)} dB`);
}

// 4. the engine against the set simulated at radio frequency: a 540 kHz carrier, 128 steps a cycle,
// through the tuned circuit's own equation into the diode and the earphone
{
  const cases = [
    ['a local station', {}, 500],
    ['a faint one, 10 mV', { signal: 0.01 }, 500],
    ['a strong one, 2 V', { signal: 2 }, 500],
    ['a silicon detector', { diode: 'si' }, 500],
    ['tuned 6 kHz off', { tuning: 6000 }, 500],
    ['diagonal clipping', { signal: 1, load: 1e6, cap: 4.7e-9 }, 500],
    ['overmodulated, 150 %', { depth: 5 }, 500],
    ['Q 200', { q: 200 }, 1000],
    ['the next station at −24 dB', { neighbour: -24 }, 500],
  ];
  for (const [name, over, f] of (CI ? cases.filter((_, i) => i % 3 === 0) : cases)) {
    const P = W({ station: 540e3, ...over }), a = 0.3;
    const g = 1 / (P.depth * P.signal * jsSlope(P));
    const sim = simulate({ station: P.station, tune: P.tuning, q: P.q, Ac: P.signal, k: P.depth, B: P.signal * 10 ** (P.neighbour / 20), R: P.load, C: P.cap, kind: P.diode, tone: [f, a], perCycle: 128, every: 16, settle: P.cap * P.load * 8 + 0.004, span: 0.01 });
    const y = steady(P, f, a);
    const fr = [f, 2 * f, 3 * f], js = fr.map((v) => g * component(sim.V, sim.rate, v)), cp = fr.map((v) => at(y, v));
    // a harmonic over 1 % of the note within 0.1 dB, one from 0.1 % to 1 % within 0.3 dB
    const err = fr.map((_, i) => (js[i] / js[0] > 1e-2 ? Math.abs(db(cp[i] / js[i])) : js[i] / js[0] > 1e-3 ? Math.abs(db(cp[i] / js[i])) / 3 : 0));
    const wj = g * component(sim.V, sim.rate, 10e3), wc = at(y, 10e3);
    check(Math.max(...err) < 0.1 && Math.abs(db(wc / wj)) < 0.5, `against the set at radio frequency: ${name} (the note and its harmonics within 0.1 dB, those under 1 % 0.3 dB, the 10 kHz whistle 0.5 dB)`,
      `${fr.map((_, i) => Math.abs(db(cp[i] / js[i])).toFixed(3)).join(', ')} dB; whistle ${db(wc / wj).toFixed(2)} dB`);
  }
}

// 5. the square law's second harmonic, m/4 (Terman), and a peak detector's lack of one
{
  const weak = h2(Q0({ signal: 0.003 }), 110, 0.5), strong = h2(Q0({ signal: 3 }), 110, 0.5);
  check(Math.abs(weak / 0.1 - 1) < 0.03, 'a weak station, 3 mV: the second harmonic is m/4 of the note, 10 % at 40 % modulation', `${(100 * weak).toFixed(2)} %`);
  check(strong < 0.003, 'a strong one, 3 V: under 0.3 %', `${(100 * strong).toFixed(2)} %`);
}

// 6. diagonal clipping: it starts where mωRC = √(1 − m²)
{
  const m = 0.4, RC = 1e6 * 4.7e-9, fStar = Math.sqrt(1 - m * m) / (2 * Math.PI * m * RC);
  const P = Q0({ signal: 1, load: 1e6, cap: 4.7e-9 }), ref = Q0({ signal: 1, load: 1e6, cap: 1e-10 });
  const below = h2(P, 0.6 * fStar, 0.5) - h2(ref, 0.6 * fStar, 0.5), above = h2(P, 2 * fStar, 0.5) - h2(ref, 2 * fStar, 0.5);
  check(below < 0.002 && above > 0.02, `diagonal clipping starts at mωRC = √(1 − m²): ${fStar.toFixed(1)} Hz at 40 % through 1 MΩ and 4.7 nF (its second harmonic over a short RC\'s: under 0.2 % at 0.6×, over 2 % at 2×)`, `${(100 * below).toFixed(2)} %, ${(100 * above).toFixed(2)} %`);
  const tone = cppTone(P, 2 * fStar, 0.5, 200), follow = cppSettle(P, tone.A);
  const gap = Math.max(...tone.V.map((v, i) => v - follow[i]));
  const slow = cppTone(W({}), 55, 0.5, 200), followSlow = cppSettle(W({}), slow.A);
  const gapSlow = Math.max(...slow.V.map((v, i) => Math.abs(v - followSlow[i])));
  check(gap > 0.05 && gapSlow < 0.003, 'the detector\'s trace: clipped, the voltage stays above where the carrier would hold it; a short RC follows it', `${(1e3 * gap).toFixed(0)} mV above; ${(1e3 * gapSlow).toFixed(2)} mV`);
}

// 7. the tuned circuit cuts the treble 3 dB at f0/2Q
for (const st of [540e3, 1000e3, 1700e3]) {
  const P = Q0({ q: 200, station: st, signal: 2 }), f = st / 400;
  const g = at(steady(P, f, 0.02), f) / 0.02, lo = at(steady(P, 100, 0.02), 100) / 0.02;
  check(Math.abs(db(g / lo) + 3.01) < 0.4, `Q 200 at ${st / 1e3} kHz: the bass 3 dB down at f0/2Q, ${(f / 1e3).toFixed(2)} kHz (0.4 dB)`, `${db(g / lo).toFixed(2)} dB`);
}

// 8. the hints
{
  // Signal: 10 % at 40 % modulation when weak; 0.7 % at 1 V, 0.4 % at 2 V; as loud either way
  const s1 = h2(Q0({ signal: 1 }), 110, 0.5), s2 = h2(Q0({ signal: 2 }), 110, 0.5);
  check(Math.abs(100 * s1 - 0.7) < 0.05 && Math.abs(100 * s2 - 0.4) < 0.05, 'the hint: a strong station comes out straight, 0.7 % second harmonic at 1 V, 0.4 % at 2 V', `${(100 * s1).toFixed(2)} %, ${(100 * s2).toFixed(2)} %`);
  const loud = (P) => at(steady(P, 110, 0.05), 110) / 0.05;
  const lw = loud(Q0({ signal: 0.01 })), ls = loud(Q0({ signal: 2 })), ld = loud(Q0({}));
  check([lw, ls, ld].every((v) => Math.abs(db(v)) < 0.1), 'the hint (Signal, Level): at 0 dB a gentle modulation comes out as loud as it went in, faint or strong', `${db(lw).toFixed(3)}, ${db(ls).toFixed(3)}, ${db(ld).toFixed(3)} dB`);
  const g1 = cppParts(W({})).gain, g2 = cppParts(W({ signal: 0.01 })).gain;
  check(db(g1).toFixed(1) === '14.2' && db(g2).toFixed(1) === '63.0', 'the hint (Level): the amplifier makes up 14.2 dB at 300 mV on germanium, 63.0 dB at 10 mV', `${db(g1).toFixed(2)}, ${db(g2).toFixed(2)} dB`);
  // Modulation: 500 %/V and 0.3 V overmodulate to 150 %, an 18 % second harmonic, troughs flattened
  const over = Q0({ depth: 5 }), ho = h2(over, 110, 0.3);
  const t = cppTone(over, 110, 0.3, 400), zero = t.env.filter((e) => e === 0).length / 400;
  check(Math.abs(100 * ho - 18) < 1 && Math.abs(zero - Math.acos(1 / 1.5) / Math.PI) < 0.02, 'the hint: at 500 %/V a 0.3 V note overmodulates to 150 %, its troughs cut off, with an 18 % second harmonic', `${(100 * ho).toFixed(1)} %; the carrier off ${(100 * zero).toFixed(0)} % of the time`);
  // Tuning: 6 kHz off, 1.6 dB quieter
  const off = at(steady(Q0({ tuning: 6000 }), 110, 0.05), 110) / at(steady(Q0({}), 110, 0.05), 110);
  const off10 = at(steady(Q0({ tuning: 10000 }), 110, 0.05), 110) / at(steady(Q0({}), 110, 0.05), 110);
  check(Math.abs(db(off) + 1.6) < 0.1 && Math.abs(db(off10) + 3.6) < 0.1, 'the hint: tuned 6 kHz off the station, the bass is 1.6 dB quieter; 10 kHz off, on the next station, 3.6 dB (the README)', `${db(off).toFixed(2)}, ${db(off10).toFixed(2)} dB`);
  check(PEDAL.expression === 'tuning', 'an expression pedal sweeps the tuning');
  // Selectivity: at Q 200 and 1000 kHz the treble is cut 2.9 dB at 2.5 kHz; at Q 50 not at all
  const sel = (q, f) => at(steady(Q0({ q, signal: 2 }), f, 0.02), f) / at(steady(Q0({ q, signal: 2 }), 100, 0.02), 100);
  check(Math.abs(db(sel(200, 2500)) + 2.9) < 0.15 && Math.abs(db(sel(50, 2500))) < 0.2, 'the hint: at Q 200 the bass is cut 2.9 dB at 2.5 kHz; at Q 50, hardly', `${db(sel(200, 2500)).toFixed(2)} dB, ${db(sel(50, 2500)).toFixed(2)} dB`);
  // Detector: nVT 41 mV for germanium; at 300 mV silicon 26 %, germanium 2 %
  const ge = h2(Q0({}), 110, 0.5), si = h2(Q0({ diode: 'si' }), 110, 0.5);
  check((1e3 * cppParts(W({})).nvt).toFixed(0) === '41' && Math.abs(100 * si - 26) < 1 && Math.abs(100 * ge - 2) < 0.3, 'the hint: at 300 mV and 40 % modulation silicon makes a 26 % second harmonic, germanium 2 %', `${(100 * si).toFixed(1)} %, ${(100 * ge).toFixed(2)} %`);
  const sch = h2(Q0({ diode: 'schottky' }), 110, 0.5);
  check(sch > ge && sch < si, 'the hint: the Schottky is in between', `${(100 * sch).toFixed(1)} %`);
  // Earphone load and Bypass capacitor: 3.6 kHz at 100 kΩ and 1 nF; 78 Hz at 1 MΩ and 4.7 nF; 8 % at 220 Hz
  const fs1 = Math.sqrt(1 - 0.16) / (2 * Math.PI * 0.4 * 1e-4), fs2 = Math.sqrt(1 - 0.16) / (2 * Math.PI * 0.4 * 4.7e-3);
  const clip = h2(Q0({ signal: 1, load: 1e6, cap: 4.7e-9 }), 220, 0.5);
  check((fs1 / 1e3).toFixed(1) === '3.6' && fs2.toFixed(0) === '78' && Math.abs(100 * clip - 8) < 0.5, 'the hint: diagonal clipping from 3.6 kHz at 100 kΩ and 1 nF, 78 Hz at 1 MΩ and 4.7 nF, an 8 % second harmonic at 220 Hz', `${fs1.toFixed(0)} Hz, ${fs2.toFixed(1)} Hz, ${(100 * clip).toFixed(1)} %`);
  // Station: the band in proportion to the frequency (section 7); 540 to 1700 kHz
  const st = PEDAL.groups.flatMap((g) => g.params).find((p) => p.id === 'station');
  check(st.min === 540e3 && st.max === 1700e3, 'the hint: the dial runs from 540 to 1700 kHz, the US AM channels (47 CFR 73.14)');
  // Next station: 39 dB under a 0.3 V note at −46 dB, 17 dB at −24 dB
  const whistle = (n) => { const y = steady(W({ neighbour: n }), 110, 0.3); return db(at(y, 10e3) / at(y, 110)); };
  const w46 = whistle(-46), w24 = whistle(-24);
  check(Math.abs(w46 + 39) < 1 && Math.abs(w24 + 17) < 1, 'the hint: the next station whistles at 10 kHz, 39 dB under a 0.3 V note at −46 dB, 17 dB at −24 dB', `${w46.toFixed(1)}, ${w24.toFixed(1)} dB`);
}

// 9. the solver: Newton converges, fast, on a loud bass, at every quality and diode
for (const [qu, most] of [['high', 3.5], ['medium', 4], ['low', 4.5]]) {
  let worstIt = 0, finite = true;
  const loud = sine(41.2, fs, fs / 2, 1.5);
  for (const [d] of DIODES) for (const over of [{ signal: 0.003 }, { signal: 3, depth: 10, neighbour: 0 }, { signal: 0.3, load: 1e6, cap: 1e-8 }, { signal: 1, load: 1e4, cap: 1e-10, q: 10 }]) {
    const r = run(W({ diode: d, ...over }), loud, qu);
    worstIt = Math.max(worstIt, r.iterations); finite &&= r.L.every(Number.isFinite);
  }
  check(finite && worstIt < most, `Newton converges on a loud bass through every diode, faint to overmodulated tenfold (${qu} quality: under ${most} evaluations a step)`, `${worstIt.toFixed(2)} a step at worst`);
}

// 10. hygiene
{
  const r = run(Q0({}), new Float32Array(fs));
  const peak = Math.max(...r.L.map(Math.abs));
  check(peak < 2e-4, 'silence in: nothing out but the next station\'s whistle, here 80 dB down', `${peak.toExponential(1)} V`);
  // the knobs glide, and the voltage the resting carrier gives is taken off: no thump
  const e = new Effect(fs);
  e.setParams(Q0({}));
  const L = new Float32Array(fs), R = new Float32Array(fs);
  e.process(new Float32Array(fs / 2), L.subarray(0, fs / 2), R.subarray(0, fs / 2));
  e.setParams(Q0({ signal: 2, tuning: 5000 }));
  e.process(new Float32Array(fs / 2), L.subarray(fs / 2), R.subarray(fs / 2));
  e.destroy();
  const thump = Math.max(...L.subarray(fs / 2).map(Math.abs));
  check(thump < 0.01, 'turning Signal and Tuning while it plays doesn\'t thump', `${(1e3 * thump).toFixed(2)} mV at most`);
  const e2 = new Effect(fs);
  e2.setParams(W({}));
  const bad = new Float32Array(128); bad[5] = NaN;
  const L2 = new Float32Array(4096), R2 = new Float32Array(4096);
  const ok = e2.process(bad, L2.subarray(0, 128), R2.subarray(0, 128));
  e2.process(sine(100, fs, 4096, 0.1), L2, R2);
  check(!ok && L2.every(Number.isFinite) && Math.max(...L2.map(Math.abs)) > 0.01, 'a NaN in comes out as a silent block, and the pedal recovers');
  e2.destroy();
  check(L2.every(Number.isFinite) && R2.every((v, i) => v === L2[i]), 'mono out on both sides');
  const lat = ['high', 'medium', 'low'].map((qu) => run(W({}), new Float32Array(128), qu).latency);
  check(lat[2] === 0 && lat[0] > 0 && lat[0] <= 5, 'latency: the oversampling filters\' few samples, none at low quality', lat.join(', '));
}

// 11. presets stay in range, and set real choices
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

// 12. CPU
if (!CI) {
  const n = 10 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 82.4 * i) / fs) * Math.exp(-(i % fs) / fs));
  for (const [qu, budget] of [['high', 0.1], ['medium', 0.06]]) {
    const e = new Effect(fs);
    e.setQuality(qu);
    e.setParams(W({}));
    const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
    e.process(inp, L, R);
    const share = (performance.now() - t0) / 1000 / 10;
    e.destroy();
    check(share < budget, `CPU: ${qu} quality under ${(100 * budget).toFixed(0)} % of a core (WebAssembly)`, `${(100 * share).toFixed(1)} %`);
  }
}

done();
