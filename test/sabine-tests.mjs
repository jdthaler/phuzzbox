// sabine-tests.mjs — Sabine's Room against the room worked out independently of the C++
// (test/sabine-circuit.mjs): the absorption areas and Sabine's and Eyring's reverberation times; the
// images, found again by mirroring rather than by the lattice, and their count against the volume
// they fill; the engine's taps against the images; each band's late sound, its decay against
// Eyring's time and its power against the diffuse field's; then the whole engine: the bass alone
// before the first reflection, each octave's decay measured from the impulse response, and the
// room's loudness against the direct sound's at the critical distance; and each knob's hint.

import { check, done, CI } from './harness.mjs';
import { loadPedal } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { db, sine } from '../tools/audio-util.mjs';
import { CENTRES, C0, room, A, sabine, eyring, critical, images, diffuse } from './sabine-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('sabine');
const x = Effect.exports;
const fs = 48000;
const D = { ...defaults(PEDAL.groups), level: 0 };
const W = (over) => ({ ...D, ...over });
const knob = (id) => PEDAL.groups.flatMap((g) => g.params).find((p) => p.id === id).hint;
const ROOMS = [{}, { audience: 100 }, { walls: 'drapes', floor: 'carpet' }, { length: 6, width: 4, height: 3, distance: 2.5 }, { walls: 'concrete', floor: 'concrete', length: 50, width: 30, height: 18, distance: 20 }];

// the C++ model through its exports
function call(fn, P, args = [], count = 0) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length).set(v);
  x[fn](s.at, ...args);
  return { n: v.length, read: (k, at = 0) => Array.from(s.f64(k, 8 * at)) };
}
function cppParts(P) {
  const r = call('sabine_parts', P).read(28);
  return { V: r[0], S: r[1], d: r[2], Re: r[3], A: CENTRES.map((_, b) => r[4 + 4 * b]), sabine: CENTRES.map((_, b) => r[5 + 4 * b]), eyring: CENTRES.map((_, b) => r[6 + 4 * b]), m: CENTRES.map((_, b) => r[7 + 4 * b]) };
}
const cppEarly = (P) => { const r = call('sabine_early', P).read(65 * 8); return Array.from({ length: 65 }, (_, i) => [r[8 * i], r[8 * i + 1], r.slice(8 * i + 2, 8 * i + 8)]); };
function cppTaps(P) {
  const c = call('sabine_taps', P, [fs]), n = c.read(1, c.n)[0], r = c.read(1 + 7 * n + 7, c.n);
  return { taps: Array.from({ length: n }, (_, k) => [r[1 + 7 * k], r.slice(2 + 7 * k, 8 + 7 * k)]), pre: r[1 + 7 * n], kappa: r.slice(2 + 7 * n, 8 + 7 * n) };
}
const cppLate = (P, band, blocks, k) => { const c = call('sabine_late', P, [fs, band, blocks, k]); return c.read(blocks, c.n); };

function run(P, input, rate = fs, block = 128) {
  const e = new Effect(rate);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length);
  let ok = true;
  for (let i = 0; i < input.length; i += block) { const j = Math.min(input.length, i + block); ok = e.process(input.subarray(i, j), L.subarray(i, j), R.subarray(i, j)) && ok; }
  e.destroy();
  return { L, R, ok };
}

// a band of a signal by FFT, zero phase: flat within `flat` octaves of fc, a raised cosine to zero at `edge`
function fft(re, im, inv) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = ((inv ? 2 : -2) * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a), h = len / 2;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < h; k++) {
        const ur = re[i + k], ui = im[i + k], vr = re[i + k + h] * cr - im[i + k + h] * ci, vi = re[i + k + h] * ci + im[i + k + h] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + h] = ur - vr; im[i + k + h] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
