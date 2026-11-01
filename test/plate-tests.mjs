// plate-tests.mjs — the Plate Reverb against physics written here, independently of the C++
// (test/plate-circuit.mjs): the plate's modes on the lattice and by Weyl's law, its response as
// the sum of its modes at the full rate in double precision, its decay against the loss formulas,
// its bending waves' arrival at the pickups against their group velocity, each hint, and hygiene.

import { check, done, CI } from './harness.mjs';
import { loadPedal } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { peak, sine } from '../tools/audio-util.mjs';
import { plateModes, plateBank, GX, GY, LX as PLX, LY as PLY } from '../plate/src/plate-motion.js';
import { kappa, fCoincidence, lattice, weyl, groupVelocity, thermoelastic, radiation, steel, t60, modalResponse, DRIVE, PICKS } from './plate-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('plate');
const x = Effect.exports;
const fs = 48000;
// at the output knob's unity setting (its default is set for loudness: tools/loudness.mjs)
const D = { ...defaults(PEDAL.groups), level: 0 };
const W = (over) => ({ ...D, ...over });
const wet = (over) => W({ dry: 0, reverb: 1, ...over });

function run(P, input) {
  const e = new Effect(fs);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length);
  let ok = true;
  for (let at = 0; at < input.length; at += 4800) {
    const m = Math.min(4800, input.length - at);
    ok = e.process(input.subarray(at, at + m), L.subarray(at, at + m), R.subarray(at, at + m)) && ok;
  }
  const latency = e.latency();
  e.destroy();
  return { L, R, ok, latency };
}
function info(P) {
  const v = Effect.native(P), s = scratch(x);
  s.f64(v.length).set(v);
  x.plate_info(s.at);
  const [modes, low, delay, top, gain] = s.f64(5);
  return { modes, low, delay, top, gain };
}
function modes(P) {
  const v = Effect.native(P), list = [], CH = 2000;
  let count = 0;
  for (let from = 0; from === 0 || from < count; from += CH) {
    const s = scratch(x);
    s.f64(v.length).set(v);
    count = x.plate_modes(s.at, from, CH);
    const o = s.f64(3 * CH);
    for (let i = 0; i < Math.min(CH, count - from); i++) list.push({ m: o[3 * i], n: o[3 * i + 1], f: o[3 * i + 2] });
  }
  return { count, list };
}
function decayRates(P, freqs) {
  const v = Effect.native(P), n = freqs.length, s = scratch(x);
  s.f64(v.length + 5 * n).set([...v, ...freqs]);
  x.plate_decay(s.at, n);
  const o = s.f64(4 * n, 8 * (v.length + n));
  return freqs.map((f, i) => ({ f, th: o[i], rad: o[n + i], damper: o[2 * n + i], t60: o[3 * n + i] }));
}
const burst = (f, sd, at, secs, amp = 0.1) => Float32Array.from({ length: Math.round(secs * fs) }, (_, i) => { const t = i / fs - at; return amp * Math.exp(-0.5 * (t / sd) ** 2) * Math.sin(2 * Math.PI * f * t); });
// y's envelope near f: demodulated, then smoothed by four one-pole lowpasses of time constant tau
function envelope(y, f, tau) {
  const a = Math.exp(-1 / (tau * fs)), re = new Float64Array(y.length), im = new Float64Array(y.length);
  for (let i = 0; i < y.length; i++) { const ph = (2 * Math.PI * f * i) / fs; re[i] = y[i] * Math.cos(ph); im[i] = -y[i] * Math.sin(ph); }
  for (const z of [re, im]) for (let pass = 0; pass < 4; pass++) { let s = 0; for (let i = 0; i < z.length; i++) { s = a * s + (1 - a) * z[i]; z[i] = s; } }
  return Float64Array.from(re, (r, i) => Math.hypot(r, im[i]));
}
const rms = (a, from = 0, to = a.length) => { let s = 0; for (let i = from; i < to; i++) s += a[i] * a[i]; return Math.sqrt(s / (to - from)); };

