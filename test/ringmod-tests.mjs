// ringmod-tests.mjs — the Ring Modulator against its circuit solved independently of the C++
// (test/ringmod-circuit.mjs: the ring's corners' currents by Newton with a finite-difference
// Jacobian), the closed form tanh w = tanh u tanh vc for an unloaded ring between stiff sources,
// the sidebands a switching function's Fourier series puts the bass into, the transformers' low
// cut from complex impedances, and each knob's hint.

import { check, done, CI } from './harness.mjs';
import { loadPedal, loadBass } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { amplitudeAt, db, sine, rms } from '../tools/audio-util.mjs';
import { tune } from '../shared/tuner.js';
import { ring, steadyLeak, unloaded, diodes, carrier, fourier, RS, RC, RL } from './ringmod-circuit.mjs';
import { DIODES, WAVES } from '../ringmod/src/ringmod-params.js';

const { PEDAL, Effect } = await loadPedal('ringmod');
const x = Effect.exports;
const fs = 48000;
const D = { ...defaults(PEDAL.groups), level: 0 };
const W = (over) => ({ ...D, ...over });
// a clean bench: matched diodes and transformers whose low cut is far below the bass
const CLEAN = W({ mismatch: 0, inductance: 30 });
const C = (over) => ({ ...CLEAN, ...over });

// the C++ model through its exports
function call(fn, P, extra = [], args = []) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length).set(v);
  if (extra.length) s.f64(extra.length, 8 * v.length).set(extra);
  x[fn](s.at, ...args);
  return { n: v.length, read: (count, at = 0) => Array.from(s.f64(count, 8 * at)) };
}
const cppParts = (P) => { const r = call('ringmod_parts', P).read(10); return { Rs: r[0], Rc: r[1], RL: r[2], L: r[3], is: r[4], nvt: r[5], is1: r[6], rise: r[7], makeup: r[8], gain: r[9] }; };
function cppRing(P, [Rs, Rc, Rl], pairs) {
  const c = call('ringmod_ring', P, [Rs, Rc, Rl, ...pairs.flat()], [pairs.length]);
  const r = c.read(7 * pairs.length, c.n + 3 + 2 * pairs.length);
  return pairs.map((_, i) => ({ u: r[7 * i], vc: r[7 * i + 1], w: r[7 * i + 2], i: r.slice(7 * i + 3, 7 * i + 7) }));
}
function cppCarrier(P, phases) { const c = call('ringmod_carrier', P, phases, [phases.length]); return c.read(phases.length, c.n + phases.length); }
function cppCycle(P, n) { const c = call('ringmod_cycle', P, [], [n]); return { vcar: c.read(n, c.n), g: c.read(n, c.n + n), w0: c.read(n, c.n + 2 * n) }; }
function cppSwitching(P, volts) { const c = call('ringmod_switching', P, volts, [volts.length]); return { g: c.read(volts.length, c.n + volts.length), w0: c.read(volts.length, c.n + 2 * volts.length) }; }

function run(P, input, quality = 'high') {
  const e = new Effect(fs);
  e.setQuality(quality);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length);
  const ok = e.process(input, L, R);
  const out = { L, R, ok, messages: e.messages(), iterations: x.ringmod_iterations(x.px_effect(e.h)), failures: x.ringmod_failures(x.px_effect(e.h)), latency: e.latency() };
  e.destroy();
  return out;
}
// a steady sine of amplitude a at f through the pedal; the last second, once the transformers settle
const steady = (P, f, a = 0.01, quality = 'high') => run(P, sine(f, fs, 2 * fs, a), quality).L.subarray(fs);
const at = (y, f) => amplitudeAt(y, f, fs);
const kind = (P) => P.diodes;

// the switching function from the JS circuit: dw/dvin by central differences, at N points of a
// carrier cycle, and the leak w with nothing in
function jsCycle(P, N = 256) {
  const g = [], w0 = [], dv = 1e-6;
  let guess = null;
  for (let i = 0; i < N; i++) {
    const vcar = carrier(P.wave, P.carrierLevel, P.carrier, i / N);
    const z = ring({ vin: 0, vcar, kind: kind(P), mismatch: P.mismatch, guess });
    guess = [z.u, z.vc, z.w];
    const up = ring({ vin: dv, vcar, kind: kind(P), mismatch: P.mismatch, guess }), dn = ring({ vin: -dv, vcar, kind: kind(P), mismatch: P.mismatch, guess });
    g.push((up.w - dn.w) / (2 * dv));
    w0.push(z.w);
  }
  return { g, w0 };
}

