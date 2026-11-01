// echo-tests.mjs — the Tape Echo against physics written here, independently of the C++
// (test/echo-circuit.mjs): the heads' losses, the tape's anhysteretic curve and its harmonics, the
// heads' delays, the motor's pitch bend and the capstan's flutter; then each hint, and hygiene.

import { check, done, CI } from './harness.mjs';
import { loadPedal } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { db, peak, sine } from '../tools/audio-util.mjs';
import { HEADS, heads, tape, harmonic, motor, flutterRate, flutterDepth } from './echo-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('echo');
const x = Effect.exports;
const fs = 48000;
// at the output knob's unity setting (its default is set for loudness: tools/loudness.mjs)
const D = { ...defaults(PEDAL.groups), level: 0 };
const W = (over) => ({ ...D, ...over });
const CLEAN = { flutter: 0, repeats: 0, dry: 0, wet: 1 };

// run P over the input; `at` changes parameters partway: [[sample, over], …]
function run(P, input, changes = []) {
  const e = new Effect(fs);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length), ms = [];
  let ok = true, cur = P;
  for (let i = 0; i < input.length; i += 480) {
    for (const [t, over] of changes) if (t >= i && t < i + 480) { cur = { ...cur, ...over }; e.setParams(cur); }
    const m = Math.min(480, input.length - i);
    ok = e.process(input.subarray(i, i + m), L.subarray(i, i + m), R.subarray(i, i + m)) && ok;
    for (const q of e.messages()) if (q.type === 1) ms.push(Array.from(q.values.slice(0, 5)));
  }
  const latency = e.latency();
  e.destroy();
  return { L, R, ms, ok, latency };
}
function response(P, F) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length + F.length).set([...v, ...F]);
  x.echo_response(s.at, F.length);
  const o = s.f64(2 * F.length, 8 * (v.length + F.length));
  return { fir: Array.from(o.subarray(0, F.length)), form: Array.from(o.subarray(F.length)) };
}
// the amplitude and phase of y near f, by least squares over [i0, i1)
function fit(y, f, i0, i1) {
  let ss = 0, cc = 0, sc = 0, ys = 0, yc = 0;
  for (let i = i0; i < i1; i++) { const s = Math.sin((2 * Math.PI * f * i) / fs), c = Math.cos((2 * Math.PI * f * i) / fs); ss += s * s; cc += c * c; sc += s * c; ys += y[i] * s; yc += y[i] * c; }
  const det = ss * cc - sc * sc;
  return Math.hypot((ys * cc - yc * sc) / det, (yc * ss - ys * sc) / det);
}
// the instantaneous frequency of y near f0: complex demodulation, a Gaussian of sd seconds, the
// phase's slope
function instFreq(y, f0, sd, i0, i1) {
  const h = Math.round(3 * sd * fs), g = Array.from({ length: 2 * h + 1 }, (_, j) => Math.exp(-0.5 * ((j - h) / (sd * fs)) ** 2));
  const ph = [];
  for (let i = i0; i < i1; i += 24) {
    let a = 0, b = 0;
    for (let j = -h; j <= h; j++) { const k = i + j, p = (2 * Math.PI * f0 * k) / fs; a += g[j + h] * y[k] * Math.cos(p); b -= g[j + h] * y[k] * Math.sin(p); }
    ph.push(Math.atan2(b, a));
  }
  const out = [];
  for (let k = 1; k < ph.length; k++) { let d = ph[k] - ph[k - 1]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; out.push(f0 + (d / (2 * Math.PI)) * (fs / 24)); }
  return out;
}

