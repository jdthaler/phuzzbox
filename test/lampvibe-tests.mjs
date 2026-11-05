// lampvibe-tests.mjs — the Lamp Vibe against its physics worked out independently of the C++
// (test/lampvibe-circuit.mjs: the filament's power balance by Newton's method, tungsten's
// emissivity by a second free-electron formula, the cells' light integrated over frequency, the
// stages' phase as arctangents), the vibrato's pitch from the rate its phase turns, and each
// knob's hint.

import { check, done, CI } from './harness.mjs';
import { loadPedal, loadBass } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { amplitudeAt, db, sine, peak, rms } from '../tools/audio-util.mjs';
import { tune } from '../shared/tuner.js';
import { rho, parkerAbbott, davissonWeeks, LAMPS, filament, settle, timeConstant, glow, cellN, cellR, phase, chorusGainAt, notches, net } from './lampvibe-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('lampvibe');
const x = Effect.exports;
const fs = 48000;
const D = { ...defaults(PEDAL.groups), level: 0 };
const W = (over) => ({ ...D, ...over });
const BULBS = Object.keys(LAMPS);

// the C++ model through its exports
function call(fn, P, extra = [], args = []) {
  const s = scratch(x), v = P ? Effect.native(P) : [];
  if (v.length) s.f64(v.length).set(v);
  if (extra.length) s.f64(extra.length, 8 * v.length).set(extra);
  x[fn](s.at, ...args);
  return { n: v.length, read: (count, at = 0) => Array.from(s.f64(count, 8 * at)) };
}
const cppSteady = (P, volts) => { const n = volts.length, c = call('lampvibe_steady', P, volts, [n]), r = c.read(3 * n, c.n + n); return { T: r.slice(0, n), I: r.slice(n, 2 * n), glow: r.slice(2 * n) }; };
const cppFilament = (P, T0, dt, volts) => { const n = volts.length, c = call('lampvibe_filament', P, [T0, dt, ...volts], [n]); return c.read(n, c.n + 2 + n); };
const cppTungsten = (temps) => { const n = temps.length, c = call('lampvibe_tungsten', null, temps, [n]), r = c.read(3 * n, n); return { rho: r.slice(0, n), eps: r.slice(n, 2 * n), glow: r.slice(2 * n) }; };
const cppResponse = (P, R, freqs) => { const n = freqs.length, c = call('lampvibe_response', P, [R, ...freqs], [n]), r = c.read(2 * n, c.n + 1 + n); return { gain: r.slice(0, n), phase: r.slice(n) }; };
const cppParts = (P) => { const r = call('lampvibe_parts', P).read(20); return { V: r[0], I: r[1], T: r[2], d: r[3], L: r[4], A: r[5], C: r[6], Rcold: r[7] }; };

function run(P, input) {
  const e = new Effect(fs);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length);
  const ok = e.process(input, L, R);
  const out = { L, R, ok, messages: e.messages(), latency: e.latency() };
  e.destroy();
  return out;
}
// the engine's record of the lamp: [T, mA, glow, kΩ, V] 120 times a second
const trace = (P, seconds) => run(P, new Float32Array(seconds * fs)).messages.filter((m) => m.type === 1).flatMap((m) => [0, 1, 2, 3, 4].map((j) => Array.from(m.values.slice(5 * j, 5 * j + 5))));
const range = (pts, k) => { let lo = Infinity, hi = -Infinity; for (const p of pts) { lo = Math.min(lo, p[k]); hi = Math.max(hi, p[k]); } return [lo, hi]; };

