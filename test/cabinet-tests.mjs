// cabinet-tests.mjs — the Speaker Cabinet against physics written here, independently of the C++
// (test/cabinet-circuit.mjs): the Thiele–Small parameters as masses, springs and a motor, the
// cabinet as four linear equations solved by complex Gaussian elimination, and Small's closed
// forms (the closed box's resonance, Q and response; the vented box's tuning; the reference
// efficiency); then the engine against them, its large-signal behaviour, the hints, and hygiene.

import { check, done, CI } from './harness.mjs';
import { loadPedal, loadBass } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { amplitudeAt, db, sine, peak } from '../tools/audio-util.mjs';
import { tune } from '../shared/tuner.js';
import { derive, smallSignal, mag, closedBox, closedBoxShape, efficiency } from './cabinet-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('cabinet');
const x = Effect.exports;
const fs = 48000;
const D = defaults(PEDAL.groups);
const W = (over) => ({ ...D, ...over });
const preset = (name, over) => W({ ...PEDAL.presets[name], ...over });

function cppResponse(P, freqs) {
  const s = scratch(x), v = Effect.native(P), n = freqs.length;
  s.f64(v.length).set(v);
  s.f64(n, 8 * v.length).set(freqs);
  x.cabinet_response(s.at, n);
  const o = Array.from(s.f64(5 * n, 8 * (v.length + n)));
  return { h: o.slice(0, n), hp: o.slice(n, 2 * n), z: o.slice(2 * n, 3 * n), x: o.slice(4 * n) };
}
function cppInfo(P) {
  const s = scratch(x), v = Effect.native(P);
  s.f64(v.length).set(v);
  x.cabinet_info(s.at);
  const [mms, kms, bl, rms, cab, mp, sp, ra, fb, n, perVolt, rg, gain] = s.f64(13);
  return { mms, kms, bl, rms, cab, mp, sp, ra, fb, n, perVolt, rg, gain };
}
function run(P, input) {
  const e = new Effect(fs);
  e.setParams(P);
  const L = new Float32Array(input.length), R = new Float32Array(input.length);
  const ok = e.process(input, L, R);
  const out = { L, R, ok, messages: e.messages().filter((m) => m.type === 1), latency: e.latency() };
  e.destroy();
  return out;
}
const gainAt = (P, f, a = 1e-3, s = 1) => { const y = run(P, sine(f, fs, Math.round((s + 0.5) * fs), a)).L; return amplitudeAt(y.subarray(Math.round(0.5 * fs)), f, fs) / a; };
const H = (P, f) => cppResponse(P, [f]).h[0];
const logF = (a, b, n) => Array.from({ length: n }, (_, i) => a * (b / a) ** (i / (n - 1)));
// the frequency of the largest (or smallest) value of fn over a fine log grid
const argmax = (fn, a, b, n = 400, sign = 1) => { let best = a, v = -Infinity; for (const f of logF(a, b, n)) { const y = sign * fn(f); if (y > v) { v = y; best = f; } } return best; };

// 1. the driver's parameters become masses, springs and a motor alike here and in C++
{
  let worst = 0;
  for (const name of Object.keys(PEDAL.presets)) {
    const P = preset(name), c = cppInfo(P), j = derive(P);
    for (const k of ['mms', 'kms', 'bl', 'rms', 'cab', 'rg']) worst = Math.max(worst, Math.abs(c[k] / j[k] - 1));
    if (j.ported) for (const k of ['mp', 'sp', 'ra', 'fb']) worst = Math.max(worst, Math.abs(c[k] / j[k] - 1));
  }
  const d = derive(D);
  check(worst < 1e-12, 'model: the Thiele–Small parameters give the same masses, springs, motor and box here as in C++', `worst ${worst.toExponential(1)}; a 10-inch: Mms ${(1e3 * d.mms).toFixed(1)} g, Bl ${d.bl.toFixed(1)} T·m, Kms ${(d.kms / 1e3).toFixed(2)} N/mm`);
}

// 2. the C++ response is the four equations solved here
{
  let worst = 0;
  const F = logF(15, 8000, 40);
  for (const name of Object.keys(PEDAL.presets)) {
    const P = preset(name), d = derive(P), c = cppResponse(P, F);
    F.forEach((f, k) => {
      const j = smallSignal(d, f);
      worst = Math.max(worst, Math.abs(c.h[k] / mag(j.h) - 1), Math.abs(c.z[k] / mag(j.z) - 1), Math.abs(c.x[k] / mag(j.x) - 1));
    });
  }
  check(worst < 1e-9, 'model: the C++ small-signal response, impedance and excursion are the coupled equations solved here, every preset', `worst ${worst.toExponential(1)}`);
}