function band(y, fc, flat, edge) {
  let N = 1;
  while (N < 2 * y.length) N <<= 1;
  const re = new Float64Array(N), im = new Float64Array(N);
  re.set(y);
  fft(re, im, false);
  for (let k = 0; k < N; k++) {
    const o = Math.abs(Math.log2(Math.max((Math.min(k, N - k) * fs) / N, 1e-9) / fc));
    const g = o < flat ? 1 : o > edge ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * (o - flat)) / (edge - flat));
    re[k] *= g; im[k] *= g;
  }
  fft(re, im, true);
  return re.subarray(0, y.length);
}
// T30 by Schroeder's backward integration, from −5 to −35 dB, doubled
function t30(y) {
  const n = y.length, sch = new Float64Array(n);
  let acc = 0;
  for (let i = n - 1; i >= 0; i--) { acc += y[i] * y[i]; sch[i] = acc; }
  let i5 = 0, i35 = 0;
  for (let i = 0; i < n; i++) { const v = 10 * Math.log10(sch[i] / sch[0]); if (!i5 && v < -5) i5 = i; if (v < -35) { i35 = i; break; } }
  return i35 ? (2 * (i35 - i5)) / fs : NaN;
}
function impulse(P, seconds) {
  const n = Math.round(seconds * fs), imp = new Float32Array(n);
  imp[0] = 1;
  return run(P, imp).L;
}
const rel = (a, b) => Math.abs(a / b - 1);

// 1. the absorption areas and reverberation times
{
  let worst = 0;
  for (const o of ROOMS) {
    const P = W(o), R = room(P), c = cppParts(P);
    worst = Math.max(worst, rel(c.V, R.V), rel(c.S, R.S), rel(c.d, R.d));
    CENTRES.forEach((_, b) => { worst = Math.max(worst, rel(c.A[b], A(R, b)), rel(c.sabine[b], sabine(R, b)), rel(c.eyring[b], eyring(R, b)), rel(c.m[b], R.m[b])); });
  }
  check(worst < 1e-9, "the room's volume, surface, absorption areas (with the air's, from ISO 9613-1) and Sabine's and Eyring's reverberation times, as worked out again", `worst ${worst.toExponential(1)}`);
  check(Math.abs((24 * Math.log(10)) / C0 - 0.161) < 0.0005, "Sabine's constant: 24 ln 10/c = 0.161 s/m at 343.2 m/s", ((24 * Math.log(10)) / C0).toFixed(4));
  const hard = cppParts(W({ walls: 'concrete', floor: 'concrete' })), soft = cppParts(W({ walls: 'drapes', floor: 'carpet' }));
  const below = ROOMS.every((o) => { const c = cppParts(W(o)); return c.eyring.every((t, b) => t <= c.sabine[b]); });
  check(below && hard.eyring.every((t, b) => t / hard.sabine[b] > 0.98), "Eyring's time is never longer than Sabine's, and in a hard room, with little absorbed, the two agree within 2 %", hard.eyring.map((t, b) => (t / hard.sabine[b]).toFixed(3)).join(' '));
  check(soft.eyring[3] / soft.sabine[3] < 0.85, "in a dead room Eyring's is the shorter: at 1 kHz with drapes and carpet, 15 % shorter or more", `${soft.eyring[3].toFixed(2)} s against ${soft.sabine[3].toFixed(2)} s`);
}

// 2. the images
{
  let worst = 0, orders = true;
  for (const o of ROOMS) {
    const P = W(o), c = cppEarly(P), js = images(room(P), cppParts(P).Re * 1.001);
    c.forEach(([r, n, g], i) => {
      worst = Math.max(worst, Math.abs(r - js[i][0]) / r);
      orders &&= n === js[i][1];
      g.forEach((v, b) => { worst = Math.max(worst, Math.abs(v / js[i][2][b] - 1)); });
    });
  }
  check(worst < 1e-9 && orders, "the direct sound and the first 64 reflections, their paths, their orders and their strengths in each band, as the bass mirrored again and again in the walls finds them", `worst ${worst.toExponential(1)}`);
  const P = W({}), R = room(P), r = 60, count = images(R, r).length, expect = (4 * Math.PI * r ** 3) / (3 * R.V);
  check(rel(count, expect) < 0.03, 'the images fill space one to a room: within 60 m, 4π r³/3V of them', `${count} against ${expect.toFixed(0)}`);
  const first = cppEarly(P)[0];
  check(first[1] === 0 && rel(first[0], R.d) < 1e-12 && rel(first[2][3], Math.exp(-0.5 * R.m[3] * R.d) / R.d) < 1e-12, 'the first is the direct sound: d away, unreflected, 1/d strong, less the air\'s absorption');
}