// 1. tungsten: the resistivity table, and the emissivity's two free-electron formulas
{
  const temps = [300, 350, 1000, 1234, 2000, 2500, 2950, 3600], c = cppTungsten(temps);
  const worst = Math.max(...temps.map((T, i) => Math.abs(c.rho[i] / rho(T) - 1)));
  check(worst < 1e-12, 'tungsten: its resistivity is Forsythe and Watson\'s, 300–3600 K', `worst ${worst.toExponential(1)}`);
  const pa = Math.max(...temps.map((T, i) => Math.abs(c.eps[i] - parkerAbbott(T))));
  check(pa < 1e-12, 'its emissivity is Parker and Abbott\'s free-electron formula from ρT', `worst ${pa.toExponential(1)}`);
  const dw = Math.max(...[300, 600, 1000, 1500, 2000, 2500].map((T) => Math.abs(parkerAbbott(T) / davissonWeeks(T) - 1)));
  check(dw < 0.015, 'which agrees with Davisson and Weeks\'s series to 1.5 % up to 2500 K', `worst ${(100 * dw).toFixed(2)} %`);
  check(Math.abs(parkerAbbott(300) - 0.03) < 0.002 && Math.abs(parkerAbbott(2500) - 0.243) < 0.002, 'the README: 0.03 at room temperature, 0.24 at 2500 K', `${parkerAbbott(300).toFixed(4)}, ${parkerAbbott(2500).toFixed(4)}`);
}

// 2. the filament: sized from its rating, settling where its power balance says
{
  for (const bulb of BULBS) {
    const P = W({ bulb }), lamp = LAMPS[bulb], f = filament(lamp), pp = cppParts(P);
    check(Math.abs(pp.d / f.d - 1) < 1e-9 && Math.abs(pp.L / f.L - 1) < 1e-9 && Math.abs(pp.C / f.C - 1) < 1e-9, `${bulb}: the filament's size and heat capacity follow from the rating`, `${(pp.d * 1e6).toFixed(1)} µm × ${(pp.L * 1e3).toFixed(1)} mm, ${(pp.C * 1e6).toFixed(1)} µJ/K`);
    const volts = [lamp.V, 0.7 * lamp.V, 0.5 * lamp.V, 0.3 * lamp.V, 0.1 * lamp.V], c = cppSteady(P, volts);
    const worst = Math.max(...volts.map((v, i) => Math.abs(c.T[i] - settle(f, v))));
    check(worst < 1e-3, `${bulb}: the filament settles where the power in is the power radiated`, `worst ${worst.toExponential(1)} K`);
    check(Math.abs(c.T[0] - lamp.T) < 1e-3 && Math.abs(c.I[0] / lamp.I - 1) < 1e-6, `${bulb}: at its rated voltage it runs at its rated temperature and current`, `${c.T[0].toFixed(3)} K, ${(1000 * c.I[0]).toFixed(3)} mA`);
  }
  const P = W({ bulb: 'pilot' }), pp = cppParts(P), ratio = (P2) => cppParts(P2).V / cppParts(P2).I / cppParts(P2).Rcold;
  check(Math.abs(ratio(P) - rho(2500) / rho(300)) < 1e-9 && Math.abs(ratio(P) - 13.1) < 0.05, 'the README: cold, the filament has a thirteenth of its hot resistance', `${ratio(P).toFixed(2)}, ${pp.Rcold.toFixed(2)} Ω`);
}

// 3. the filament's time constant: the engine's integration against the slope of the power balance
{
  const tauOf = (bulb, frac) => {
    const P = W({ bulb }), lamp = LAMPS[bulb], v0 = frac * lamp.V, v1 = 1.01 * v0, f = filament(lamp);
    const want = timeConstant(f, (v0 + v1) / 2), T0 = settle(f, v0), T1 = settle(f, v1), dt = want / 1000, n = 4000, T = cppFilament(P, T0, dt, new Array(n).fill(v1));
    const k = T.findIndex((t) => (t - T0) / (T1 - T0) >= 1 - Math.exp(-1));
    return { got: (k + 1) * dt, want };
  };
  const taus = {};
  for (const bulb of BULBS) {
    for (const frac of [1, 0.5]) {
      const { got, want } = tauOf(bulb, frac);
      taus[`${bulb}${frac}`] = want;
      check(Math.abs(got / want - 1) < 0.02, `${bulb} at ${100 * frac} % of its voltage: a small step settles with the time constant C / (d net power / dT)`, `${(1000 * got).toFixed(2)} ms for ${(1000 * want).toFixed(2)} ms`);
    }
  }
  const rated = Object.fromEntries(BULBS.map((b) => [b, 1000 * timeConstant(filament(LAMPS[b]), LAMPS[b].V)]));
  check(Math.abs(rated.grain - 6.2) < 0.05 && Math.abs(rated.pilot - 12.9) < 0.05 && Math.abs(rated.panel - 25.5) < 0.05, 'the Lamp hint and the README: 6.2, 12.9 and 25.5 ms at the rating', `${rated.grain.toFixed(2)}, ${rated.pilot.toFixed(2)}, ${rated.panel.toFixed(2)} ms`);
  const slower = BULBS.map((b) => taus[`${b}0.5`] / taus[`${b}1`]);
  check(slower.every((r) => Math.abs(r - 2.45) < 0.1), 'and two and a half times longer at half the voltage', slower.map((r) => r.toFixed(2)).join(', '));
  // switched on cold, the filament heats as fast as its rating's current thirteen times over allows
  const f = filament(LAMPS.pilot), v = LAMPS.pilot.V, dt = 1e-6, n = 400, T = cppFilament(W({ bulb: 'pilot' }), 300, dt, new Array(n).fill(v));
  let Tj = 300; for (let i = 0; i < n; i++) { const k1 = net(f, v, Tj) / f.C, k2 = net(f, v, Tj + 0.5 * dt * k1) / f.C, k3 = net(f, v, Tj + 0.5 * dt * k2) / f.C, k4 = net(f, v, Tj + dt * k3) / f.C; Tj += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4); }
  check(Math.abs(T[n - 1] - Tj) < 0.5, 'switched on cold, the filament warms as the power balance integrates', `${T[n - 1].toFixed(1)} K after 0.4 ms for ${Tj.toFixed(1)} K`);
}