// 3. Small's closed box, where the coil's inductance and the amp's impedance are left out
{
  const P = W({ le: 0.1e-3, ampR: 0.01 }), cb = closedBox(P);
  const F = logF(15, 250, 30), ratio = F.map((f) => db(H(P, f) / closedBoxShape(cb, f)));
  const spread = Math.max(...ratio) - Math.min(...ratio);
  check(spread < 0.2, `sealed: the response is Small's second-order high-pass, fc = Fs√(1 + α) = ${cb.fc.toFixed(1)} Hz, Qtc = Qts√(1 + α) = ${cb.qtc.toFixed(3)}`, `within ${spread.toFixed(3)} dB from 15 to 250 Hz`);
  const peakZ = argmax((f) => cppResponse(P, [f]).z[0], 30, 200);
  check(Math.abs(peakZ / cb.fc - 1) < 0.01, 'and the impedance peaks at fc', `${peakZ.toFixed(1)} Hz`);
  const lo = db(H(P, 10)) - db(H(P, 20));
  check(Math.abs(lo + 12) < 1.5, 'Box, sealed: below its resonance it rolls off 12 dB an octave', `${lo.toFixed(1)} dB from 20 to 10 Hz`);
}
// Small's reference efficiency: one driver, 1 W into Re, at 1 m
{
  const P = W({ layout: '1x15', volume: 0.025, le: 0.1e-3, ampR: 0.01, mic: 0.1, drive: 20 }), d = derive(P);
  const volts = Math.sqrt(2 * P.re) / d.e; // the input's peak for 1 W (rms) into Re
  const pa = gainAt(P, 400, volts) * volts / P.mic; // the microphone's volts over its sensitivity
  const spl = 20 * Math.log10(pa / Math.SQRT2 / 20e-6), want = efficiency(P).spl;
  check(Math.abs(spl - want) < 0.5, `engine: a 10-inch makes Small's ${want.toFixed(1)} dB at 1 W and 1 m into half space (η₀ = ${(100 * efficiency(P).eta).toFixed(2)} %)`, `${spl.toFixed(2)} dB SPL at 400 Hz`);
}
// the vented box: the impedance's dip and the cone's least travel at the port's tuning
{
  const P = preset('4 × 10 ported'), d = derive(P);
  const dip = argmax((f) => cppResponse(P, [f]).z[0], 25, 80, 400, -1), still = argmax((f) => cppResponse(P, [f]).x[0], 25, 80, 400, -1);
  check(Math.abs(dip / d.fb - 1) < 0.04 && Math.abs(still / d.fb - 1) < 0.04, `ported: at the port's Helmholtz tuning, c/2π·√(S/(V·Leff)) = ${d.fb.toFixed(1)} Hz, the impedance dips and the cones barely move`, `${dip.toFixed(1)} Hz and ${still.toFixed(1)} Hz`);
  const lo = db(H(P, 10)) - db(H(P, 20)), xs = cppResponse(P, [31, d.fb]).x;
  check(lo < -18, 'Box, ported: far below its tuning it rolls off much faster, toward 24 dB an octave', `${lo.toFixed(1)} dB from 20 to 10 Hz`);
  check(xs[0] > 2.5 * xs[1], 'and below the tuning the cones unload: low B moves them far more than the tuning does', `${(1e3 * xs[0]).toFixed(2)} against ${(1e3 * xs[1]).toFixed(2)} mm per volt`);
}

// 4. the engine is the small-signal response, every preset, for a 1 mV signal
{
  let worst = 0, top = 0;
  for (const name of Object.keys(PEDAL.presets)) {
    const P = preset(name);
    for (const f of [25, 41, 60, 110, 300, 1200]) worst = Math.max(worst, Math.abs(db(gainAt(P, f)) - db(H(P, f))));
    top = Math.max(top, Math.abs(db(gainAt(P, 4000)) - db(H(P, 4000))));
  }
  check(worst < 0.01, 'engine: a 1 mV sine\'s gain is the small-signal response, every preset, 25 Hz to 1.2 kHz', `worst ${worst.toFixed(4)} dB`);
  // the input is held through each sample, and the cabinet's response to the held steps' images
  // above 24 kHz folds back: a tenth of a dB by 4 kHz, where the coil has the cabinet rolling off
  check(top < 0.15, 'and within 0.15 dB at 4 kHz, where holding the input through each sample shows', `worst ${top.toFixed(3)} dB`);
}