// 1. the parts, as the README gives them
{
  const p = cppParts(W({ diodes: 'si', mismatch: 0.01, inductance: 2 }));
  const want = diodes('si', 0.01);
  check(p.Rs === RS && p.Rc === RC && p.RL === RL && p.L === 2 && p.makeup === 2, 'model: 600 Ω into T1, 470 Ω from the carrier, a 600 Ω load, the inductance as set, a recovery gain of 2');
  check(Math.abs(p.is / want.is[1] - 1) < 1e-12 && Math.abs(p.nvt / want.nvt - 1) < 1e-12, 'model: each diode passes 1 mA at its family\'s voltage (the Bandgap\'s silicon: 0.58 V, n = 1.75)', `Is ${p.is.toExponential(3)} A, nVT ${(1e3 * p.nvt).toFixed(2)} mV`);
  check(Math.abs((p.nvt * Math.log(p.is / p.is1)) - 0.01) < 1e-12, 'model: the mismatched diode D1 needs 10 mV more for the same current', `${(1e3 * p.nvt * Math.log(p.is / p.is1)).toFixed(6)} mV`);
  check(Math.abs(p.rise - 2 * 3 / 0.5e6) < 1e-15, 'model: the square\'s comparator slews rail to rail (±3 V) at 0.5 V/µs, in 12 µs', `${(1e6 * p.rise).toFixed(2)} µs`);
}

// 2. the closed form: an unloaded ring between stiff sources multiplies in tanh's terms
for (const d of ['ge', 'si']) {
  const nvt = diodes(d).nvt, pairs = [];
  for (const u of [-0.12, -0.03, 0.004, 0.05, 0.1]) for (const vc of [-0.3, -0.06, 0.01, 0.12, 0.3]) pairs.push([u, vc]);
  const r = cppRing(W({ diodes: d, mismatch: 0 }), [1e-9, 1e-9, 0], pairs);
  const err = Math.max(...r.map((z, i) => Math.abs(z.w - unloaded(pairs[i][0], pairs[i][1], nvt))));
  check(err < 1e-9, `the unloaded ring between stiff sources (${d}): tanh(w/nVT) = tanh(u/nVT) tanh(vc/nVT)`, `worst ${err.toExponential(1)} V over ${pairs.length} points`);
}
{
  // its limits: a product for small signals, a switch for a large carrier
  const nvt = diodes('ge').nvt;
  const [small] = cppRing(W({ mismatch: 0 }), [1e-9, 1e-9, 0], [[1e-4, 1e-3]]);
  const [big] = cppRing(W({ mismatch: 0 }), [1e-9, 1e-9, 0], [[0.02, 0.5]]);
  check(Math.abs(small.w / (1e-4 * 1e-3 / nvt) - 1) < 1e-3 && Math.abs(big.w / 0.02 - 1) < 1e-3, 'its limits: w = u vc / nVT for small voltages, w = u for a carrier far past the knee', `${small.w.toExponential(4)} against ${(1e-4 * 1e-3 / nvt).toExponential(4)} V; ${big.w.toFixed(6)} against 0.02 V`);
}

// 3. the ring as built, the C++ against the JS circuit: loads, mismatch, large carriers
{
  let worst = 0, n = 0;
  for (const d of DIODES.map(([id]) => id)) for (const mm of [0, 0.02]) {
    const pairs = [];
    for (const vin of [-1, -0.2, 0.03, 0.4]) for (const vcar of [-10, -1, -0.1, 0.02, 0.3, 3, 10]) pairs.push([vin, vcar]);
    const r = cppRing(W({ diodes: d, mismatch: mm }), [RS, RC, RL], pairs);
    pairs.forEach(([vin, vcar], i) => {
      const z = ring({ vin, vcar, kind: d, mismatch: mm });
      worst = Math.max(worst, Math.abs(z.u - r[i].u), Math.abs(z.vc - r[i].vc), Math.abs(z.w - r[i].w), ...z.i.map((v, k) => Math.abs(v - r[i].i[k]) * 100));
      n++;
    });
  }
  check(worst < 1e-9, 'the ring\'s voltages and currents agree with the JS circuit (every diode, matched and not, carriers to ±10 V)', `worst ${worst.toExponential(1)} V (currents × 100 Ω), ${n} points`);
  // its symmetries: matched, w is odd in the carrier and in the bass
  const pairs = [[0.3, 2], [0.3, -2], [-0.3, 2], [0.05, 0.08], [0.05, -0.08], [-0.05, 0.08]];
  const r = cppRing(W({ mismatch: 0 }), [RS, RC, RL], pairs);
  const sym = Math.max(Math.abs(r[0].w + r[1].w), Math.abs(r[0].w + r[2].w), Math.abs(r[3].w + r[4].w), Math.abs(r[3].w + r[5].w));
  check(sym < 1e-12, 'matched diodes: w is odd in the carrier and in the bass, so neither comes out on its own', `${sym.toExponential(1)} V`);
}