// 1. the playback heads' losses: the FIR against the closed form
{
  const F = [300, 600, 1000, 2000, 3000, 5000, 8000, 12000, 16000];
  const worst = { clean: { e: 0 }, worn: { e: 0 } };
  for (const v of [0.05, 0.095, 0.19, 0.38]) for (const [d, g] of [[4e-6, 5e-6], [15e-6, 10e-6], [1e-6, 2e-6]]) {
    const r = response(W({ speed: v, spacing: d, gap: g }), F), k = d > 5e-6 ? 'worn' : 'clean';
    F.forEach((f, i) => {
      const want = Math.abs(heads(f, v, d, g)), e = Math.abs(db(r.fir[i]) - db(want));
      if (db(want) > -30 && e > worst[k].e) worst[k] = { e, at: `${f} Hz, ${100 * v} cm/s` };
    });
  }
  check(worst.clean.e < 0.2, 'the heads\' losses: spacing e^{−kd}, thickness (1 − e^{−kδ})/kδ and gap sinc(kg/2), as a 255-tap FIR within 0.2 dB from 300 Hz, heads 1 and 4 µm from the tape', `worst ${worst.clean.e.toFixed(3)} dB, at ${worst.clean.at}, down to −30 dB, 5–38 cm/s`);
  check(worst.worn.e < 1, 'and within 1 dB 15 µm away, where the losses\' long tails outrun the FIR', `worst ${worst.worn.e.toFixed(2)} dB, at ${worst.worn.at}`);
  const r = response(W({ speed: 0.19 }), F), form = F.map((f) => heads(f, 0.19, 4e-6, 5e-6));
  check(r.form.every((v, i) => Math.abs(v - form[i]) < 1e-12), 'the C++ closed form is the one here', `${db(form[4]).toFixed(2)} dB at 3 kHz, 19 cm/s`);
}

// 2. the heads' delays: a click comes back d/v later, to the sample
{
  const c = new Float32Array(fs); c[1000] = 0.1;
  const y = run(W({ ...CLEAN, heads: '123', speed: 0.19 }), c).L;
  const times = HEADS.map((d) => {
    const want = d / 0.19;
    let best = 0, at = 0;
    for (let i = 1000 + Math.round((want - 0.01) * fs); i < 1000 + Math.round((want + 0.01) * fs); i++) if (Math.abs(y[i]) > best) { best = Math.abs(y[i]); at = i; }
    return { got: (at - 1000) / fs, want };
  });
  const worst = Math.max(...times.map((t) => Math.abs(t.got - t.want) * fs));
  check(worst <= 1, 'Playback heads: 4, 8 and 12 cm after the record head echo after 211, 421 and 632 ms at 19 cm/s, to the sample', times.map((t) => `${(1e3 * t.got).toFixed(2)}/${(1e3 * t.want).toFixed(2)} ms`).join(', '));
}

// 3. the tape's curve: small signals come back at the level they went in; louder, the third
// harmonic of the Langevin function
{
  const f = 220, n = Math.round(1.2 * fs);
  const lo = run(W({ ...CLEAN, heads: '1', speed: 0.38, spacing: 1e-6, gap: 2e-6 }), sine(f, fs, n, 0.01)).L;
  const a = fit(lo, f, Math.round(0.6 * fs), Math.round(1.1 * fs)), want = Math.abs(heads(f, 0.38, 1e-6, 2e-6));
  check(Math.abs(a / 0.01 / want - 1) < 0.01, 'a quiet note comes back at the level it went in, less the heads\' losses', `${(a / 0.01).toFixed(4)} against ${want.toFixed(4)}`);
  const A = 0.4, g = 10 ** (12 / 20);
  const hi = run(W({ ...CLEAN, heads: '1', speed: 0.38, spacing: 1e-6, gap: 2e-6, record: 12 }), sine(f, fs, n, A)).L;
  const h1 = fit(hi, f, Math.round(0.6 * fs), Math.round(1.1 * fs)) / Math.abs(heads(f, 0.38, 1e-6, 2e-6));
  const h3 = fit(hi, 3 * f, Math.round(0.6 * fs), Math.round(1.1 * fs)) / Math.abs(heads(3 * f, 0.38, 1e-6, 2e-6));
  const w1 = harmonic(A, g, 1), w3 = Math.abs(harmonic(A, g, 3));
  check(Math.abs(h1 / w1 - 1) < 0.01 && Math.abs(h3 / w3 - 1) < 0.03, 'driven 12 dB hard, the fundamental and third harmonic are the anhysteretic curve\'s (Simpson\'s rule)', `${h1.toFixed(4)}/${w1.toFixed(4)} V, ${(1e3 * h3).toFixed(2)}/${(1e3 * w3).toFixed(2)} mV`);
}