// 1. the plate
{
  check(Math.abs(kappa - 0.7637) < 1e-4, 'the plate: κ = h √(E / 12ρ(1 − ν²)) for 0.5 mm steel', `${kappa.toFixed(4)} m²/s`);
  check(Math.abs(fCoincidence / 1000 - 24.5) < 0.1, 'its coincidence frequency, c² / 2πκ, is above hearing: it radiates little', `${(fCoincidence / 1000).toFixed(1)} kHz`);
  const mine = lattice(20, 5000), got = modes(D);
  const worst = got.list.reduce((w, m) => { const f = (kappa * ((m.m * Math.PI / 2) ** 2 + (m.n * Math.PI) ** 2)) / (2 * Math.PI); return Math.max(w, Math.abs(m.f / f - 1)); }, 0);
  const keys = new Set(mine.map((m) => m.m + 1000 * m.n));
  check(got.count === mine.length && got.list.every((m) => keys.has(m.m + 1000 * m.n)) && worst < 1e-12, 'the engine plays every mode from 20 Hz to the top, each at ω = κ[(mπ/Lx)² + (nπ/Ly)²]', `${got.count} modes, against ${mine.length} on the lattice; worst frequency ${worst.toExponential(1)}`);
  const w = weyl(5000) - weyl(20);
  check(Math.abs(got.count / w - 1) < 0.005, 'and as many as Weyl\'s law with its edge term counts, S k²/4π − (Lx + Ly) k/2π', `${got.count} against ${w.toFixed(0)}`);
  check(Math.abs((2 * 1) / (2 * kappa) - 1.31) < 0.01, 'a mode every 2κ/S hertz on average: 1.31 modes in every hertz', `${(1 / kappa).toFixed(3)} per Hz`);
}

// 2. the engine against the modes, summed at the full rate in double precision
{
  for (const [f, sd, top, what] of [[1000, 2e-3, 5000, 'a 1 kHz burst (the modes at fs/4)'], [4400, 0.6e-3, 6000, 'a 4.4 kHz burst across the split at 4.32 kHz (both rates together)']]) {
    const P = wet({ top }), inf = info(P), inp = burst(f, sd, 0.01, 0.25);
    const eng = run(P, inp), ref = modalResponse(inp, fs, { decay: P.decay, top: inf.top, gain: inf.gain });
    let err = 0, sig = 0;
    for (let i = 0; i + inf.delay < inp.length; i++) for (const c of ['L', 'R']) { const d = eng[c][i + inf.delay] - ref[c][i]; err += d * d; sig += ref[c][i] ** 2; }
    check(Math.sqrt(err / sig) < 0.01, `the engine's two rates and their filters against every mode at 48 kHz: ${what}`, `${(100 * Math.sqrt(err / sig)).toFixed(2)} % RMS difference, with the filters' delay of ${inf.delay} samples (${(1000 * inf.delay / fs).toFixed(2)} ms) taken out`);
  }
}

// 3. the decay
{
  const P = wet({ decay: 3 }), inf = info(P), click = new Float32Array(4 * fs); click[0] = 1;
  const y = run(P, click).L;
  const measured = (f) => {
    const env = envelope(y, f, 4e-3);
    // Schroeder's backward integral of the band's energy, fitted from −5 to −35 dB
    const edc = new Float64Array(env.length); let s = 0;
    for (let i = env.length - 1; i >= 0; i--) { s += env[i] * env[i]; edc[i] = s; }
    const dB = (i) => 10 * Math.log10(edc[i] / edc[0]);
    let i0 = 0; while (dB(i0) > -5) i0++;
    let i1 = i0; while (i1 < edc.length - 1 && dB(i1) > -35) i1++;
    let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = i0; i <= i1; i += 48) { const t = i / fs, v = dB(i); n++; sx += t; sy += v; sxx += t * t; sxy += t * v; }
    return -60 / ((n * sxy - sx * sy) / (n * sxx - sx * sx));
  };
  for (const f of [100, 1000, 4000]) {
    const got = measured(f), want = t60(f, 3);
    check(Math.abs(got / want - 1) < 0.1, `the tail near ${f} Hz dies at the steel's thermoelastic and radiation losses and the damper's`, `T₆₀ ${got.toFixed(2)} s against ${want.toFixed(2)} s`);
  }
  const r = decayRates(P, [100, 1000, 4000]);
  check(r.every((q) => Math.abs(q.th / thermoelastic(q.f) - 1) < 1e-12 && Math.abs(q.rad / radiation(q.f) - 1) < 1e-12 && Math.abs(q.t60 / t60(q.f, 3) - 1) < 1e-12), 'the engine\'s losses are the formulas as written here', r.map((q) => `${q.f} Hz: ${q.th.toFixed(3)} + ${q.rad.toFixed(3)} + ${q.damper.toFixed(3)} /s`).join('; '));
  void inf;
}