// 4. the glow: Planck's law weighted by the cells' response, integrated over frequency
{
  const temps = [1000, 1400, 1800, 2000, 2200, 2500, 2800, 3200], c = cppTungsten(temps);
  const worst = Math.max(...temps.map((T, i) => Math.abs(c.glow[i] / glow(T, 2500) - 1)));
  check(worst < 0.005, 'glow: the light the cells see is the black body\'s photons in their band, 1000–3200 K', `worst ${(100 * worst).toFixed(3)} %`);
  const g = 1 / glow(2000, 2500), p = (parkerAbbott(2500) * (2500 ** 4 - 300 ** 4)) / (parkerAbbott(2000) * (2000 ** 4 - 300 ** 4));
  check(Math.abs(g - 11.5) < 0.3 && Math.abs(p - 3) < 0.1, 'the README: from 2000 K to 2500 K the cells\' light grows elevenfold, the power radiated only triples', `${g.toFixed(2)}×, ${p.toFixed(2)}×`);
}

// 5. the cells and the stages, the lamp held steady: the engine against the arctangents
{
  for (const mode of ['chorus', 'vibrato']) {
    const P = W({ intensity: 0, mode }), pts = trace(P, 1), R = 1e3 * pts.at(-1)[3], want = cellR(cellN(1));
    check(Math.abs(R / want - 1) < 1e-4, `${mode}: lit at its rating, each cell's resistance is where n(1 + n) = 1 puts it`, `${R.toFixed(1)} Ω for ${want.toFixed(1)} Ω`);
    let worst = 0, at = 0;
    for (const f of [30, 60, 100, 150, 250, 500, 1000, 2000]) {
      const a = 0.1, g = amplitudeAt(run(P, sine(f, fs, fs, a)).L.subarray(fs / 2), f, fs) / a;
      const exp = mode === 'vibrato' ? 1 : chorusGainAt(want, f, fs);
      if (Math.abs(g - exp) > worst) { worst = Math.abs(g - exp); at = f; }
    }
    check(worst < 1e-3, `${mode}: the engine's gain is the four stages' arctangents' (${mode === 'chorus' ? '|cos(φ/2)|' : 'unity'}), each prewarped to its corner, 30 Hz–2 kHz`, `worst ${worst.toFixed(4)} (at ${at} Hz)`);
    const freqs = [20, 131, 700, 3712], cr = cppResponse(P, want, freqs);
    const wp = Math.max(...freqs.map((f, i) => Math.abs(cr.phase[i] - phase(want, f))));
    check(wp < 1e-9, `${mode}: the page's phase is the stages'`, `worst ${wp.toExponential(1)} rad`);
  }
  const [n1, n2] = notches(cellR(cellN(1)));
  check(Math.abs(n1 - 130) < 5 && Math.abs(n2 - 3700) < 100, 'the Mode hint: at the lamp\'s rating the chorus\'s notches are near 130 Hz and 3.7 kHz', `${n1.toFixed(1)} Hz, ${n2.toFixed(0)} Hz`);
  const [d1, d2] = notches(250e3);
  check(d1 < 5 && Math.abs(d2 - 70) < 5, 'and with the cells at 250 kΩ, down to a few hertz and 70 Hz', `${d1.toFixed(1)} Hz, ${d2.toFixed(1)} Hz`);
  const dip = amplitudeAt(run(W({ intensity: 0 }), sine(n2, fs, fs, 0.1)).L.subarray(fs / 2), n2, fs) / 0.1;
  check(dip < 0.05, 'a note at the upper notch all but vanishes in chorus', `${db(dip).toFixed(1)} dB`);
}

