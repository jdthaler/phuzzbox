// doppler-tests.mjs — the Doppler against physics written here, independently of the C++
// (test/doppler-circuit.mjs): its retarded times against bisection on the light-cone condition;
// its output against the moving source's field summed at those times; the textbook Doppler shifts;
// the Mach cone; each hint, and hygiene.

import { check, done, CI } from './harness.mjs';
import { loadPedal } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { peak, rms } from '../tools/audio-util.mjs';
import { EAR, sound, retarded, field, shift, coneLag } from './doppler-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('doppler');
const x = Effect.exports;
const fs = 48000;
// at the output knob's unity setting (its default is set for loudness: tools/loudness.mjs)
const D = { ...defaults(PEDAL.groups), level: 0 };
const W = (over) => ({ ...D, ...over });
const cents = (r) => 1200 * Math.log2(r);

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
const tone = (f, n, a = 0.1) => Float32Array.from({ length: n }, (_, i) => a * Math.sin((2 * Math.PI * f * i) / fs));
function delays(p, s, e) {
  const sc = scratch(x), io = sc.f64(8);
  io.set([p.v, p.u, p.d, p.c, p.T, s, e]);
  x.doppler_delays(sc.at);
  const o = sc.f64(3);
  return { k: o[0], D: [o[1], o[2]].slice(0, o[0]) };
}
function passOf(P, m = 801) {
  const v = Effect.native(P), sc = scratch(x);
  const io = sc.f64(v.length + 1); io.set(v); io[v.length] = m;
  x.doppler_pass(sc.at);
  const o = sc.f64(5 + 5 * m), at = (k) => Array.from(o.slice(5 + k * m, 5 + (k + 1) * m));
  return { p: { v: o[0], u: o[1], d: o[2], c: o[3], T: o[4] }, s: at(0), r0: at(1), g0: at(2), r1: at(3), g1: at(4) };
}
// the engine's first pass: its middle (samples from the start) and its geometry
const middle = (P) => (P.period * fs) / 2;
const geometry = (P) => ({ v: P.speed, u: P.listener, d: P.distance, c: x.doppler_sound(P.temp), T: P.period });

// 1. the air and the retarded times
{
  check(Math.abs(x.doppler_sound(20) - sound(20)) < 0.05 && Math.abs(x.doppler_sound(0) - sound(0)) < 0.05 && Math.abs(x.doppler_sound(-20) - sound(-20)) < 0.05,
    'the speed of sound, 331.3 √(1 + T / 273.15), against the ideal gas √(γRT/M): 331 m/s at 0 °C, 343 m/s at 20 °C', `${x.doppler_sound(0).toFixed(2)}, ${x.doppler_sound(20).toFixed(2)} m/s; ideal gas ${sound(0).toFixed(2)}, ${sound(20).toFixed(2)}`);
  let worst = 0, counts = true, n = 0;
  const cases = [];
  for (const v of [0, 25, 90, 250, 330, 360, 500, 686]) for (const u of [-40, 0, 25]) for (const d of [1, 4, 30, 100]) for (const s of [-2.2, -0.4, 0.05, 0.6, 2.5]) for (const e of [-EAR, EAR]) cases.push({ v, u, d, s, e });
  for (const { v, u, d, s, e } of cases) {
    const p = { v, u, d, c: 343.2, T: 6 };
    const mine = delays(p, s, e), ref = retarded(p, s, e, { back: 25, steps: 6000 }).map((tau) => s - tau);
    if (ref.some((r) => r > 24) || mine.D.some((r) => r > 24)) continue; // beyond the scan
    n++;
    if (mine.k !== ref.length) { counts = false; continue; }
    mine.D.forEach((Dk, k) => { worst = Math.max(worst, Math.abs(Dk - ref[k]) / ref[k]); });
  }
  check(counts && worst < 1e-9, 'the retarded times, the quadratic solved in closed form, against bisection on the light-cone condition c (t − τ) = |path|: one below Mach 1, none or two above', `${n} cases, worst ${worst.toExponential(1)} relative`);
}

// 2. the engine's output against the field summed at its retarded times
{
  const P = W({ speed: 25, distance: 4, period: 4 }), p = geometry(P), f = 110, n = 4 * fs;
  const r = run(P, tone(f, n, 0.2));
  const env = (tau) => { const T = p.T, rr = Math.min(T / 6, 1), a = tau + T / 2; if (a <= 0 || a >= T) return 0; const m = Math.min(a, T - a); return m >= rr ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * m) / rr); };
  const q = (tau) => env(tau) * 0.2 * Math.sin(2 * Math.PI * f * (tau * fs + middle(P)) / fs);
  let err = 0, sig = 0;
  for (let i = Math.round(0.3 * fs); i < Math.round(3.7 * fs); i += 37) {
    const t = (i + 0.5 - middle(P)) / fs;
    for (const [out, e] of [[r.L, -EAR], [r.R, EAR]]) {
      const y = field(p, t, e, q, retarded(p, t, e, { back: 1, steps: 400 }));
      err += (out[i] - y) ** 2; sig += y * y;
    }
  }
  check(Math.sqrt(err / sig) < 2e-3, 'a car passing at 25 m/s, 4 m away: both ears against the moving source\'s field q(τ) d / (R |1 − M_r|) summed at the retarded times found by bisection', `${(100 * Math.sqrt(err / sig)).toFixed(3)} % RMS difference`);
}