// 4. the motor bends the pitch: a note recorded at 10 cm/s, played back as the motor comes up to
// 20 cm/s, sounds at f·v(t)/(10 cm/s)
{
  const f = 150, n = Math.round(3 * fs), inp = sine(f, fs, n, 0.05);
  for (let i = Math.round(2 * fs); i < n; i++) inp[i] = 0;
  const y = run(W({ ...CLEAN, heads: '3', speed: 0.1 }), inp, [[Math.round(2 * fs), { speed: 0.2 }]]).L;
  const t = 2.62, fr = instFreq(y, 2 * f, 0.01, Math.round(t * fs) - 240, Math.round(t * fs) + 240);
  const got = fr.reduce((a, b) => a + b, 0) / fr.length, want = (f * motor(0.1, 0.2, t - 2)) / 0.1;
  check(Math.abs(got / want - 1) < 0.01, 'Tape speed: turned up with echoes on the tape, it bends their pitch as the motor follows (τ 0.25 s)', `${got.toFixed(1)} Hz at ${t} s, against f·v(t)/v = ${want.toFixed(1)} Hz`);
}

// 5. the capstan's flutter: the echo's pitch wavers at v/(2πr) by 2(e/r)|sin(d/2r)|
{
  const f = 400, n = Math.round(2 * fs), e = 20e-6;
  const y = run(W({ ...CLEAN, heads: '1', speed: 0.19, flutter: e }), sine(f, fs, n, 0.05)).L;
  const fr = instFreq(y, f, 0.004, Math.round(0.6 * fs), Math.round(1.9 * fs));
  const dev = (Math.max(...fr) - Math.min(...fr)) / 2 / f, want = flutterDepth(e, HEADS[0]);
  // its rate: the zero crossings of the deviation
  const mean = fr.reduce((a, b) => a + b, 0) / fr.length;
  let cross = 0; for (let k = 1; k < fr.length; k++) if ((fr[k - 1] - mean) * (fr[k] - mean) < 0 && fr[k] > mean) cross++;
  const rate = cross / ((fr.length * 24) / fs);
  check(Math.abs(dev / want - 1) < 0.1 && Math.abs(rate / flutterRate(0.19) - 1) < 0.1, 'Capstan eccentricity: the echo\'s pitch wavers once a turn of the capstan, by 2(e/r)|sin(d/2r)|', `±${(100 * dev).toFixed(2)} % against ±${(100 * want).toFixed(2)} %, at ${rate.toFixed(1)} Hz against ${flutterRate(0.19).toFixed(1)} Hz`);
}

