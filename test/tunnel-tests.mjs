// tunnel-tests.mjs — the Tunnel Diode against the circuit worked out independently of the C++
// (test/tunnel-circuit.mjs): Sze's three currents fitted to GE's points by Newton's method in all
// three at once, the switch's thresholds by scanning its load line for turning points, the switch
// without capacitance as a map that keeps its branch, and the relaxation oscillator's period as an
// integral over the current along each branch; GE's condition for memory, R > 1/|g|; and each
// knob's hint.

import { check, done, CI } from './harness.mjs';
import { loadPedal } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { amplitudeAt, db, sine } from '../tools/audio-util.mjs';
import { fitDiode, extremes, thresholds, root, switchMap, period } from './tunnel-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('tunnel');
const x = Effect.exports;
const fs = 48000;
const D = { ...defaults(PEDAL.groups), level: 0 };
const W = (over) => ({ ...D, ...over });
const OSC = (over) => W({ circuit: 'oscillator', load: 20, bias: 0.2, drive: 0.3, ...over });
const d = fitDiode(), ex = extremes(d);

// the C++ model through its exports
function call(fn, P, extra = [], args = []) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length).set(v);
  if (extra.length) s.f64(extra.length, 8 * v.length).set(extra);
  x[fn](s.at, ...args);
  return { n: v.length, read: (count, at = 0) => Array.from(s.f64(count, 8 * at)) };
}
const cppParts = (P) => { const r = call('tunnel_parts', P).read(14); return { Ip: r[0], Vp: r[1], Iv: r[2], Vv: r[3], Vfp: r[4], I0: r[5], Jx: r[6], C4: r[7], Vm: r[8], gmin: r[9], up: r[10], down: r[11], osc: r[12], C: r[13] }; };
const cppCurve = (V) => { const c = call('tunnel_curve', W({}), V, [V.length]); return c.read(V.length, c.n + V.length); };
const cppStates = (P, vs) => { const c = call('tunnel_states', P, vs, [vs.length]); const r = c.read(2 * vs.length, c.n + vs.length); return vs.map((_, i) => [r[2 * i], r[2 * i + 1]]); };
// the scratch area holds 8192 numbers: P, two inputs and three arrays of n
const cppTone = (P, f, amp, n) => { if (n > 2700) throw new Error('n too large for the scratch area'); const c = call('tunnel_tone', P, [f, amp], [n]); return { vs: c.read(n, c.n + 2), V: c.read(n, c.n + 2 + n), i: c.read(n, c.n + 2 + 2 * n) }; };

function run(P, input, quality = 'high') {
  const e = new Effect(fs);
  e.setQuality(quality);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length);
  const ok = e.process(input, L, R);
  const out = { L, R, ok, evaluations: x.tunnel_evaluations(x.px_effect(e.h)), latency: e.latency() };
  e.destroy();
  return out;
}
const steady = (P, f, a, quality = 'high') => run(P, sine(f, fs, fs, a), quality).L.subarray(fs / 2);
const at = (y, f) => amplitudeAt(y, f, fs);
const pp = (y) => Math.max(...y) - Math.min(...y);
// the frequency of a waveform from its upward crossings of its middle, interpolated
function frequency(y, rate) {
  const mid = (Math.max(...y) + Math.min(...y)) / 2, t = [];
  for (let k = 1; k < y.length; k++) if (y[k - 1] < mid && y[k] >= mid) t.push(k - 1 + (mid - y[k - 1]) / (y[k] - y[k - 1]));
  return t.length > 2 ? ((t.length - 1) * rate) / (t[t.length - 1] - t[0]) : 0;
}