// 4. the carrier's waveforms, against their definitions
{
  let worst = 0;
  const phases = Array.from({ length: 97 }, (_, i) => i / 96 - 0.37);
  for (const [wave] of WAVES) for (const [fc, amp] of [[1, 0.03], [220, 3], [4000, 10], [20000 / 3, 10]]) {
    const P = W({ wave, carrier: Math.min(fc, 4000), carrierLevel: amp });
    const c = cppCarrier(P, phases);
    phases.forEach((p, i) => { worst = Math.max(worst, Math.abs(c[i] - carrier(wave, amp, P.carrier, p))); });
  }
  check(worst < 1e-9, 'the carrier: sine, triangle, and the comparator\'s square slewing at 0.5 V/µs, as defined', `worst ${worst.toExponential(1)} V`);
  // the square slews: at 4 kHz and 10 V it spends 40 µs of each 125 µs half-cycle in between
  const c = cppCarrier(W({ wave: 'square', carrier: 4000, carrierLevel: 10 }), Array.from({ length: 1000 }, (_, i) => i / 1000));
  const between = c.filter((v) => Math.abs(v) < 9.999).length / 1000;
  check(Math.abs(between - 0.32) < 0.005, 'the square from 10 V at 4 kHz spends a third of its time slewing (2 × 40 µs of 250 µs)', `${(100 * between).toFixed(1)} %`);
}

// 5. the sidebands: the engine multiplies a small bass by the switching function, whose Fourier
//    coefficients C_m send f to f ± m fc, each at amplitude C_m (times the recovery gain)
{
  const f = 61.3, a = 0.01;
  for (const [what, over] of [['a 3 V sine at 220 Hz', { carrier: 220 }], ['a 10 V square at 1 kHz', { carrier: 1000, wave: 'square', carrierLevel: 10 }],
    ['a 0.3 V triangle at 700 Hz', { carrier: 700, wave: 'triangle', carrierLevel: 0.3 }], ['a 0.06 V sine at 500 Hz, below the knee', { carrier: 500, carrierLevel: 0.06 }],
    ['silicon, a 1 V sine at 300 Hz', { carrier: 300, carrierLevel: 1, diodes: 'si' }]]) {
    const P = C(over), js = jsCycle(P), y = steady(P, f, a);
    // the C++'s own switching function, the page's, against the JS circuit's
    const volts = Array.from({ length: 256 }, (_, i) => carrier(P.wave, P.carrierLevel, P.carrier, i / 256));
    const cg = cppSwitching(P, volts).g;
    const gerr = Math.max(...cg.map((v, i) => Math.abs(v - js.g[i])));
    const errs = [], parts = [];
    for (const m of [1, 3]) {
      const want = 2 * a * fourier(js.g, m);
      for (const s of [1, -1]) {
        const fr = Math.abs(f + s * m * P.carrier);
        if (fr > 20000) continue;
        const got = at(y, fr);
        if (want > 1e-4 * a) { errs.push(Math.abs(db(got / want))); parts.push(`${fr.toFixed(0)} Hz ${db(got / a).toFixed(2)} dB`); }
      }
    }
    check(gerr < 1e-6 && Math.max(...errs) < 0.1, `sidebands, ${what}: at f ± fc and 3fc ± f as the switching function's Fourier series says (0.1 dB)`, `${parts.join(', ')}; worst ${Math.max(...errs).toFixed(3)} dB; switching function ${gerr.toExponential(1)}`);
  }
}