// 3. the engine's taps
{
  let worst = 0, count = true;
  for (const o of ROOMS) {
    const P = W(o), e = cppEarly(P), t = cppTaps(P), d = e[0][0];
    const want = e.filter(([r]) => ((r - d) / C0) * fs <= 0.45 * fs);
    count &&= t.taps.length === want.length;
    t.taps.forEach(([at, g], k) => {
      worst = Math.max(worst, Math.abs(at - ((want[k][0] - d) / C0) * fs));
      g.forEach((v, b) => { worst = Math.max(worst, Math.abs(v / want[k][2][b] - 1) * 1e-3); });
    });
  }
  check(count && worst < 1e-3, 'the engine plays each reflection at its path over c after the direct sound, to a thousandth of a sample, with its strength in each band', `worst ${worst.toExponential(1)}`);
}

// 4. each band's late sound: its decay and its power
{
  const rows = [];
  let worstT = 0, worstP = 0;
  for (const o of [{}, { walls: 'concrete', floor: 'concrete' }, { walls: 'drapes', floor: 'carpet' }]) {
    const P = W(o), R = room(P), c = cppParts(P), t = cppTaps(P), k = 480;
    for (const b of [0, 3, 5]) {
      const T = c.eyring[b], blocks = Math.min(4000, Math.ceil((Math.min(T, 8) * fs) / k)), pw = cppLate(P, b, blocks, k);
      // the slope, by least squares on the dB, from 0.1 s past the late sound's start to 40 dB down
      const start = Math.ceil((t.pre + 0.1 * fs) / k), pts = [];
      for (let i = start; i < blocks; i++) { const v = 10 * Math.log10(pw[i]); if (v < 10 * Math.log10(pw[start]) - 40) break; pts.push([(i * k) / fs, v]); }
      const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const slope = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
      worstT = Math.max(worstT, rel(-60 / slope, T));
      // its power against the diffuse field's, averaged over its first 40 dB
      const want = pts.map(([s]) => 10 * Math.log10(diffuse(R, T, s + (k / 2) / fs + c.d / C0) / fs));
      const off = pts.reduce((s, p, i) => s + p[1] - want[i], 0) / pts.length;
      worstP = Math.max(worstP, Math.abs(off));
      rows.push(`${CENTRES[b]} Hz ${(-60 / slope).toFixed(2)}/${T.toFixed(2)} s ${off.toFixed(2)} dB`);
    }
  }
  check(worstT < 0.02, "each band's late sound dies away at Eyring's rate, within 2 %", rows.join('; '));
  check(worstP < 0.5, "and is as strong as the diffuse field, 4π c/V e^(−13.8 t/T) of the bass a metre off, within half a decibel", `worst ${worstP.toFixed(2)} dB`);
}