// 1. the diode: the fit, its curve, its peak, valley and steepest slope
{
  const p = cppParts(W({}));
  const rel = (a, b) => Math.abs(a / b - 1);
  check(rel(p.I0, d.I0) < 1e-8 && rel(p.Jx, d.Jx) < 1e-8 && rel(p.C4, d.C4) < 1e-8, 'model: Sze\'s three currents fitted to GE\'s 1 mA germanium diode (valley 0.1 mA at 350 mV, 1 mA again at 500 mV), against Newton\'s method in all three at once',
    `I0 ${p.I0.toExponential(4)} A, Jx ${(1e6 * p.Jx).toFixed(3)} µA, C4 ${p.C4.toFixed(4)} /V`);
  const V = Array.from({ length: 141 }, (_, k) => -0.1 + k * 0.005), c = cppCurve(V);
  const worst = Math.max(...V.map((v, k) => Math.abs(c[k] - d.I(v)) / (Math.abs(d.I(v)) + 1e-9)));
  check(worst < 1e-7, 'model: the curve from −100 to 600 mV against the fit', `worst ${worst.toExponential(1)} relative`);
  check(Math.abs(ex.peak[0] - 0.055) < 0.001 && Math.abs(ex.peak[1] - 1e-3) < 0.02e-3 && Math.abs(ex.valley[0] - 0.35) < 1e-4 && Math.abs(ex.valley[1] - 1e-4) < 1e-9,
    'the peak at 55 mV and 1 mA (the excess current lifts it 1.4 %), the valley at 350 mV and 0.1 mA, peak to valley 10: GE\'s typical germanium diode',
    `peak ${(1e3 * ex.peak[1]).toFixed(4)} mA at ${(1e3 * ex.peak[0]).toFixed(1)} mV, valley ${(1e3 * ex.valley[1]).toFixed(4)} mA at ${(1e3 * ex.valley[0]).toFixed(1)} mV`);
  check(Math.abs(p.gmin / ex.gmin - 1) < 1e-4 && -p.gmin > 0.006 && -p.gmin < 0.010 && (-1 / p.gmin).toFixed(0) === '152', 'the steepest negative slope, −6.6 mS (−152 Ω), inside GE\'s 0.006 to 0.010 mho for a 1 mA germanium diode',
    `${(1e3 * p.gmin).toFixed(3)} mS at ${(1e3 * p.Vm).toFixed(1)} mV; the scan ${(1e3 * ex.gmin).toFixed(3)} mS`);
  check(p.C === 5e-12, 'the diode\'s capacitance: GE\'s 5 pF');
}

// 2. the switch's thresholds and states, against the scanned load line and bisection
{
  let worst = 0;
  for (const R of [160, 200, 330, 1000, 2200, 3300]) {
    const p = cppParts(W({ load: R })), j = thresholds(d, R);
    worst = Math.max(worst, Math.abs(p.up - j.up), Math.abs(p.down - j.down));
  }
  check(worst < 2e-6, 'the switch jumps where its load line is tangent to the curve: Vs = V + R I(V) at its turning points, against a scan', `worst ${(1e6 * worst).toFixed(2)} µV`);
  const no = [100, 150].map((R) => cppParts(W({ load: R })).up), yes = cppParts(W({ load: 155 })).up;
  check(no.every((u) => u < 0) && yes > 0, 'memory needs a load steeper than the diode\'s steepest slope, R > 1/|g| = 152 Ω (GE): none at 100 or 150 Ω, some at 155 Ω');
  let ws = 0;
  for (const R of [120, 330, 1000]) {
    const vs = Array.from({ length: 41 }, (_, k) => k * 0.04), c = cppStates(W({ load: R }), vs), { up, down, va, vb } = thresholds(d, R);
    vs.forEach((v, k) => {
      const lo = up === null ? root(d, R, v, -1, 1) : v <= up ? root(d, R, v, -1, va) : NaN;
      const hi = up === null ? lo : v >= down ? root(d, R, v, vb, 1) : NaN;
      for (const [a, b] of [[c[k][0], lo], [c[k][1], hi]]) ws = Math.max(ws, Number.isNaN(a) && Number.isNaN(b) ? 0 : Math.abs(a - b) || 1);
    });
  }
  check(ws < 1e-9, 'the states on each branch, and where there are none, against bisection', `worst ${ws.toExponential(1)} V`);
}