// 6. repeats: each is recorded again, and loses repeats × the heads' losses
{
  const n = Math.round(1.6 * fs), burst = new Float32Array(n), f = 300, f2 = 3000;
  for (let i = 0; i < 0.06 * fs; i++) burst[i] = 0.02 * Math.sin((2 * Math.PI * f * i) / fs) * Math.sin((Math.PI * i) / (0.06 * fs)) ** 2;
  const burst2 = new Float32Array(n);
  for (let i = 0; i < 0.06 * fs; i++) burst2[i] = 0.02 * Math.sin((2 * Math.PI * f2 * i) / fs) * Math.sin((Math.PI * i) / (0.06 * fs)) ** 2;
  const P = W({ ...CLEAN, repeats: 0.7, heads: '1', speed: 0.19 }), T = HEADS[0] / 0.19;
  const lvl = (y, k) => peak(y.subarray(Math.round((k * T - 0.02) * fs), Math.round((k * T + 0.08) * fs)));
  const y = run(P, burst).L, y2 = run(P, burst2).L;
  const r1 = lvl(y, 2) / lvl(y, 1), want1 = 0.7 * Math.abs(heads(f, 0.19, 4e-6, 5e-6));
  const r2 = lvl(y2, 2) / lvl(y2, 1), want2 = 0.7 * Math.abs(heads(f2, 0.19, 4e-6, 5e-6));
  check(Math.abs(r1 / want1 - 1) < 0.03 && Math.abs(r2 / want2 - 1) < 0.05, 'Repeats: each repeat comes back repeats × the heads\' losses as loud as the last', `300 Hz ${r1.toFixed(3)}/${want1.toFixed(3)}, 3 kHz ${r2.toFixed(3)}/${want2.toFixed(3)}`);
  check(r2 < 0.7 * r1, 'and darker each time', `3 kHz keeps ${(100 * r2).toFixed(0)} % a pass, 300 Hz ${(100 * r1).toFixed(0)} %`);
  const run2 = run(W({ ...PEDAL.presets.Runaway, dry: 0, wet: 1 }), burst.map((v) => 20 * v)).L;
  const end = run2.subarray(n - fs / 2), g = 10 ** (6 / 20);
  check(peak(end) > 0.1 && peak(end) < (3 / g) * 1.3, 'past 100 % the loop grows until the tape saturates and holds it', `peak ${peak(end).toFixed(2)} V in the last half second, the tape's ceiling ${(3 / g).toFixed(2)}`);
}

// 7. the other hints
{
  const F = [3000];
  const fast = response(W({ speed: 0.38 }), F).fir[0], slow = response(W({ speed: 0.095 }), F).fir[0];
  check(fast > 2 * slow, 'Tape speed: faster is brighter, each wavelength longer on the tape', `${db(fast).toFixed(1)} dB at 3 kHz at 38 cm/s, ${db(slow).toFixed(1)} at 9.5`);
  const near = response(W({ spacing: 2e-6 }), [1000, 5000]).fir, far = response(W({ spacing: 20e-6 }), [1000, 5000]).fir;
  check(db(near[1]) - db(far[1]) > 2 * (db(near[0]) - db(far[0])) && db(far[1]) < db(near[1]) - 10, 'Head spacing: more takes the top off, the short wavelengths most', `at 20 µm: ${(db(far[0]) - db(near[0])).toFixed(1)} dB at 1 kHz, ${(db(far[1]) - db(near[1])).toFixed(1)} dB at 5 kHz`);
  // the gap's null where the wavelength is the gap: f = v/g
  const v = 0.05, gp = 10e-6, fn = v / gp, r = response(W({ speed: v, gap: gp, spacing: 0.5e-6 }), [0.7 * fn, fn, 1.3 * fn]).fir;
  check(r[1] < 0.2 * r[0] && r[1] < 0.2 * r[2], 'Head gap: the response falls to nothing where the wavelength is the gap, f = v/g', `${db(r[0]).toFixed(1)}, ${db(r[1]).toFixed(1)}, ${db(r[2]).toFixed(1)} dB around ${fn} Hz at 5 cm/s and 10 µm`);
  const thd = (rec) => { const y = run(W({ ...CLEAN, heads: '1', record: rec }), sine(200, fs, fs, 0.3)).L; return fit(y, 600, 0.5 * fs, 0.95 * fs) / fit(y, 200, 0.5 * fs, 0.95 * fs); };
  check(thd(12) > 4 * thd(0), 'Record level: harder is more compressed, and the third harmonic grows', `${(100 * thd(0)).toFixed(2)} % at 0 dB, ${(100 * thd(12)).toFixed(2)} % at +12 dB`);
  const n = sine(220, fs, 4800, 0.2), dry = run(W({ dry: 1, wet: 0 }), n).L;
  check(dry.every((v2, i) => Math.abs(v2 - n[i]) < 1e-6), 'Dry: the bass as it came in');
  const lv = run(W({ dry: 1, wet: 0, level: -6 }), n).L;
  check(lv.every((v2, i) => Math.abs(v2 - 0.501187 * n[i]) < 1e-6), 'Level: gain after the mix, in decibels');
  const ms = run(W({}), sine(100, fs, fs / 2, 0.1)).ms.at(-1);
  check(Math.abs(ms[0] / 0.19 - 1) < 0.01 && Math.abs(ms[1] - 0.04 / 0.19) < 1e-6, 'the page hears the tape\'s speed and the heads\' delays', `${(100 * ms[0]).toFixed(2)} cm/s, ${(1e3 * ms[1]).toFixed(1)} ms`);
}