// a tone's frequency in the output near sample i, by its zero crossings over w samples
function freqAt(y, i, w) {
  const z = [];
  for (let k = i - w / 2; k < i + w / 2; k++) if (y[k] <= 0 && y[k + 1] > 0) z.push(k + y[k] / (y[k] - y[k + 1]));
  return ((z.length - 1) * fs) / (z.at(-1) - z[0]);
}

// 3. the pitch heard, against the textbook Doppler shift
{
  const f = 200, n = 4 * fs;
  let worst = 0, points = 0;
  for (const over of [{ speed: 25 }, { speed: 90, distance: 6 }, { speed: 0, listener: 25 }, { speed: 25, listener: -25 }, { speed: 250, distance: 60, period: 6 }]) {
    const P = W(over), p = geometry(P), y = run(P, tone(f, Math.max(n, P.period * fs + fs), 0.2)).L;
    for (const frac of [0.25, 0.4, 0.62, 0.8]) {
      const i = Math.round(frac * P.period * fs), t = (i - middle(P)) / fs, tau = retarded(p, t, -EAR, { back: 2, steps: 4000 })[0];
      if (!(Math.abs(tau) < 0.35 * P.period)) continue; // sent from where the source fades in or out
      worst = Math.max(worst, Math.abs(cents(freqAt(y, i, 1200) / (f * shift(p, t, -EAR, tau)))));
      points++;
    }
  }
  check(worst < 1 && points >= 16, 'the pitch heard against the textbook Doppler shift (1 − u cos θ / c) / (1 − v cos θ / c), source and listener each moving through the air', `${points} moments, worst ${worst.toFixed(2)} cents`);
}

// 4. above Mach 1
{
  const P = W({ speed: 686, distance: 100, period: 6, mix: 1, dry: 0 }), p = geometry(P), n = 6 * fs;
  const r = run(P, tone(80, n, 0.2));
  const tc = middle(P) + coneLag({ ...p, u: 0 }) * fs; // the cone reaches the middle of the head
  const before = peak(r.L.subarray(0, Math.floor(tc - (EAR / (p.v)) * fs) - 2)), at = r.L.subarray(Math.floor(tc), Math.floor(tc + 0.05 * fs));
  let big = 0, where = 0; r.L.forEach((v, k) => { if (Math.abs(v) > big) { big = Math.abs(v); where = k; } });
  check(before === 0 && peak(at) > 0.1, 'above Mach 1, nothing until the Mach cone arrives, X = d √(M² − 1) after the source passes', `silent to ${(tc / fs).toFixed(4)} s, then ${peak(at).toFixed(2)} V`);
  check(Math.abs(where - tc) < 0.02 * fs, 'and the loudest moment, the boom, as the cone sweeps over you', `${(where / fs).toFixed(4)} s, the cone at ${(tc / fs).toFixed(4)} s`);
  // two clicks sent during the approach arrive in the reverse order: the approach is heard backwards
  const clicks = new Float32Array(n), t1 = Math.round(middle(P) - 0.8 * fs), t2 = Math.round(middle(P) - 0.5 * fs);
  clicks[t1] = 1; clicks[t2] = -1;
  const c = run({ ...P, distance: 100 }, clicks).L;
  const arrive = (sign) => { let b = 0, k0 = 0; c.forEach((v, k) => { if (sign * v > b) { b = sign * v; k0 = k; } }); return k0; };
  const a1 = arrive(1), a2 = arrive(-1), heard = (tau) => tau + retardedFor(p, tau);
  check(a2 < a1 && Math.abs(a1 - heard((t1 - middle(P)) / fs) * fs - middle(P)) < 3 && Math.abs(a2 - heard((t2 - middle(P)) / fs) * fs - middle(P)) < 3,
    'the approach of a supersonic source is heard backwards: of two clicks it sent, the later arrives first, each when the light-cone condition says', `sent ${((t2 - t1) / fs).toFixed(2)} s apart, heard ${((a1 - a2) / fs * 1000).toFixed(1)} ms apart, reversed`);
}
// when sound sent at τ (from the middle) reaches the left ear: bisection on the light-cone condition
function retardedFor(p, tau) {
  const g = (t) => p.c * (t - tau) - Math.hypot(p.v * tau - (p.u * t - EAR), p.d);
  let lo = tau, hi = tau + 30;
  for (let k = 0; k < 200; k++) { const m = 0.5 * (lo + hi); if (g(m) < 0) lo = m; else hi = m; }
  return 0.5 * (lo + hi) - tau;
}