// 3. the switch played: against the map without capacitance, which keeps its branch until it ends
{
  for (const [name, over, f, a] of [['1 kΩ, centred', {}, 55, 0.3], ['330 Ω', { load: 330, bias: 0.346 }, 110, 0.1], ['lopsided', { bias: 0.9 }, 82.4, 0.3]]) {
    const P = W(over), n = 2000, t = cppTone(P, f, a, n), js = switchMap(d, P.load, t.vs);
    const jumps = [], mism = [];
    for (let k = 0; k < n; k++) {
      const err = Math.abs(t.V[k] - js[k]);
      if (err > 2e-5) mism.push(k);
      if (k && (t.V[k] > 0.2) !== (t.V[k - 1] > 0.2)) jumps.push(k);
    }
    // a jump may come a step either side of the map's (the capacitor holds the old state a moment
    // past the threshold, and its charge carried over the jump settles in the next step): a
    // mismatch only within a step of a jump
    const stray = mism.filter((k) => !jumps.some((j) => Math.abs(j - k) <= 1));
    // (the diode's 5 pF lags the map a little as a branch steepens towards its end: 20 µV at most)
    check(stray.length === 0 && jumps.length === 4, `the switch at ${name}: the diode's voltage against the map within 20 µV, jumping where it does, twice a period`, `${jumps.length} jumps, ${stray.length} steps off`);
  }
}

// 4. the oscillator's period, against T = L ∫ di/(Vs − R i − Vlow(i)) + L ∫ di/(R i + Vhigh(i) − Vs)
{
  let worst = 0;
  const rows = [];
  for (const [R, L, b] of [[20, 0.5, 0.2], [20, 0.05, 0.2], [20, 5, 0.2], [20, 0.5, 0.1], [10, 0.5, 0.3], [50, 0.2, 0.25]]) {
    const P = OSC({ load: R, inductor: L, bias: b }), T = period(d, R, L, b);
    const f0 = 1 / T, n = 2500, span = 40 / f0, t = cppTone(P, 2 / span, 0, n);
    const f = frequency(t.V, n / span);
    worst = Math.max(worst, Math.abs(f / f0 - 1));
    rows.push(`${f0.toFixed(1)}/${f.toFixed(1)}`);
  }
  // each jump comes at a step, not where its branch ends, so the period is off by about a step
  check(worst < 0.005, 'the relaxation oscillator\'s pitch, against the period integrated along each branch (0.5 %, about a step of 2 µs at 2.3 kHz)', rows.join(', ') + ' Hz');
  // the engine at 48 kHz
  const y = run(OSC({}), new Float32Array(fs)).L.subarray(fs / 2), f = frequency(Array.from(y), fs), f0 = 1 / period(d, 20, 0.5, 0.2);
  check(Math.abs(f / f0 - 1) < 0.01, 'the engine at 48 kHz oscillates at the same pitch (1 %)', `${f.toFixed(1)} Hz, the integral ${f0.toFixed(1)} Hz`);
  // it oscillates only with the load line's rest on the falling part
  const still = (P) => pp(run(P, new Float32Array(fs)).L.subarray(fs / 2)) < 1e-3;
  check(still(OSC({ bias: 0.05 })) && still(OSC({ bias: 0.4 })) && !still(OSC({ bias: 0.1 })) && !still(OSC({ bias: 0.33 })) && still(OSC({ load: 330, bias: 0.346 })),
    'the oscillator runs only when the load line rests on the falling part (GE): not at 50 or 400 mV, nor with a 330 Ω load that makes a switch of it');
}