// 7b. the heads moved along the tape, and the page's picture of it
{
  // a click comes back d/v after it went in, wherever the head is put
  const echoAt = (P, want) => {
    const c = new Float32Array(Math.round((want + 0.05) * fs) + 2000); c[1000] = 0.1;
    const y = run(W({ ...CLEAN, ...P }), c).L;
    let best = 0, at = 0;
    for (let i = 1000 + Math.round((want - 0.01) * fs); i < Math.min(y.length, 1000 + Math.round((want + 0.01) * fs)); i++) if (Math.abs(y[i]) > best) { best = Math.abs(y[i]); at = i; }
    return (at - 1000) / fs;
  };
  const near = echoAt({ heads: '1', head1: 0.04, speed: 0.19 }, 0.04 / 0.19), far = echoAt({ heads: '1', head1: 0.08, speed: 0.19 }, 0.08 / 0.19);
  check(Math.abs(far / near - 2) < 2 / (near * fs), 'Head 1: its echo comes after its distance over the tape\'s speed: twice as far, twice as late', `${(1e3 * near).toFixed(2)} ms at 4 cm, ${(1e3 * far).toFixed(2)} ms at 8 cm`);
  const longest = echoAt({ heads: '3', head3: 0.2, speed: 0.05 }, 4);
  check(Math.abs(longest - 4) * fs <= 1, 'Head 3: 20 cm after the record head, at 5 cm/s, a 4 s echo', `${longest.toFixed(5)} s`);
  // slid ahead of a click already on the tape: the head plays it when the tape brings it there
  const c = new Float32Array(fs); c[1000] = 0.1;
  const y = run(W({ ...CLEAN, heads: '2', head2: 0.04, speed: 0.19 }), c, [[14400, { head2: 0.12 }]]).L;
  let at = 0, best = 0; for (let i = 14400; i < y.length; i++) if (Math.abs(y[i]) > best) { best = Math.abs(y[i]); at = i; }
  check(Math.abs((at - 1000) / fs - 0.12 / 0.19) * fs <= 1, 'Head 2: slid along the tape ahead of a click, it plays the click when the tape brings it there', `${(1e3 * (at - 1000) / fs).toFixed(2)} ms, 12 cm at 19 cm/s`);
  // the record head's magnetisation, as the page draws the tape: 24 means of the samples between
  // messages, each message 20 ms of tape further on; a small, slow sine is on the tape as it went in
  const e = new Effect(fs); e.setParams(W({ ...CLEAN, speed: 0.19 }));
  const inp = sine(41.2, fs, fs, 0.05), L = new Float32Array(480), R = new Float32Array(480), tape = [];
  for (let i = 0; i < inp.length; i += 480) { e.process(inp.subarray(i, i + 480), L, R); for (const q of e.messages()) if (q.type === 2) tape.push([q.values[0], q.values[1], Array.from(q.values.slice(2))]); }
  e.destroy();
  const steps = tape.slice(1).map((q, i) => q[0] - tape[i][0]);
  check(tape.length >= 45 && tape.every((q) => q[1] === 960 && q[2].length === 24) && steps.every((d) => Math.abs(d / (0.19 * 0.02) - 1) < 0.01), 'The tape loop: the page hears the record head\'s magnetisation, 24 values each 20 ms, each 3.8 mm of tape after the last', `${tape.length} messages, steps ${(1e3 * Math.min(...steps)).toFixed(2)} to ${(1e3 * Math.max(...steps)).toFixed(2)} mm`);
  const late = tape.slice(25).flatMap((q) => q[2]), amp = Math.max(...late.map(Math.abs)), want = (0.05 * 41.2) / Math.hypot(41.2, 20);
  check(Math.abs(amp / want - 1) < 0.02, 'and a quiet 41 Hz sine is on the tape as it went in, through the record amplifier\'s 20 Hz coupling (the tape\'s curve is straight there)', `${(1e3 * amp).toFixed(2)} mV peak, ${(1e3 * want).toFixed(2)} mV for 50 mV through a 20 Hz high-pass`);
}