// 6. the hints, from the engine's own record of its lamp
{
  const swing = (over, k = 0) => { const pts = trace(W(over), 6).slice(4 * 120); return range(pts, k); };
  const s1 = swing({ speed: 1 }), s12 = swing({ speed: 12 });
  check(Math.abs(s1[0] - 1710) < 15 && Math.abs(s1[1] - 2500) < 5 && Math.abs(s12[0] - 2010) < 15 && Math.abs(s12[1] - 2390) < 15, 'Speed: the pilot lamp swings 1710–2500 K at 1 Hz, 2010–2390 K at 12 Hz',
    `${s1.map((t) => t.toFixed(0)).join('–')} K, ${s12.map((t) => t.toFixed(0)).join('–')} K`);
  const g1 = swing({ speed: 1 }, 2), r1 = swing({ speed: 1 }, 3);
  check(g1[1] / g1[0] > 75 && g1[1] / g1[0] < 100 && Math.abs(r1[0] - 4.9) < 0.2 && r1[1] > 200 && r1[1] < 300, 'Intensity: at 70 %, slowly swept, the glow falls nearly a hundredfold and the cells climb from 5 kΩ to some 250 kΩ',
    `${(g1[1] / g1[0]).toFixed(0)}×, ${r1[0].toFixed(2)}–${r1[1].toFixed(0)} kΩ`);
  const oct = Math.log2(r1[1] / r1[0]);
  check(oct > 5.4 && oct < 6, 'sweeping the notches over nearly six octaves', `${oct.toFixed(2)} octaves`);
  const still = swing({ intensity: 0 }, 3);
  check(still[1] - still[0] < 1e-3, 'at 0 the lamp burns steady and the notches stand still', `${(still[1] - still[0]).toExponential(1)} kΩ`);
  const span = (bulb) => { const t = swing({ bulb, speed: 6, intensity: 0.9 }); return t[1] - t[0]; };
  const sp = BULBS.map(span);
  check(sp[0] > sp[1] && sp[1] > sp[2], 'Lamp: a bigger bulb follows the oscillator less', `${sp.map((s) => s.toFixed(0)).join(', ')} K of swing at 6 Hz`);
  const cr = (cell) => { const r = swing({ cell }, 3); return r[1] / r[0]; };
  check(cr(60e-3) < cr(15e-3) && cr(15e-3) < cr(3e-3), 'Cells: a longer lifetime smooths the swing of the cells\' resistance', `${cr(3e-3).toFixed(0)}×, ${cr(15e-3).toFixed(0)}×, ${cr(60e-3).toFixed(0)}× at 3, 15, 60 ms`);
  // the cells fall fast and climb slowly: the time from top to bottom of their swing against back
  const pts = trace(W({ speed: 1, intensity: 0.7 }), 6).slice(4 * 120, 5 * 120), R = pts.map((p) => p[3]);
  const lo = R.indexOf(Math.min(...R)), hi = R.indexOf(Math.max(...R)), fall = (lo - hi + 120) % 120, climb = 120 - fall;
  check(fall < climb, 'the cells\' resistance falls faster than it climbs', `${fall} and ${climb} points of 120`);
  // Level: vibrato as loud as the input
  // (by RMS over a second: the wavering pitch spreads the note over neighbouring frequencies)
  const vin = sine(220, fs, 2 * fs, 0.2), v = rms(run(W({ mode: 'vibrato', speed: 3 }), vin).L.subarray(fs)) / rms(vin.subarray(fs));
  check(Math.abs(db(v)) < 0.3, 'Level: in vibrato the output is as loud as the input', `${db(v).toFixed(2)} dB`);
}