// 5. the hints
{
  const knob = (id) => PEDAL.groups.flatMap((g) => g.params).find((p) => p.id === id).hint;
  // Bias, Load: at 1 kΩ, up at 1071 mV, down at 412 mV; 0.1 V wide at 330 Ω, 0.66 at 1 kΩ, 1.7 at 2.2 kΩ
  const t = (R) => cppParts(W({ load: R }));
  const k1 = t(1000), k3 = t(330), k2 = t(2200);
  check((1e3 * k1.up).toFixed(0) === '1071' && (1e3 * k1.down).toFixed(0) === '412' && (k3.up - k3.down).toFixed(2) === '0.10' && (k1.up - k1.down).toFixed(2) === '0.66' && (k2.up - k2.down).toFixed(1) === '1.7',
    'the hint (Bias, Load): at 1 kΩ the switch jumps up at 1071 mV and down at 412 mV; the memory 0.1 V wide at 330 Ω, 0.66 V at 1 kΩ, 1.7 V at 2.2 kΩ',
    `${(1e3 * k1.up).toFixed(1)}, ${(1e3 * k1.down).toFixed(1)} mV; ${(k3.up - k3.down).toFixed(3)}, ${(k1.up - k1.down).toFixed(3)}, ${(k2.up - k2.down).toFixed(3)} V`);
  // Drive: at 2 V/V and 760 mV a note must peak over 0.155 V to flip it up, 0.174 V to flip it back
  check(((k1.up - 0.76) / 2).toFixed(3) === '0.155' && ((0.76 - k1.down) / 2).toFixed(3) === '0.174', 'the hint (Drive): at 2 V/V, centred at 760 mV, a note flips the switch up past 0.155 V and back past 0.174 V');
  const sq = (a) => pp(steady(W({}), 110, a)), quiet = sq(0.15), loud = sq(0.18);
  check(quiet < 0.05 && loud > 0.6, 'the hint (Drive): a 0.15 V note doesn\'t flip it (it passes a twentieth of it, on the low branch), a 0.18 V note does, and comes out a square wave', `${(1e3 * quiet).toFixed(1)} mV, ${(1e3 * loud).toFixed(0)} mV peak to peak`);
  // Level: the square is about 0.45 V from branch to branch
  const y = steady(W({}), 110, 0.3), h = [1, 2, 3, 5].map((k) => at(y, 110 * k));
  check(Math.abs(pp(y) - 0.65) < 0.02 && h[1] / h[0] < 0.03 && Math.abs(h[2] / h[0] - 0.3) < 0.02, 'the hint (Level): centred, a 0.3 V note comes out a square 0.65 V from trough to crest, its third harmonic 30 % of the note, the even ones under 3 %',
    `${(1e3 * pp(y)).toFixed(0)} mV; 2nd ${(100 * h[1] / h[0]).toFixed(1)} %, 3rd ${(100 * h[2] / h[0]).toFixed(1)} %, 5th ${(100 * h[3] / h[0]).toFixed(1)} %`);
  // Bias: off centre the square is lopsided: even harmonics
  const lop = steady(W({ bias: 0.9 }), 110, 0.3), hl = [1, 2].map((k) => at(lop, 110 * k));
  check(hl[1] / hl[0] > 0.15, 'the hint (Bias): off centre (900 mV) the square is lopsided and gains even harmonics', `2nd ${(100 * hl[1] / hl[0]).toFixed(1)} %`);
  // Bias, oscillator: 76 to 352 mV at 20 Ω; 232 Hz at 200 mV and 0.5 H, 125 Hz at 100 mV
  const lo = ex.peak[0] + 20 * ex.peak[1], hi = ex.valley[0] + 20 * ex.valley[1];
  check((1e3 * lo).toFixed(0) === '76' && (1e3 * hi).toFixed(0) === '352' && (1 / period(d, 20, 0.5, 0.2)).toFixed(0) === '232' && (1 / period(d, 20, 0.5, 0.1)).toFixed(0) === '125',
    'the hint (Bias): at 20 Ω the oscillator runs for Vs from 76 to 352 mV, at 232 Hz at 200 mV with 0.5 H and 125 Hz at 100 mV', `${(1e3 * lo).toFixed(1)}, ${(1e3 * hi).toFixed(1)} mV`);
  // Inductor: the pitch goes as 1/L: 2.32 kHz, 232 Hz, 23.2 Hz at 0.05, 0.5, 5 H
  const fl = [0.05, 0.5, 5].map((L) => 1 / period(d, 20, L, 0.2));
  check((fl[0] / 1e3).toFixed(2) === '2.32' && fl[1].toFixed(0) === '232' && fl[2].toFixed(1) === '23.2', 'the hint (Inductor): the pitch goes as 1/L, 2.32 kHz at 0.05 H, 232 Hz at 0.5 H, 23.2 Hz at 5 H', fl.map((f) => f.toFixed(2)).join(', '));
  const sw1 = pp(steady(W({ inductor: 0.05 }), 110, 0.3)), sw2 = pp(steady(W({ inductor: 5 }), 110, 0.3));
  check(sw1 === sw2, 'the hint (Inductor): the switch ignores it');
  check(PEDAL.expression === 'bias' && /expression pedal/.test(knob('bias')), 'an expression pedal moves the bias');
  // Load, oscillator: under 152 Ω, no memory: the switch's voltage runs through the falling part
  const nm = cppStates(W({ load: 120 }), [0.1, 0.2, 0.25]);
  check(nm.every(([a, b]) => a === b) && nm[1][0] > ex.peak[0] && nm[1][0] < ex.valley[0], 'the hint (Load): under 152 Ω the switch has one state at every Vs, running through the falling part', nm.map(([a]) => (1e3 * a).toFixed(0)).join(', ') + ' mV');
}