// 5. large signals: the cones run out of travel on low notes
const thd = (P, f, a) => {
  const n = Math.round(f) * 4 * Math.round(fs / Math.round(f)) / Math.round(f) > 0 ? Math.round(fs / f) * Math.round(f) : fs; // whole periods, about a second
  const y = run(P, sine(f, fs, fs + n, a)).L.subarray(fs, fs + n);
  const h1 = amplitudeAt(y, f, fs);
  return { thd: Math.sqrt([2, 3, 4, 5].reduce((s, k) => s + amplitudeAt(y, k * f, fs) ** 2, 0)) / h1, h1 };
};
{
  const clean = thd(W({}), 41.2, 0.15), hard = thd(W({ drive: 44 }), 41.2, 0.3), mid = thd(W({ drive: 44 }), 200, 0.3);
  check(clean.thd < 0.01 && hard.thd > 0.05, 'Power amp gain: a 0.15 V low E is clean at 32 dB, and a 0.3 V one at 44 dB runs the cones out of travel and distorts', `${(100 * clean.thd).toFixed(2)} % at 32 dB, ${(100 * hard.thd).toFixed(1)} % at 44 dB`);
  check(mid.thd < hard.thd / 4, 'the lowest strings first: a 200 Hz note at the same level stays much cleaner', `${(100 * mid.thd).toFixed(2)} % at 200 Hz`);
  const comp = db(hard.h1 / clean.h1) - db(2), linear = 12;
  check(comp < linear - 1, 'and compresses: 12 dB more drive is less than 12 dB louder on the low E', `${comp.toFixed(1)} dB`);
  const xs = run(W({ drive: 44 }), sine(41.2, fs, fs, 0.3)).messages.map((m) => m.values[20]);
  check(Math.max(...xs) > 4e-3, 'the cones travel past Xmax', `${(1e3 * Math.max(...xs)).toFixed(1)} mm against 4 mm`);
  const tight = thd(W({ drive: 40, xmax: 2e-3 }), 41.2, 0.3), loose = thd(W({ drive: 40, xmax: 8e-3 }), 41.2, 0.3);
  check(tight.thd > 2 * loose.thd, 'Linear travel: less of it, and loud low notes distort sooner', `${(100 * tight.thd).toFixed(1)} % at 2 mm, ${(100 * loose.thd).toFixed(2)} % at 8 mm`);
}