// 5. a click's area arrives whole: ∫ heard dt = ∫ sent dτ · d / R, however compressed
{
  let worst = 0;
  for (const over of [{ speed: 25 }, { speed: 330, distance: 2 }, { speed: 686, distance: 100, period: 6 }]) {
    const P = W(over), p = geometry(P), n = Math.round((P.period + 3) * fs), sent = Math.round(middle(P) - 0.3 * fs);
    const clicks = new Float32Array(n); clicks[sent] = 1;
    const y = run(P, clicks).L, area = y.reduce((s, v) => s + v, 0);
    const tau = (sent - middle(P)) / fs, R = p.c * retardedFor(p, tau);
    worst = Math.max(worst, Math.abs(area / (p.d / R) - 1));
  }
  check(worst < 1e-3, 'a click\'s area arrives whole, scaled by d / R, at 25 m/s, at 330 m/s 2 m away and at Mach 2: the compression only squeezes it', `worst ${(100 * worst).toFixed(4)} %`);
}

// 6. the ears
{
  const P = W({ speed: 25, distance: 4 }), clicks = new Float32Array(5 * fs), sent = Math.round(middle(P) - 1.5 * fs);
  clicks[sent] = 1;
  const r = run(P, clicks), at = (y) => y.reduce((b, v, k) => (v > y[b] ? k : b), 0);
  const itd = (at(r.R) - at(r.L)) / fs, p = geometry(P), dx = p.v * -1.5 - 0, cos = -dx / Math.hypot(dx, p.d), expect = (2 * EAR * cos) / p.c;
  check(itd > 0 && Math.abs(itd - expect) < 1.5 / fs, 'the left ear hears the coming source first, by 2 × 8.75 cm × cos θ / c', `${(1e6 * itd).toFixed(0)} µs, expected ${(1e6 * expect).toFixed(0)} µs`);
}

// 7. the hints
{
  const c20 = x.doppler_sound(20);
  const fall = cents((c20 + 25) / (c20 - 25)) / 100, far = passOf(W({ speed: 25, period: 8, distance: 1 }));
  const heard = (r) => r.filter((v) => v !== 0), first = heard(far.r0)[3], last = heard(far.r0).at(-4);
  check(Math.abs(fall - 2.5) < 0.05 && Math.abs(cents(first / last) / 100 - fall) < 0.1, 'Speed: at 25 m/s a note falls by 2.5 semitones as it passes', `${fall.toFixed(2)} semitones; the engine's pass ${(cents(first / last) / 100).toFixed(2)}`);
  // close, the fall is quick and the swell big; far, a slow glide
  const spread = (d) => {
    const q = passOf(W({ speed: 25, distance: d, period: 8 })), r = heard(q.r0), g = q.g0.filter((v) => v !== 0);
    const top = r[3], bottom = r.at(-4), mid = Math.sqrt(top * bottom);
    const hi = q.s.find((s, i) => q.r0[i] !== 0 && q.r0[i] < Math.sqrt(top * mid)), lo = q.s.find((s, i) => q.r0[i] !== 0 && q.r0[i] < Math.sqrt(bottom * mid));
    return { time: lo - hi, swell: Math.max(...g) / g[3] };
  };
  const near = spread(4), wide = spread(40);
  check(near.time < wide.time / 5 && near.swell > 5 * wide.swell, 'Distance: close, the pitch drops fast and the level swells; far, it glides down slowly', `the middle of the fall takes ${(1000 * near.time).toFixed(0)} ms at 4 m, ${(1000 * wide.time).toFixed(0)} ms at 40 m; the level swells ${near.swell.toFixed(1)}× and ${wide.swell.toFixed(1)}×`);
  const P = W({ period: 3 }), y = run(P, tone(150, 9 * fs, 0.2)).L, loud = [];
  for (let k = 0; k < 3; k++) { let b = 0, w = 0; for (let i = k * 3 * fs; i < (k + 1) * 3 * fs; i++) if (Math.abs(y[i]) > b) { b = Math.abs(y[i]); w = i; } loud.push(w); }
  check(Math.abs((loud[1] - loud[0]) / fs - 3) < 0.02 && Math.abs((loud[2] - loud[1]) / fs - 3) < 0.02, 'Every: a pass every 3 s, each loudest as it passes halfway', `${((loud[1] - loud[0]) / fs).toFixed(3)}, ${((loud[2] - loud[1]) / fs).toFixed(3)} s apart`);
  const ride = passOf(W({ speed: 0, listener: 25, period: 8 })), drive = passOf(W({ speed: 25, listener: 0, period: 8 }));
  const rc = [cents(heard(ride.r0)[1]), cents(heard(ride.r0).at(-2))], dc = [cents(heard(drive.r0)[1]), cents(heard(drive.r0).at(-2))];
  check(Math.abs(rc[0] - 122) < 1.5 && Math.abs(rc[1] + 131) < 1.5 && Math.abs(dc[0] - 131) < 1.5 && Math.abs(dc[1] + 122) < 1.5,
    'Your speed: riding past a still source at 25 m/s, 122 cents high then 131 low; the source passing you, 131 high then 122 low', `riding ${rc.map((v) => v.toFixed(1)).join(', ')}; passed ${dc.map((v) => v.toFixed(1)).join(', ')} cents`);
  check(Math.abs(x.doppler_sound(0) - 331.3) < 0.05 && Math.abs(x.doppler_sound(20) - 343.2) < 0.05, 'Air: 331 m/s at 0 °C, 343 m/s at 20 °C');
  const n = tone(220, 4800, 0.2), dry = run(W({ dry: 1, mix: 0 }), n).L;
  check(dry.every((v, k) => Math.abs(v - n[k]) < 1e-6), 'Dry: the bass as it came in');
  const lv = run(W({ dry: 1, mix: 0, level: -6 }), n).L;
  check(lv.every((v, k) => Math.abs(v - 0.501187 * n[k]) < 1e-6), 'Level: gain after the mix, in decibels');
  const long = tone(220, 3 * fs, 0.2), half = run(W({ mix: 0.5 }), long).L, full = run(W({ mix: 1 }), long).L;
  check(half.every((v, k) => Math.abs(v - 0.5 * full[k]) < 1e-6) && peak(full) > 0.05, 'Fly-by: how much of the passing source is heard');
}