// 5. the whole engine
const steady = {};
{
  const P = W({}), R = room(P), e = cppEarly(P), y = impulse(P, 0.05), firstAt = Math.floor(((e[1][0] - e[0][0]) / C0) * fs);
  const rest = Math.max(...Array.from(y.subarray(1, firstAt - 2), Math.abs));
  const top = Math.exp(-0.5 * R.m[5] * R.d) / R.d;
  check(rel(y[0], top) < 0.002 && rest < 0.01 * y[0], "until the first reflection comes, the bass alone, at once: an impulse's first sample, all treble, 1/d of it less the air's absorption at 4 kHz (the bands sum back to the bass)", `${y[0].toFixed(5)} against ${top.toFixed(5)}, the rest under ${(rest / y[0]).toExponential(1)} of it`);
  const rows = [];
  let worst = 0;
  for (const o of ROOMS.slice(0, 4)) {
    const P = W(o), c = cppParts(P), h = impulse(P, Math.min(8, 1.6 * Math.max(...c.eyring)));
    CENTRES.forEach((fc, b) => { const T = t30(band(h, fc, 1 / 6, 0.25)); worst = Math.max(worst, rel(T, c.eyring[b])); rows.push(`${fc}: ${T.toFixed(2)}/${c.eyring[b].toFixed(2)}`); });
  }
  check(worst < 0.2, "every octave's T30 in the pedal's impulse response, measured in a third of an octave at its centre, within 20 % of Eyring's time, in four rooms", rows.join(', '));
  // white noise: the 1 kHz octave's power out against the direct sound's alone
  const n = 4 * fs, noise = new Float32Array(n);
  let seed = 1;
  for (let i = 0; i < n; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; noise[i] = (seed / 2 ** 32 - 0.5) * 0.5; }
  const ratio = (P) => {
    const R = room(P), out = run(P, noise).L, bi = band(noise, 1000, 0.4, 0.6), bo = band(out, 1000, 0.4, 0.6);
    let pi = 0, po = 0;
    for (let i = 2 * fs; i < n; i++) { pi += bi[i] ** 2; po += bo[i] ** 2; }
    const direct = pi * (Math.exp(-0.5 * R.m[3] * R.d) / R.d) ** 2;
    return { got: db(Math.sqrt(po / direct)), want: db(Math.sqrt(1 + (R.d ** 2 * 4 * Math.PI * C0 * eyring(R, 3)) / (6 * Math.log(10) * R.V))) };
  };
  const near = ratio(W({ distance: 1.2 })), far = ratio(W({}));
  steady.far = far.got;
  check(Math.abs(near.got - near.want) < 1.5 && Math.abs(far.got - far.want) < 1.5, 'in a steady sound the room and the bass together are 1 + 4π c T d²/(13.8 V) of the bass alone (the diffuse field summed over its decay, with Eyring\'s T): 1 + (d/rc)², rc the critical distance: within 1.5 dB at 1.2 m and 6 m', `${near.got.toFixed(1)}/${near.want.toFixed(1)} dB, ${far.got.toFixed(1)}/${far.want.toFixed(1)} dB`);
}

// 6. the hints
{
  const T = (o, b) => cppParts(W(o)).eyring[b], s1 = (v) => v.toFixed(1), s1s = (os, b) => os.map((o) => s1(T(o, b))).join(' ');
  const tell = (got, want, text) => check(got === want, `the hint (${text})`, got);
  tell(s1s([{ length: 4 }, { length: 9 }, { length: 36 }], 3), '2.0 2.4 2.7', 'Length): at 1 kHz the stock room rings 2.0 s at 4 m long, 2.4 s at 9 m, 2.7 s at 36 m');
  tell(s1s([{ walls: 'concrete' }, { walls: 'plaster' }, { walls: 'drapes' }], 2), '3.5 1.9 0.5', 'Walls): at 500 Hz, 3.5 s off poured concrete, 1.9 s off plaster, 0.5 s behind velour drapes');
  tell(s1s([{}, { audience: 100 }], 3), '2.6 0.8', 'Audience): a full house takes the stock room\'s 2.6 s at 1 kHz down to 0.8 s');
  const rc = [critical(room(W({})), 3), critical(room(W({ audience: 100 })), 3)].map(s1).join(' ');
  tell(`${rc} ${steady.far.toFixed(0)}`, '1.2 2.1 14', 'Distance): the critical distance 1.2 m at 1 kHz, 2.1 m with a full house; at 6 m the room and the bass together 14 dB over the bass alone');
  check(PEDAL.expression === 'distance' && /expression pedal/.test(knob('distance')), 'an expression pedal moves the Distance');
  tell(db(1 / room(W({})).d).toFixed(0), '-16', 'Level): at 0 dB the direct sound at 6 m 16 dB under the bass a metre away');
  tell(s1s([{ width: 3 }, { width: 40 }], 3), '1.8 2.8', 'Width): at 1 kHz, 1.8 s at 3 m wide, 2.8 s at 40 m');
  tell(s1s([{ height: 2.5 }, { height: 20 }], 3), '1.3 5.1', 'Height): at 1 kHz, 1.3 s under 2.5 m, 5.1 s under 20 m');
  tell(s1s([{ floor: 'wood' }, { floor: 'carpet' }, { floor: 'concrete' }], 4), '3.0 1.2 5.3', 'Floor): at 2 kHz, 3.0 s over wood, 1.2 s over carpet, 5.3 s over concrete');
  const hall = { length: 60, width: 40, height: 20, walls: 'concrete', floor: 'concrete' };
  tell(s1s([{ humidity: 10 }, { humidity: 90 }, { ...hall, humidity: 10 }, { ...hall, humidity: 90 }], 5), '1.1 2.7 1.5 6.6', 'Humidity): at 4 kHz, 1.1 s at 10 % and 2.7 s at 90 %; in a concrete hall 60 by 40 by 20 m, 1.5 s against 6.6 s');
  const hints = PEDAL.groups.flatMap((g) => g.params).map((p) => p.hint);
  check(hints.every((h) => h && !/TODO/.test(h)), 'every knob has its hint');
}