// 6. the hints
{
  const a = gainAt(W({}), 300), b = gainAt(W({ mic: 30e-3 }), 300);
  check(Math.abs(db(b / a) - 6.0206) < 0.01, 'Microphone sensitivity: twice the volts per pascal, +6 dB, and nothing else', `${db(b / a).toFixed(3)} dB`);
  // 8 drivers in 8 times the box, each with the same volts (2 in series: 6 dB more drive), against 1
  const one = H(W({ layout: '1x15', volume: 0.025, ampR: 1e-4 }), 300), eight = H(W({ layout: '8x10', volume: 0.2, ampR: 1e-4, drive: 32 + 20 * Math.log10(2) }), 300);
  check(Math.abs(db(eight / one) - 18.06) < 0.01, 'Drivers: 8 against 1, each with the same volts and its share of the box, is 18 dB more sound', `${db(eight / one).toFixed(2)} dB`);
  const fcOf = (o) => argmax((f) => cppResponse(W(o), [f]).z[0], 30, 300);
  const big = fcOf({ volume: 0.3 }), small = fcOf({ volume: 0.08 });
  const bump = (o) => { const P = W(o); return Math.max(...logF(40, 300, 60).map((f) => db(H(P, f)))) - db(H(P, 600)); };
  check(small > big && bump({ volume: 0.08 }) > bump({ volume: 0.3 }), 'Box volume, sealed: smaller raises the resonance and makes it peakier', `${big.toFixed(0)} → ${small.toFixed(0)} Hz; ${bump({ volume: 0.3 }).toFixed(1)} → ${bump({ volume: 0.08 }).toFixed(1)} dB above 600 Hz`);
  const pv = (o) => cppInfo(preset('4 × 10 ported', o)).fb;
  check(pv({ volume: 0.08 }) > pv({ volume: 0.2 }), 'ported, the same port tunes higher in a smaller box', `${pv({ volume: 0.2 }).toFixed(1)} → ${pv({ volume: 0.08 }).toFixed(1)} Hz`);
  check(Math.abs(pv({ ports: 4 }) / pv({ ports: 1 }) - 2) < 1e-9, 'Ports: four tune twice as high as one, as the square root of the area', `${pv({ ports: 1 }).toFixed(1)} → ${pv({ ports: 4 }).toFixed(1)} Hz`);
  check(pv({ portD: 0.15 }) > pv({ portD: 0.07 }), 'Port diameter: wider tunes higher', `${pv({ portD: 0.07 }).toFixed(1)} → ${pv({ portD: 0.15 }).toFixed(1)} Hz`);
  // the port air's speed on a loud note at the tuning: wider ports, retuned by length to the same, run slower
  const speed = (portD, portL) => Math.max(...run(preset('4 × 10 ported', { portD, portL, drive: 40 }), sine(45, fs, fs, 0.3)).messages.map((m) => m.values[21]));
  const narrow = speed(0.07, 0.03), wide = speed(0.12, 0.15);
  check(Math.abs(pv({ portD: 0.07, portL: 0.03 }) / pv({ portD: 0.12, portL: 0.15 }) - 1) < 0.02 && wide < narrow / 2, 'and keeps the air in it slower on loud low notes', `${narrow.toFixed(1)} m/s through 7 cm, ${wide.toFixed(1)} m/s through 12 cm, both tuned near ${pv({ portD: 0.12, portL: 0.15 }).toFixed(0)} Hz`);
  check(pv({ portL: 0.2 }) < pv({ portL: 0.05 }), 'Port length: longer tunes lower', `${pv({ portL: 0.05 }).toFixed(1)} → ${pv({ portL: 0.2 }).toFixed(1)} Hz`);
  check(fcOf({ fs: 35 }) < fcOf({ fs: 55 }), 'Resonance: a lower Fs reaches lower', `${fcOf({ fs: 55 }).toFixed(0)} → ${fcOf({ fs: 35 }).toFixed(0)} Hz`);
  check(bump({ qes: 0.25 }) < bump({ qes: 0.6 }) - 1.5, 'Electrical Q: lower is a flatter, less boomy low end', `${bump({ qes: 0.25 }).toFixed(1)} against ${bump({ qes: 0.6 }).toFixed(1)} dB above 600 Hz`);
  const dq = (ampR) => Math.max(...logF(30, 200, 40).map((f) => Math.abs(db(H(W({ qms: 3, ampR }), f)) - db(H(W({ qms: 10, ampR }), f)))));
  check(dq(0.05) < 1 && dq(10) > 3 * dq(0.05), 'Mechanical Q: barely matters on a solid-state amp, more on a high output impedance', `at most ${dq(0.05).toFixed(2)} dB at 0.05 Ω, ${dq(10).toFixed(2)} dB at 10 Ω, Qms 3 against 10`);
  const ratio = fcOf({ vas: 0.1 }) / fcOf({ vas: 0.025 }), want = Math.sqrt((1 + 8 * 0.1 / 0.2) / (1 + 8 * 0.025 / 0.2));
  check(Math.abs(ratio / want - 1) < 0.02, 'Compliance volume: the box\'s resonance rises as √(1 + Vas/Vb)', `${ratio.toFixed(3)} against ${want.toFixed(3)}`);
  const re = db(H(W({ re: 11.2 }), 300) / H(W({ re: 5.6 }), 300));
  check(re < -2 && re > -3.5, 'Coil resistance: twice as much, a little quieter for the same volts (half the watts)', `${re.toFixed(2)} dB`);
  const le = db(H(W({ le: 3e-3 }), 3000)) - db(H(W({ le: 0.8e-3 }), 3000)), corner = 5.6 / (2 * Math.PI * 0.8e-3);
  check(le < -6 && Math.abs(corner - 1100) < 20, `Coil inductance: more, a darker top (the corner Re/(2πLe) is ${corner.toFixed(0)} Hz)`, `${le.toFixed(1)} dB at 3 kHz with 3 mH`);
  const sdx = cppResponse(W({ sd: 0.07 }), [41]).x[0] / cppResponse(W({ sd: 0.035 }), [41]).x[0], sdh = db(H(W({ sd: 0.07 }), 300) / H(W({ sd: 0.035 }), 300));
  check(Math.abs(sdx - 0.5) < 0.05 && Math.abs(sdh) < 0.3, 'Cone area: twice the area, the same sound with half the travel', `${sdx.toFixed(3)} × the travel at 41 Hz, ${sdh.toFixed(2)} dB at 300 Hz`);
  const tube = bump({ ampR: 4 }) - bump({ ampR: 0.05 });
  check(tube > 2, 'Amp output impedance: a tube amp\'s few ohms swell the bump at the box\'s resonance', `+${tube.toFixed(1)} dB at 4 Ω`);
}