// 4. the waves: the highs reach the pickups first
{
  const arrival = (f, sd, pick, top = 8000) => {
    const P = wet({ top }), inf = info(P), at = 0.01, inp = burst(f, sd, at, 0.05);
    const y = run(P, inp)[pick ? 'R' : 'L'], env = envelope(y, f, sd / 4);
    const big = Math.max(...env);
    // the first peak of the envelope that is a quarter of its largest
    let i = 0; while (env[i] < 0.25 * big) i++;
    while (env[i + 1] > env[i]) i++;
    return (i - inf.delay) / fs - at - 4 * (sd / 4); // the smoothing's own delay, four lags of sd/4
  };
  const dist = (p) => Math.hypot(p[0] - DRIVE[0], p[1] - DRIVE[1]);
  for (const [f, sd, pick] of [[4000, 0.25e-3, 0], [4000, 0.25e-3, 1], [1000, 1e-3, 0]]) {
    const got = arrival(f, sd, pick), want = dist(PICKS[pick]) / groupVelocity(f);
    check(Math.abs(got / want - 1) < 0.15, `a ${f} Hz burst reaches the ${pick ? 'right' : 'left'} pickup, ${dist(PICKS[pick]).toFixed(2)} m away, at the bending waves' group velocity 2√(κω), ${groupVelocity(f).toFixed(0)} m/s`, `${(1000 * got).toFixed(2)} ms against ${(1000 * want).toFixed(2)} ms`);
  }
}