// the README's numbers
{
  const pr = (name) => W(PEDAL.presets[name]), T = (P, b) => cppParts(P).eyring[b], TS = (P, b) => cppParts(P).sabine[b];
  const stock = W({}), dr = pr('Drawing room'), cat = pr('Cathedral'), e = cppEarly(stock), c = cppParts(stock), R = room(cat);
  const nums = [T(stock, 3), T(stock, 0), T(W({ audience: 100 }), 3)].map((v) => v.toFixed(1)).join(' ');
  check(nums === '2.6 0.9 0.8', 'the README: the stock room rings 2.6 s at 1 kHz and 0.9 s at 125 Hz; a full house, 0.8 s at 1 kHz', nums);
  const dead = `${T(dr, 3).toFixed(2)} ${TS(dr, 3).toFixed(2)} ${T(dr, 0).toFixed(1)}`;
  check(dead === '0.12 0.19 2.0', 'the README: the drawing room rings 0.12 s at 1 kHz by Eyring, 0.19 s by Sabine, 2.0 s at 125 Hz', dead);
  const share = (4 * R.m[5] * R.V) / A(R, 5), hum = [10, 90].map((h) => T(W({ ...PEDAL.presets.Cathedral, humidity: h }), 5).toFixed(1)).join(' ');
  const big = `${(100 * share).toFixed(0)} ${T(cat, 5).toFixed(1)} ${T(cat, 1).toFixed(0)} ${hum}`;
  check(big === '61 3.5 16 1.3 4.3', 'the README: in the Cathedral the air does 61 % of the absorbing at 4 kHz, which dies in 3.5 s while 250 Hz rings 16 s; 1.3 s at 10 % humidity, 4.3 s at 90 %', big);
  const times = `${(((e[1][0] - e[0][0]) / C0) * 1000).toFixed(1)} ${(((c.Re - c.d) / C0) * 1000).toFixed(0)} ${e[1][1]}`;
  check(times === '1.3 62 1', 'the README: at 6 m in the stock room the first reflection comes 1.3 ms after the direct sound, and the late sound 62 ms after it', times);
  const schroeder = 2000 * Math.sqrt(c.eyring[3] / c.V);
  check(schroeder.toFixed(0) === '89', 'the README: Schroeder\'s frequency in the stock room, 2000 √(T/V) at 1 kHz\'s T, 89 Hz', schroeder.toFixed(1));
}