// 7. vibrato: a note's pitch moves as fast as the stages' phase turns, Δf = (1/2π) dφ/dt
{
  const f0 = 200, P = W({ mode: 'vibrato', speed: 1.5, intensity: 1 }), n = 4 * fs, r = run(P, sine(f0, fs, n, 0.2));
  const pts = r.messages.filter((m) => m.type === 1).flatMap((m) => [0, 1, 2, 3, 4].map((j) => m.values[5 * j + 3] * 1e3));
  const ph = pts.map((R) => phase(R, f0)), every = 400 / fs;
  let want = 0;
  for (let j = 2 * 120; j < ph.length - 1; j++) want = Math.max(want, Math.abs((ph[j + 1] - ph[j]) / every) / (2 * Math.PI));
  // measured: each period's frequency from the upward zero crossings
  const y = r.L, ups = [];
  for (let i = 1; i < n; i++) if (y[i - 1] < 0 && y[i] >= 0) ups.push(i - 1 + -y[i - 1] / (y[i] - y[i - 1]));
  let got = 0;
  for (let k = 1; k < ups.length; k++) if (ups[k] > 2 * fs) got = Math.max(got, Math.abs(fs / (ups[k] - ups[k - 1]) - f0));
  check(want > 1 && Math.abs(got / want - 1) < 0.15, 'vibrato: a 200 Hz note wavers by as much as the stages\' phase turns, (1/2π) dφ/dt', `${got.toFixed(2)} Hz measured, ${want.toFixed(2)} Hz from the phase`);
}

// 8. hygiene
{
  const r = run(W({}), new Float32Array(fs));
  check(peak(r.L) < 1e-9, 'silence in, silence out', `${peak(r.L).toExponential(1)} V`);
  const e = new Effect(fs);
  e.setParams(W({}));
  const bad = new Float32Array(128); bad[5] = NaN;
  const L = new Float32Array(4096), R = new Float32Array(4096);
  const ok = e.process(bad, L.subarray(0, 128), R.subarray(0, 128));
  e.process(sine(100, fs, 4096, 0.1), L, R);
  check(!ok && L.every(Number.isFinite) && peak(L) > 0.01, 'a NaN in comes out as a silent block, and the pedal recovers');
  e.destroy();
  check(R.every((v, i) => v === L[i]), 'mono out on both sides');
  check(run(W({}), new Float32Array(128)).latency === 0, 'no latency');
  const ids = new Map(PEDAL.groups.flatMap((g) => g.params).map((p) => [p.id, p]));
  const badP = Object.entries(PEDAL.presets).flatMap(([nm, v]) => Object.entries(v).filter(([id, val]) => {
    const p = ids.get(id);
    if (!p) return true;
    if (p.type === 'select') return !p.options.some(([o]) => o === val);
    return typeof val === 'number' && (val < p.min || val > p.max);
  }).map(([id]) => `${nm}: ${id}`));
  check(!badP.length, 'every preset sets real parameters inside their ranges', badP.join(', '));
}

// 9. end to end: the test bass's note keeps its pitch through the chorus
{
  const TB = await loadBass(), b = new TB(fs);
  b.note(33, 0.8);
  const dry = new Float32Array(fs);
  b.process(dry);
  const y = run(W({ intensity: 0 }), dry).L;
  const f0 = tune(y.subarray(4800, 4800 + 16384), fs), want = tune(dry.subarray(4800, 4800 + 16384), fs);
  check(f0 && want && Math.abs(1200 * Math.log2(f0 / want)) < 2, 'the test bass\'s A keeps its pitch through the stages, to the tuner\'s eye (2 cents)', `${f0?.toFixed(3)} Hz out for ${want?.toFixed(3)} Hz in`);
}

// 10. CPU
if (!CI) {
  const n = 10 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 82.4 * i) / fs));
  const e = new Effect(fs);
  e.setParams(W({}));
  const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
  e.process(inp, L, R);
  const share = (performance.now() - t0) / 1000 / 10;
  e.destroy();
  check(share < 0.03, 'CPU: under 3 % of a core (WebAssembly)', `${(100 * share).toFixed(1)} %`);
}

done();