// 6. balance: matched diodes let neither the bass nor the carrier through; a mismatched one leaks
//    the carrier, as the JS circuit's steady state with nothing in says
{
  const f = 61.3, a = 0.3;
  const y = steady(C({}), f, a);
  const sb = at(y, 220 + f);
  check(db(at(y, f) / sb) < -100 && db(at(y, 220)) < -120, 'matched diodes: the bass and the carrier cancel at the output (more than 100 dB below the sidebands)', `bass ${db(at(y, f) / sb).toFixed(0)} dB, carrier ${db(at(y, 220)).toFixed(0)} dBV`);
  const leak = (mm) => at(run(C({ mismatch: mm }), new Float32Array(2 * fs)).L.subarray(fs), 220);
  const l2 = leak(0.002), l30 = leak(0.03), js30 = steadyLeak({ wave: 'sine', amp: 3, fc: 220, kind: 'ge', mismatch: 0.03 }), w30 = 2 * 2 * fourier(js30, 1);
  const cw = cppCycle(C({ mismatch: 0.03 }), 256).w0, cerr = Math.max(...cw.map((v, i) => Math.abs(v - js30[i])));
  check(cerr < 1e-9, 'the page\'s leak over a cycle (the C++\'s steady state) agrees with the JS circuit\'s', `${cerr.toExponential(1)} V`);
  check(Math.abs(db(l30 / w30)) < 0.2, 'a diode 30 mV off: the carrier leaks through as the JS circuit\'s steady state says, the transformers holding no DC (0.2 dB)', `${(1e3 * l30).toFixed(2)} mV against ${(1e3 * w30).toFixed(2)} mV`);
  check(l2 > 0.5e-3 && l2 < 2e-3 && l30 / l2 > 12 && l30 / l2 < 18, 'the hint: 2 mV off lets about a millivolt of the 3 V carrier through, 30 mV fifteen times as much', `${(1e3 * l2).toFixed(2)} mV and ${(1e3 * l30).toFixed(1)} mV, × ${(l30 / l2).toFixed(1)}`);
}

// 7. the transformers' low cut, from complex impedances: T1's magnetising inductance across the
//    ring's input resistance RL + r/2 and the 600 Ω source; T2's across the load and the ring's
//    output resistance Rs + r/2 (r: a diode that is on, nVT over its current)
{
  const P = C({ wave: 'square', carrierLevel: 10, carrier: 1000, inductance: 3 });
  const on = ring({ vin: 0, vcar: 10, kind: 'ge' }), r = diodes('ge').nvt / on.i[0];
  const hp = (f, R) => { const wL = 2 * Math.PI * f * P.inductance; return 1 / Math.hypot(1, R / wL); };
  const par = (p, q2) => (p * q2) / (p + q2);
  const Rin = par(RS, RL + r / 2), Rout = par(RL, RS + r / 2);
  // the input: the f + fc sideband for a 16 Hz bass against a 400 Hz one
  const s16 = at(steady(P, 16), 1016) / at(steady(P, 400), 1400), w16 = hp(16, Rin) / hp(400, Rin);
  check(Math.abs(db(s16 / w16)) < 0.2, 'T1 at 3 H: a 16 Hz bass reaches the ring 3 dB down, as the inductance across 300 Ω says (0.2 dB)', `${db(s16).toFixed(2)} dB against ${db(w16).toFixed(2)} dB; r = ${r.toFixed(1)} Ω`);
  // the output: the 16 Hz difference tone of 1016 Hz and the carrier, against its 2016 Hz sum
  const y = steady(P, 1016), d16 = at(y, 16) / at(y, 2016), wd = hp(16, Rout) / hp(2016, Rout);
  check(Math.abs(db(d16 / wd)) < 0.3, 'T2 at 3 H: a 16 Hz difference tone leaves 3 dB down against its sum (0.3 dB)', `${db(d16).toFixed(2)} dB against ${db(wd).toFixed(2)} dB`);
  const corner = (L) => Rin / (2 * Math.PI * L);
  check(Math.abs(corner(3) - 16) < 0.5 && Math.abs(corner(0.3) - 160) < 5, 'the hint: about 300 Ω either side, so 3 H puts the low cut at 16 Hz and 0.3 H at 160 Hz', `${corner(3).toFixed(1)} Hz, ${corner(0.3).toFixed(0)} Hz`);
}