// 8. hygiene
{
  const loud = tone(41.2, 7 * fs, 1), r = run(W(PEDAL.presets['Mach 2']), loud);
  check(r.ok && r.L.every(Number.isFinite) && peak(r.L) < 20, 'a loud low note at Mach 2, as its preset sets the level: finite and bounded', `peak ${peak(r.L).toFixed(2)} V`);
  const close = run(W({ speed: 340, distance: 1, period: 1 }), tone(2000, 3 * fs, 0.5));
  check(close.ok && close.L.every(Number.isFinite) && peak(close.L) < 100, 'just below Mach 1, 1 m away: finite', `peak ${peak(close.L).toFixed(2)} V, ${rms(close.L).toFixed(3)} V RMS`);
  check(r.latency === 0, 'no latency');
  const e = new Effect(fs); e.setParams(W({ dry: 1 }));
  const bad = new Float32Array(128); bad[5] = NaN;
  const L = new Float32Array(4096), R = new Float32Array(4096);
  e.process(bad, L.subarray(0, 128), R.subarray(0, 128));
  const nanSilent = L.subarray(0, 128).every(Number.isFinite) && L[5] === 0;
  e.process(tone(100, 4096, 0.1), L, R);
  check(nanSilent && L.every(Number.isFinite) && peak(L) > 0.01, 'a NaN in is heard as silence, and the pedal plays on');
  e.destroy();
  const ids = new Map(PEDAL.groups.flatMap((g) => g.params).map((p) => [p.id, p]));
  const badP = Object.entries(PEDAL.presets).flatMap(([nm, v]) => Object.entries(v).filter(([id, val]) => !ids.has(id) || (typeof val === 'number' && (val < ids.get(id).min || val > ids.get(id).max))).map(([id]) => `${nm}: ${id}`));
  check(!badP.length, 'every preset sets real parameters inside their ranges', badP.join(', '));
}

// 9. CPU
if (!CI) {
  let worst = 0;
  for (const P of [D, W({ speed: 686, distance: 100, period: 1 }), W({ speed: 340, distance: 1, period: 1 })]) {
    const e = new Effect(fs); e.setParams(P);
    const inp = tone(55, 12 * fs, 0.3), L = new Float32Array(128), R = new Float32Array(128), t0 = performance.now();
    for (let at = 0; at < inp.length; at += 128) e.process(inp.subarray(at, at + 128), L, R);
    worst = Math.max(worst, (performance.now() - t0) / 12000);
    e.destroy();
  }
  check(worst < 0.03, 'CPU: under 3 % of a core (WebAssembly), the busiest passes too', `${(100 * worst).toFixed(2)} %`);
}

done();