// 5b. the README's and the tour's other numbers
{
  const n3 = cppParts(W({ load: 330 })), k1 = cppParts(W({}));
  check(((n3.up - 0.346) / 2).toFixed(3) === '0.025' && ((0.346 - n3.down) / 2).toFixed(3) === '0.025', 'the README: the narrow memory, 330 Ω centred at 346 mV, flips on a note of 25 mV');
  check(((k1.up - 0.9) / 2).toFixed(3) === '0.085' && ((0.9 - k1.down) / 2).toFixed(3) === '0.244', 'the README: biased at 900 mV, up at 0.085 V and back at 0.244 V');
  const y = steady(W({ bias: 0.9 }), 110, 0.3), h2 = at(y, 220) / at(y, 110);
  check((100 * h2).toFixed(0) === '26', 'the README: lopsided, a 26 % second harmonic', `${(100 * h2).toFixed(1)} %`);
  const fb = [0.25, 0.3].map((b) => 1 / period(d, 20, 0.5, b));
  check(fb[0].toFixed(0) === '246' && fb[1].toFixed(0) === '235', 'the README: with 0.5 H, 246 Hz at 250 mV and 235 Hz at 300 mV', fb.map((f) => f.toFixed(1)).join(', '));
  const yo = run(OSC({ inductor: 0.05 }), new Float32Array(fs)).L.subarray(fs / 2), fo = frequency(Array.from(yo), fs), f0 = 1 / period(d, 20, 0.05, 0.2);
  check(Math.abs(100 * (fo / f0 - 1) - 1) < 0.25, 'the README: at 48 kHz, high quality, the oscillator runs about 1 % fast at 2.3 kHz', `${fo.toFixed(1)} Hz against ${f0.toFixed(1)} Hz, ${(100 * (fo / f0 - 1)).toFixed(2)} % fast`);
  check((d.Jx * 1e6).toFixed(1) === '67.7' && d.C4.toFixed(2) === '5.33' && (d.I0 * 1e12).toFixed(2) === '2.99' && (100 * (ex.peak[1] / 1e-3 - 1)).toFixed(1) === '1.4', 'the README: Jx 67.7 µA, C4 5.33 /V, I0 2.99 pA; the peak lifted 1.4 %');
}