// 8. the hints on the sound
{
  // Carrier: the A at 55 Hz with the carrier at 220 Hz comes out at 165 and 275 Hz, and neither 55 nor 220
  const y = steady(W({}), 55, 0.2);
  const scan = Array.from({ length: 600 }, (_, i) => 10 + i), amps = scan.map((fr) => at(y, fr));
  const top = scan.map((fr, i) => [fr, amps[i]]).sort((p, q2) => q2[1] - p[1]);
  const peaks = [];
  for (const [fr] of top) { if (peaks.every((p) => Math.abs(p - fr) > 8)) peaks.push(fr); if (peaks.length === 2) break; }
  peaks.sort((p, q2) => p - q2);
  check(peaks[0] === 165 && peaks[1] === 275 && db(at(y, 55) / at(y, 275)) < -40 && db(at(y, 220) / at(y, 275)) < -30, 'the hint: the A at 55 Hz through a 220 Hz carrier comes out at 165 and 275 Hz, without 55 or 220', `peaks at ${peaks.join(' and ')} Hz; 55 Hz at ${db(at(y, 55) / at(y, 275)).toFixed(0)} dB, 220 Hz at ${db(at(y, 220) / at(y, 275)).toFixed(0)} dB`);
  // below 20 Hz, a tremolo whose every other beat is upside down: the output follows the bass
  // in one half of the carrier's cycle and its negative in the other
  const fc = 6, P = W({ carrier: fc }), inp = sine(110, fs, fs, 0.2), out = run(P, inp).L;
  const lat = run(P, new Float32Array(16)).latency;
  const corr = (from, to) => { let s = 0; for (let i = from; i < to; i++) s += out[i + lat] * inp[i]; return s; };
  const half = fs / fc / 2, signs = [0, 1, 2, 3].map((k) => Math.sign(corr(Math.round((k + 0.2) * half), Math.round((k + 0.8) * half))));
  check(signs.join(',') === '1,-1,1,-1', 'the hint: a 6 Hz carrier is a tremolo whose every other beat comes out upside down', signs.join(', '));
  // a carrier a whole number of times the note keeps it harmonic: the tuner still reads the A
  const TB = await loadBass();
  const b = new TB(fs); b.note(33, 0.8);
  const dry = new Float32Array(fs); b.process(dry);
  const wet = run(W({ carrier: 4 * 55 }), dry).L;
  const f0 = tune(wet.subarray(4800, 4800 + 16384), fs), want = tune(dry.subarray(4800, 4800 + 16384), fs);
  check(f0 && Math.abs(1200 * Math.log2(f0 / want)) < 10, 'the hint: through a carrier four times the A, the tuner still reads the test bass\'s A (10 cents)', `${f0?.toFixed(2)} Hz out for ${want?.toFixed(2)} Hz in`);
}
{
  // Carrier level: strong, a square switching function, 3fc ± f a third as loud; weak, a smooth
  // product, only f ± fc, and quieter; near the bass's level, the bass's harmonics join in
  const f = 61.3;
  const side = (P, a = 0.01) => { const y = steady(P, f, a); return { s1: at(y, 220 + f), s3: at(y, 660 + f), h3: at(y, 3 * f + 220) }; };
  const strong = side(C({ carrierLevel: 3 })), weak = side(C({ carrierLevel: 0.03 }));
  check(strong.s3 / strong.s1 > 0.28 && strong.s3 / strong.s1 < 0.36, 'the hint: a strong carrier switches the ring, and 3fc + f comes out about a third as loud as fc + f', `× ${(strong.s3 / strong.s1).toFixed(3)} (a square's: 1/3)`);
  check(db(weak.s3 / weak.s1) < -35 && db(weak.s1 / strong.s1) < -20, 'the hint: at 30 mV of carrier, f ± fc come out almost alone (3fc + f more than 35 dB down), and 20 dB quieter', `3fc + f at ${db(weak.s3 / weak.s1).toFixed(1)} dB; fc + f ${db(weak.s1 / strong.s1).toFixed(1)} dB against 3 V`);
  const loud = side(C({ carrierLevel: 0.06 }), 0.3), quietBass = side(C({ carrierLevel: 3 }), 0.3);
  check(db(loud.h3 / loud.s1) - db(quietBass.h3 / quietBass.s1) > 30, 'the hint: with the bass louder than the carrier, its harmonics join the sidebands (3f + fc 30 dB louder than under a strong carrier)', `3f + fc at ${db(loud.h3 / loud.s1).toFixed(1)} dB under a 0.06 V carrier, ${db(quietBass.h3 / quietBass.s1).toFixed(1)} dB under 3 V`);
  // Carrier wave: near the knee the square switches hardest, the triangle least
  const w = (wave) => side(C({ carrierLevel: 0.3, wave }));
  const sq = w('square'), si = w('sine'), tr = w('triangle');
  check(sq.s1 > si.s1 && si.s1 > tr.s1 && sq.s3 > si.s3, 'the hint: at 0.3 V the square switches hardest and brightest, the triangle least', `fc + f: square ${db(sq.s1 / 0.01).toFixed(2)}, sine ${db(si.s1 / 0.01).toFixed(2)}, triangle ${db(tr.s1 / 0.01).toFixed(2)} dB; 3fc + f: square ${db(sq.s3 / 0.01).toFixed(1)}, sine ${db(si.s3 / 0.01).toFixed(1)} dB`);
  // Diodes: silicon needs a stronger carrier
  const ge = side(C({ carrierLevel: 0.3 })), sil = side(C({ carrierLevel: 0.3, diodes: 'si' }));
  check(ge.s1 / sil.s1 > 10, 'the hint: at 0.3 V of carrier the sidebands from silicon are more than ten times quieter than from germanium', `× ${(ge.s1 / sil.s1).toFixed(1)}`);
  // Mix: at 100 % the note is gone; at 50 % it is back at half
  const m = (mix) => { const y = steady(C({ mix }), f, 0.1); return at(y, f) / 0.1; };
  check(db(m(1)) < -100 && Math.abs(m(0.5) - 0.5) < 0.01, 'the hint: at 100 % mix the note you play is gone; at 50 % it is back, at half', `${db(m(1)).toFixed(0)} dB, then × ${m(0.5).toFixed(3)}`);
  // Level: at 0 dB a strong carrier gives the sidebands back about as loud as the bass went in
  const inp = sine(f, fs, 2 * fs, 0.2), ratio = rms(run(C({ wave: 'square', carrierLevel: 10 }), inp).L.subarray(fs)) / rms(inp.subarray(fs));
  check(ratio > 0.9 && ratio < 1, 'the hint: at 0 dB a strong carrier gives the sidebands back about as loud as the bass went in', `× ${ratio.toFixed(3)} in RMS`);
  check(PEDAL.expression === 'carrier', 'an expression pedal sweeps the carrier');
}