// 7. the page's messages: the cone's travel every 2 ms
{
  const r = run(W({ drive: 40 }), sine(41.2, fs, fs, 0.3));
  const m = r.messages, xsAll = m.flatMap((q) => Array.from(q.values.slice(0, 20)));
  check(m.length >= 24 && xsAll.length === 20 * m.length && m.every((q) => q.values[20] >= Math.max(...q.values.slice(0, 20).map(Math.abs)) - 1e-9), 'a message every 40 ms: twenty points of the cone\'s travel, and its peak', `${m.length} in 1 s, peak ${(1e3 * Math.max(...m.map((q) => q.values[20]))).toFixed(2)} mm`);
}

// 8. the test bass through a cabinet keeps its pitch
const TB = await loadBass();
{
  const b = new TB(fs); b.note(33, 0.8);
  const dry = new Float32Array(fs); b.process(dry);
  const y = run(W({}), dry).L, f0 = tune(y.subarray(4800, 4800 + 16384), fs), want = tune(dry.subarray(4800, 4800 + 16384), fs);
  check(f0 && want && Math.abs(1200 * Math.log2(f0 / want)) < 2 && peak(y) > 0.3 * peak(dry), 'the test bass\'s A through the 8 × 10 keeps its pitch, at about its level', `${f0?.toFixed(3)} Hz for ${want?.toFixed(3)} Hz; peak ${db(peak(y) / peak(dry)).toFixed(1)} dB`);
}

// 9. hygiene
{
  const r = run(W({}), new Float32Array(fs));
  check(peak(r.L) === 0, 'silence in, silence out');
  const e = new Effect(fs);
  e.setParams(W({}));
  const bad = new Float32Array(128); bad[5] = NaN;
  const L = new Float32Array(4096), R = new Float32Array(4096);
  const ok = e.process(bad, L.subarray(0, 128), R.subarray(0, 128));
  e.process(sine(100, fs, 4096, 0.1), L, R);
  check(!ok && L.every(Number.isFinite) && peak(L) > 0.01, 'a NaN in comes out as a silent block, and the pedal recovers');
  e.destroy();
  check(r.latency === 0 && r.R.every((v, i) => v === r.L[i]), 'no latency, mono out on both sides');
  const stiff = gainAt(W({ le: 0.1e-3, re: 16 }), 300);
  check(Number.isFinite(stiff) && Math.abs(db(stiff) - db(H(W({ le: 0.1e-3, re: 16 }), 300))) < 0.05, 'a short coil time constant (16 Ω, 0.1 mH) stays stable: the engine takes smaller steps');
  const ids = new Map(PEDAL.groups.flatMap((g) => g.params).map((p) => [p.id, p]));
  const badP = Object.entries(PEDAL.presets).flatMap(([n, v]) => Object.entries(v).filter(([id, val]) => !ids.has(id) || (typeof val === 'number' && (val < ids.get(id).min || val > ids.get(id).max))).map(([id]) => `${n}: ${id}`));
  check(!badP.length, 'every preset sets real parameters inside their ranges', badP.join(', '));
}

// 10. CPU
if (!CI) {
  const quiet = (pre) => {
    const e = new Effect(fs); e.setParams(W({}));
    const L = new Float32Array(fs), R = new Float32Array(fs);
    if (pre) { e.process(sine(41.2, fs, fs, 0.3), L, R); for (let k = 0; k < 20; k++) e.process(new Float32Array(fs), L, R); }
    const t0 = performance.now(); for (let k = 0; k < 4; k++) e.process(new Float32Array(fs), L, R); const ms = performance.now() - t0;
    e.destroy(); return ms / 4;
  };
  quiet(false);
  const after = quiet(true), rest = quiet(false);
  check(after < 2 * rest + 1, 'CPU: the silence after a note costs what silence from rest does (no denormals)', `${after.toFixed(1)} ms a second after a note, ${rest.toFixed(1)} ms from rest`);
  const n = 10 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 41.2 * i) / fs) * Math.exp(-(i % fs) / fs));
  const e = new Effect(fs); e.setParams(preset('4 × 10 ported'));
  const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
  e.process(inp, L, R);
  const share = (performance.now() - t0) / 1000 / 10;
  e.destroy();
  check(share < 0.03, 'CPU: under 3 % of a core (WebAssembly)', `${(100 * share).toFixed(2)} %`);
}

done();