// 6. the solver: on a loud bass, every preset, every quality
for (const [qu, most] of [['high', 4], ['medium', 4.5], ['low', 5.5]]) {
  let worst = 0, finite = true;
  const loud = sine(41.2, fs, fs / 2, 1.5);
  for (const v of Object.values(PEDAL.presets)) {
    const r = run(W(v), loud, qu);
    worst = Math.max(worst, r.evaluations); finite &&= r.L.every(Number.isFinite);
  }
  check(finite && worst < most, `the diode's voltage solved on a loud bass through every preset (${qu} quality: under ${most} evaluations a step)`, `${worst.toFixed(2)} a step at worst`);
}

// 7. hygiene
{
  const r = run(W({}), new Float32Array(fs));
  check(Math.max(...r.L.map(Math.abs)) < 1e-6, 'the switch: silence in, silence out (the coupling capacitor starts charged)', `${Math.max(...r.L.map(Math.abs)).toExponential(1)} V`);
  // turning the bias and the drive glides: no click past what the circuit does itself
  const e = new Effect(fs);
  e.setParams(W({}));
  const L = new Float32Array(fs), R = new Float32Array(fs);
  e.process(new Float32Array(fs / 2), L.subarray(0, fs / 2), R.subarray(0, fs / 2));
  e.setParams(W({ bias: 0.6, drive: 5 }));
  e.process(new Float32Array(fs / 2), L.subarray(fs / 2), R.subarray(fs / 2));
  e.destroy();
  const jump = Math.max(...L.subarray(fs / 2).map((v, i, a) => (i ? Math.abs(v - a[i - 1]) : 0)));
  check(jump < 1e-3, 'turning Bias and Drive while it rests doesn\'t click', `${(1e3 * jump).toFixed(3)} mV a sample at most`);
  const e2 = new Effect(fs);
  e2.setParams(W({}));
  const bad = new Float32Array(128); bad[5] = NaN;
  const L2 = new Float32Array(4096), R2 = new Float32Array(4096);
  const ok = e2.process(bad, L2.subarray(0, 128), R2.subarray(0, 128));
  e2.process(sine(100, fs, 4096, 0.3), L2, R2);
  check(!ok && L2.every(Number.isFinite) && Math.max(...L2.map(Math.abs)) > 0.1, 'a NaN in comes out as a silent block, and the pedal recovers');
  e2.destroy();
  check(L2.every(Number.isFinite) && R2.every((v, i) => v === L2[i]), 'mono out on both sides');
  const lat = ['high', 'medium', 'low'].map((qu) => run(W({}), new Float32Array(128), qu).latency);
  check(lat[2] === 0 && lat[0] > 0 && lat[0] <= 5, 'latency: the oversampling filters\' few samples, none at low quality', lat.join(', '));
  // aliasing: a 1010 Hz square at high quality keeps what folds back well under its harmonics
  const y = steady(W({}), 1010, 0.3);
  let worstAlias = 0;
  for (let f = 50; f < 20000; f += 10) { if (f % 1010 === 0 || Math.abs(f % 1010) < 15 || 1010 - (f % 1010) < 15) continue; worstAlias = Math.max(worstAlias, at(y, f)); }
  check(db(worstAlias / at(y, 1010)) < -45, 'aliasing: a 1010 Hz square at high quality, nothing between its harmonics within 45 dB of the note', `${db(worstAlias / at(y, 1010)).toFixed(1)} dB`);
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
  const n = 10 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 82.4 * i) / fs) * Math.exp(-(i % fs) / fs));
  for (const [qu, budget] of [['high', 0.08], ['medium', 0.05]]) for (const P of [W({}), OSC({})]) {
    const e = new Effect(fs);
    e.setQuality(qu);
    e.setParams(P);
    const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
    e.process(inp, L, R);
    const share = (performance.now() - t0) / 1000 / 10;
    e.destroy();
    check(share < budget, `CPU: the ${P.circuit} at ${qu} quality under ${(100 * budget).toFixed(0)} % of a core (WebAssembly)`, `${(100 * share).toFixed(1)} %`);
  }
}

done();