// 5. the hints
{
  const steelAlone = [1000, 2000, 4000, 5000].map((f) => LN(f));
  function LN(f) { return (3 * Math.log(10)) / steel(f); }
  check(steelAlone.every((t) => t > 2.1 && t < 2.4), 'Decay: the steel alone lets a note above 1 kHz ring only 2.1 to 2.4 s', steelAlone.map((t) => `${t.toFixed(2)} s`).join(', '));
  const dark = (dec) => t60(4000, dec) / t60(100, dec);
  check(dark(8) < 0.3 && dark(1) > 0.7, 'so long settings ring darker at the top than at the bottom', `4 kHz against 100 Hz: ${dark(8).toFixed(2)} at 8 s, ${dark(1).toFixed(2)} at 1 s`);
  const tail = (P) => { const c = new Float32Array(3 * fs); c[0] = 1; const y = run(P, c).L; let e = 0; const tot = y.reduce((a, b) => a + b * b, 0); for (let i = y.length - 1; i >= 0; i--) { e += y[i] * y[i]; if (e > 1e-6 * tot) return i / fs; } return 0; };
  const short = tail(wet({ decay: 0.8 })), long = tail(wet({ decay: 3 }));
  check(long > 2 * short, 'Decay: the damper moved away, a longer reverb', `60 dB of the energy gone by ${short.toFixed(2)} s at 0.8 s, ${long.toFixed(2)} s at 3 s`);
  const n = sine(220, fs, 4800, 0.2), dry = run(W({ dry: 1, reverb: 0 }), n).L;
  check(dry.every((v, i) => Math.abs(v - n[i]) < 1e-6), 'Dry: the bass as it came in');
  const lv = run(W({ dry: 1, reverb: 0, level: -6 }), n).L;
  check(lv.every((v, i) => Math.abs(v - 0.501187 * n[i]) < 1e-6), 'Level: gain after the mix, in decibels');
  const half = run(W({ dry: 0, reverb: 0.5 }), n).L, full = run(W({ dry: 0, reverb: 1 }), n).L;
  check(half.every((v, i) => Math.abs(v - 0.5 * full[i]) < 1e-6) && peak(full) > 0.01, 'Reverb: how much of the pickups is mixed in');
  // Modes up to: about 6400 at 5 kHz; nothing above; brighter higher
  const m5 = info(D).modes;
  check(Math.abs(m5 / 6400 - 1) < 0.02, 'Modes up to: about 1.3 modes in every hertz, so about 6400 to 5 kHz', `${m5}`);
  const noise = Float32Array.from({ length: fs }, (_, i) => 0.1 * Math.sin(i * 12.9898 + Math.sin(i * 78.233) * 43758.5453));
  const band = (y, f, w) => rms(envelope(y, f, 1 / (2 * Math.PI * w)), fs / 4);
  const y25 = run(wet({ top: 2500 }), noise).L, y8 = run(wet({ top: 8000 }), noise).L;
  check(band(y25, 4000, 200) < 0.01 * band(y25, 1500, 200), 'above it the plate is silent here', `near 4 kHz ${(20 * Math.log10(band(y25, 4000, 200) / band(y25, 1500, 200))).toFixed(0)} dB against 1.5 kHz, playing to 2.5 kHz`);
  check(band(y8, 4000, 200) > 30 * band(y25, 4000, 200), 'higher is brighter', `near 4 kHz, ${(20 * Math.log10(band(y8, 4000, 200) / band(y25, 4000, 200))).toFixed(0)} dB more playing to 8 kHz than to 2.5 kHz`);
  // the transducers: white noise in, its power out at the 3 s damper
  const white = Float32Array.from({ length: 4 * fs }, (_, i) => { const u = Math.sin(i * 12.9898) * 43758.5453; return 0.1 * 2 * (u - Math.floor(u) - 0.5) * Math.sqrt(3); });
  const yw = run(wet({ decay: 3, top: 8000 }), white);
  const ratio = Math.hypot(rms(yw.L, 2 * fs), rms(yw.R, 2 * fs)) / Math.SQRT2 / rms(white, 2 * fs);
  check(Math.abs(ratio - 1) < 0.15, 'the pickups\' gain: white noise in comes out of them at about its own level, with the damper at 3 s (to 8 kHz)', `${(20 * Math.log10(ratio)).toFixed(2)} dB`);
}