// 9. the solver: Newton converges, fast, on a loud bass, at every quality, diode and wave
for (const [qu, most] of [['high', 4], ['medium', 5], ['low', 7]]) {
  let worstIt = 0, fails = 0, finite = true;
  const loud = sine(41.2, fs, fs / 2, 1.5);
  for (const d of DIODES.map(([id]) => id)) for (const [wave] of WAVES) for (const [fc, amp] of [[4000, 10], [220, 3], [30, 0.03]]) {
    const r = run(W({ diodes: d, wave, carrier: fc, carrierLevel: amp, mismatch: 0.03 }), loud, qu);
    worstIt = Math.max(worstIt, r.iterations); fails += r.failures; finite &&= r.L.every(Number.isFinite);
  }
  check(fails === 0 && finite && worstIt < most, `Newton converges on a loud bass through every diode and carrier, a 10 V square at 4 kHz the hardest (${qu} quality: under ${most} iterations a step)`, `${worstIt.toFixed(2)} iterations a step at worst`);
}

// 10. hygiene
{
  const r = run(C({}), new Float32Array(fs));
  check(Math.max(...r.L.map(Math.abs)) < 1e-9, 'silence in, silence out, with matched diodes', `${Math.max(...r.L.map(Math.abs)).toExponential(1)} V`);
  const e = new Effect(fs);
  e.setParams(W({}));
  const bad = new Float32Array(128); bad[5] = NaN;
  const L = new Float32Array(4096), R = new Float32Array(4096);
  const ok = e.process(bad, L.subarray(0, 128), R.subarray(0, 128));
  e.process(sine(100, fs, 4096, 0.1), L, R);
  check(!ok && L.every(Number.isFinite) && Math.max(...L.map(Math.abs)) > 0.01, 'a NaN in comes out as a silent block, and the pedal recovers');
  e.destroy();
  check(L.every(Number.isFinite) && R.every((v, i) => v === L[i]), 'mono out on both sides');
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
  for (const [qu, budget] of [['high', 0.12], ['medium', 0.07]]) {
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