// 8. hygiene
{
  const r = run(D, sine(55, fs, fs, 0.5));
  check(r.ok && r.L.every(Number.isFinite) && peak(r.L) < 3, 'a loud low note: finite and bounded', `peak ${peak(r.L).toFixed(2)} V`);
  check(r.latency === 0 && r.R.every((v, i) => v === r.L[i]), 'no latency (the FIR\'s is taken out of the tape), mono out on both sides');
  const e = new Effect(fs); e.setParams(D);
  const bad = new Float32Array(128); bad[5] = NaN;
  const L = new Float32Array(4096), R = new Float32Array(4096);
  const ok = e.process(bad, L.subarray(0, 128), R.subarray(0, 128));
  e.process(sine(100, fs, 4096, 0.1), L, R);
  check(!ok && L.every(Number.isFinite) && peak(L) > 0.01, 'a NaN in comes out as a silent block, and the pedal recovers');
  e.destroy();
  const ids = new Map(PEDAL.groups.flatMap((g) => g.params).map((p) => [p.id, p]));
  const badP = Object.entries(PEDAL.presets).flatMap(([nm, v]) => Object.entries(v).filter(([id, val]) => !ids.has(id) || (typeof val === 'number' && (val < ids.get(id).min || val > ids.get(id).max))).map(([id]) => `${nm}: ${id}`));
  check(!badP.length, 'every preset sets real parameters inside their ranges', badP.join(', '));
}

// 9. CPU
if (!CI) {
  const quiet = (pre) => {
    const e = new Effect(fs); e.setParams(D);
    const L = new Float32Array(fs), R = new Float32Array(fs);
    if (pre) { e.process(sine(41.2, fs, fs, 0.3), L, R); for (let k = 0; k < 40; k++) e.process(new Float32Array(fs), L, R); }
    const t0 = performance.now(); for (let k = 0; k < 4; k++) e.process(new Float32Array(fs), L, R); const ms = performance.now() - t0;
    e.destroy(); return ms / 4;
  };
  const rest = Math.min(quiet(false), quiet(false)), after = Math.min(quiet(true), quiet(true));
  check(after < 1.5 * rest + 1, 'CPU: silence after the repeats die costs what silence from rest does (no denormals)', `${after.toFixed(1)} ms a second after a note, ${rest.toFixed(1)} ms from rest`);
  const n = 5 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 55 * i) / fs) * Math.exp(-(i % fs) / (0.3 * fs)));
  const e = new Effect(fs); e.setParams(PEDAL.presets['Three heads'] ? W(PEDAL.presets['Three heads']) : D);
  const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
  e.process(inp, L, R);
  const share = (performance.now() - t0) / 1000 / 5;
  e.destroy();
  check(share < 0.05, 'CPU: under 5 % of a core (WebAssembly)', `${(100 * share).toFixed(2)} %`);
}

done();