// 5b. where the driver and the pickups sit: each a parameter
{
  // the engine with all three moved, against the modes summed here with them there
  const at = { driveX: 1.31, driveY: 0.27, leftX: 0.55, leftY: 0.8, rightX: 1.9, rightY: 0.12 };
  const P = wet({ top: 3000, ...at }), inf = info(P), inp = burst(1000, 2e-3, 0.01, 0.2);
  const eng = run(P, inp), ref = modalResponse(inp, fs, { decay: P.decay, top: inf.top, gain: inf.gain, drive: [at.driveX, at.driveY], picks: [[at.leftX, at.leftY], [at.rightX, at.rightY]] });
  let err = 0, sig = 0;
  for (let i = 0; i + inf.delay < inp.length; i++) for (const c of ['L', 'R']) { const d = eng[c][i + inf.delay] - ref[c][i]; err += d * d; sig += ref[c][i] ** 2; }
  check(Math.sqrt(err / sig) < 0.01, 'the driver and the pickups moved: the engine against every mode summed here with them there', `${(100 * Math.sqrt(err / sig)).toFixed(2)} % RMS difference`);
  check(info(W(at)).gain === info(D).gain, 'moving them leaves the transducers\' gain alone (a pickup on nodal lines comes out quieter, as on the plate)', `${info(D).gain.toExponential(4)}`);
  // the shapes at the driver, as the engine has them
  const shapes = (Q) => {
    const v = Effect.native(Q), s = scratch(x), out = [];
    for (let from = 0; ; from += 2000) {
      s.f64(v.length).set(v);
      const count = x.plate_shapes(s.at, from, 2000), o = s.f64(6000);
      for (let i = 0; i < Math.min(2000, count - from); i++) out.push([o[3 * i], o[3 * i + 1], o[3 * i + 2]]);
      if (from + 2000 >= count) return out;
    }
  };
  const ms = modes(D);
  const silent = (Q) => shapes(Q).map(([d]) => Math.abs(d) < 1e-9);
  const across = silent(W({ driveX: 1 })), up = silent(W({ driveY: 0.5 }));
  const evenM = ms.list.map((q) => q.m % 2 === 0), evenN = ms.list.map((q) => q.n % 2 === 0);
  const share = (a) => a.filter(Boolean).length / a.length;
  check(across.every((s, i) => s === evenM[i]) && Math.abs(share(across) - 0.5) < 0.02, 'Driver, across: in the middle, 1 m across, every mode with an even number of half-waves across falls silent, half of them', `${(100 * share(across)).toFixed(1)} % of ${across.length} modes`);
  check(evenN.every((e, i) => !e || up[i]) && Math.abs(share(evenN) - 0.5) < 0.03, 'Driver, up: half way up, 0.5 m, every mode with an even number of half-waves up falls silent, half of them', `${(100 * share(evenN)).toFixed(1)} % of them even up; ${(100 * share(up)).toFixed(1)} % silent with the driver 0.8 m across, which silences every fifth across too`);
  const same = run(wet({ leftX: 1.3, leftY: 0.6, rightX: 1.3, rightY: 0.6 }), inp);
  check(same.L.every((v, i) => v === same.R[i]) && peak(same.L) > 1e-3, 'Left and right pickup: put them in the same place and the two channels are the same');
  const node = shapes(W({ leftX: 1 })).map(([, l]) => Math.abs(l) < 1e-9);
  check(evenM.every((e, i) => !e || node[i]), 'a pickup hears nothing of a mode with a nodal line through it (the left pickup at 1 m across: the even ones across)');
}

// 5c. the page's slow motion (plate/src/plate-motion.js): the engine's modes played at the full
// rate, against the modes summed here; and its picture of the plate, against the shapes directly
{
  const P = wet({ top: 3000, driveX: 0.6, leftX: 0.3, rightY: 0.7 }), inf = info(P), inp = burst(800, 2e-3, 0.01, 0.12);
  const plate = plateModes(x, Effect, P), bank = plateBank(plate, fs, P);
  const ref = modalResponse(inp, fs, { decay: P.decay, top: inf.top, gain: inf.gain, drive: [P.driveX, P.driveY], picks: [[P.leftX, P.leftY], [P.rightX, P.rightY]] });
  let err = 0, sig = 0;
  for (let i = 0; i < inp.length; i++) { bank.bank.seek(i + 1, inp); const [l, r] = bank.pickups(); err += (l - ref.L[i]) ** 2 + (r - ref.R[i]) ** 2; sig += ref.L[i] ** 2 + ref.R[i] ** 2; }
  check(plate.modes.length === inf.modes && Math.sqrt(err / sig) < 1e-6, 'The plate (slow motion): the engine\'s own modes, played here, hear at the pickups what every mode summed independently does', `${plate.modes.length} modes, ${Math.sqrt(err / sig).toExponential(1)} RMS difference`);
  const field = bank.field(new Float64Array(GX * GY));
  let worst = 0, big = 0;
  for (const [i, j] of [[10, 10], [95, 47], [150, 80], [191, 3]]) {
    const px = ((i + 0.5) / GX) * PLX, py = ((j + 0.5) / GY) * PLY;
    let want = 0;
    plate.modes.forEach((q, k) => { want += (bank.bank.zr[k] - (q.alpha / Math.sqrt((2 * Math.PI * q.f) ** 2 - q.alpha ** 2)) * bank.bank.zi[k]) * Math.sin((q.m * Math.PI * px) / PLX) * Math.sin((q.n * Math.PI * py) / PLY); });
    worst = Math.max(worst, Math.abs(field[j * GX + i] - want)); big = Math.max(big, Math.abs(want));
  }
  check(worst < 1e-9 * Math.max(big, 1e-30) + 1e-18, 'and its picture is the plate\'s velocity, each mode\'s shape times its motion, summed', `worst ${worst.toExponential(1)} against ${big.toExponential(1)}`);
}