// 7. hygiene
{
  const r = run(W({}), new Float32Array(fs));
  check(Math.max(...r.L.map(Math.abs)) === 0, 'silence in, silence out');
  check(r.R.every((v, i) => v === r.L[i]), 'mono out on both sides');
  // the room grown mid-note fades between the old taps and the new: no step past the note's own
  const e = new Effect(fs);
  e.setParams(W({}));
  const n = 2 * fs, inp = sine(98, fs, n, 0.3), L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i += 128) {
    if (i >= n / 2 && i < n / 2 + 12800) e.setParams(W({ length: 18 + (i - n / 2) / 400, walls: i < n / 2 + 6400 ? 'plaster' : 'drapes', distance: 6 + (i - n / 2) / 1600 }));
    e.process(inp.subarray(i, i + 128), L.subarray(i, i + 128), R.subarray(i, i + 128));
  }
  e.destroy();
  // the note's own step is its slope, 2π f/fs of its height; a click would be a step out of proportion
  // to the height around it (the room moving this fast changes how loud the note rings in it)
  const worstStep = (a, b) => {
    let worst = 0;
    for (let i = a; i < b; i += 1024) {
      let step = 0, height = 0;
      for (let j = i; j < i + 1024; j++) { step = Math.max(step, Math.abs(L[j] - L[j - 1])); height = Math.max(height, Math.abs(L[j])); }
      worst = Math.max(worst, step / height);
    }
    return worst;
  };
  const before = worstStep(n / 4, n / 2), after = worstStep(n / 2, n - 1024);
  check(after < 1.5 * before, 'the room grown, its walls hung with drapes and you walked back mid-note, the pedal fades from room to room: no step past the note\'s own, for its height', `${(1e3 * after).toFixed(1)} of the height a sample against ${(1e3 * before).toFixed(1)}`);
  const e2 = new Effect(fs);
  e2.setParams(W({}));
  const bad = new Float32Array(128); bad[5] = NaN;
  const L2 = new Float32Array(4096), R2 = new Float32Array(4096);
  const ok = e2.process(bad, L2.subarray(0, 128), R2.subarray(0, 128));
  e2.process(sine(100, fs, 4096, 0.3), L2, R2);
  check(!ok && L2.every(Number.isFinite) && Math.max(...L2.map(Math.abs)) > 0.02, 'a NaN in comes out as a silent block, and the pedal recovers');
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

// 9. CPU, with a knob turned every block too
if (!CI) {
  const quiet = (pre) => {
    const e = new Effect(fs); e.setParams(W({}));
    const L = new Float32Array(fs), R = new Float32Array(fs);
    if (pre) { e.process(sine(41.2, fs, fs, 0.3), L, R); for (let k = 0; k < 40; k++) e.process(new Float32Array(fs), L, R); }
    const t0 = performance.now(); for (let k = 0; k < 4; k++) e.process(new Float32Array(fs), L, R); const ms = performance.now() - t0;
    e.destroy(); return ms / 4;
  };
  const rest = Math.min(quiet(false), quiet(false)), after = Math.min(quiet(true), quiet(true));
  check(after < 2 * rest + 1, 'CPU: once the tail has died, silence costs what silence from rest does', `${after.toFixed(1)} ms a second after a note, ${rest.toFixed(1)} ms from rest`);
  const n = 10 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.8 * Math.sin((2 * Math.PI * 41.2 * i) / fs) * Math.exp(-(i % fs) / fs));
  for (const [rate, turning] of [[48000, false], [96000, false], [48000, true]]) {
    const e = new Effect(rate);
    e.setParams(W({}));
    const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
    for (let i = 0; i < n; i += 128) {
      if (turning) e.setParams(W({ length: 18 + 10 * Math.sin(i / fs) }));
      e.process(inp.subarray(i, i + 128), L.subarray(i, i + 128), R.subarray(i, i + 128));
    }
    const share = (performance.now() - t0) / 1000 / (n / rate);
    e.destroy();
    const budget = rate > 48000 ? 0.3 : 0.15;
    check(share < budget, `CPU: at ${rate / 1000} kHz${turning ? ', the Length turned every block,' : ''} under ${100 * budget} % of a core (WebAssembly)`, `${(100 * share).toFixed(1)} %`);
  }
}

done();