// 6. hygiene
{
  const r = run(D, sine(55, fs, fs, 0.5));
  check(r.ok && r.L.every(Number.isFinite) && peak(r.L) < 3, 'a loud low note: finite and bounded', `peak ${peak(r.L).toFixed(2)} V`);
  let differ = 0; for (let i = 0; i < r.L.length; i++) differ = Math.max(differ, Math.abs(r.L[i] - r.R[i]));
  check(r.latency === 0 && differ > 0.01, 'no latency, and two pickups: left and right differ', `largest difference ${differ.toFixed(3)} V`);
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
  // odd block sizes: the two rates carry their phase from block to block
  const inp = burst(1000, 2e-3, 0.01, 0.1), whole = run(wet({}), inp).L;
  const e2 = new Effect(fs); e2.setParams(wet({}));
  const Lb = new Float32Array(inp.length), Rb = new Float32Array(inp.length);
  for (let at = 0, k = 0; at < inp.length; k++) { const m = Math.min([1, 7, 128, 33, 2, 99][k % 6], inp.length - at); e2.process(inp.subarray(at, at + m), Lb.subarray(at, at + m), Rb.subarray(at, at + m)); at += m; }
  e2.destroy();
  check(Lb.every((v, i) => Math.abs(v - whole[i]) < 1e-6), 'blocks of any length play the same');
}

// 7. CPU
if (!CI) {
  const quiet = (pre) => {
    const e = new Effect(fs); e.setParams(D);
    const L = new Float32Array(fs), R = new Float32Array(fs);
    if (pre) { e.process(sine(41.2, fs, fs, 0.3), L, R); for (let k = 0; k < 40; k++) e.process(new Float32Array(fs), L, R); }
    const t0 = performance.now(); for (let k = 0; k < 4; k++) e.process(new Float32Array(fs), L, R); const ms = performance.now() - t0;
    e.destroy(); return ms / 4;
  };
  const rest = Math.min(quiet(false), quiet(false)), after = Math.min(quiet(true), quiet(true));
  check(after < 2 * rest + 1, 'CPU: once the tail has died, silence costs what silence from rest does', `${after.toFixed(1)} ms a second after a note, ${rest.toFixed(1)} ms from rest`);
  const share = (P) => {
    const n = 3 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 55 * i) / fs) * Math.exp(-(i % fs) / (0.3 * fs)));
    const e = new Effect(fs); e.setParams(P);
    const L = new Float32Array(128), R = new Float32Array(128), t0 = performance.now();
    for (let at = 0; at < n; at += 128) e.process(inp.subarray(at, at + 128), L, R);
    const s = (performance.now() - t0) / 1000 / 3;
    e.destroy(); return s;
  };
  const s5 = share(D), s25 = share(W({ top: 2500 }));
  check(s5 < 0.15, `CPU: ${info(D).modes} modes to 5 kHz, under 15 % of a core (WebAssembly)`, `${(100 * s5).toFixed(1)} %`);
  check(s25 < 0.6 * s5, 'Modes up to: lower costs less of the computer', `${(100 * s25).toFixed(1)} % to 2.5 kHz`);
}

done();
