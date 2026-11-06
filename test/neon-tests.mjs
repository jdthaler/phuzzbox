// neon-tests.mjs — the Neon Tremolo against its physics worked out independently of the C++
// (test/neon-circuit.mjs: breakdown from Townsend's condition solved numerically, the oscillator by
// Runge–Kutta, the cell by Runge–Kutta in small steps, the divider by Ohm's law), the engine's
// flashes against the period in closed form, and each knob's hint.

import { check, done, CI } from './harness.mjs';
import { loadPedal } from '../tools/engine.mjs';
import { scratch } from '../shared/wasm.js';
import { defaults } from '../shared/params.js';
import { GASES, BALLAST, HOLD, IREF, RDARK, breakdown, minimum, lamp, oscillate, period, cellRun, cellR, divider } from './neon-circuit.mjs';

const { PEDAL, Effect } = await loadPedal('neon');
const x = Effect.exports;
const fs = 48000;
const D = { ...defaults(PEDAL.groups), level: 0 };
const W = (over) => ({ ...D, ...over });
const dB = (g) => 20 * Math.log10(g);

// the C++ model through its exports
function call(fn, P, extra = [], args = []) {
  const s = scratch(x), v = P ? Effect.native(P) : [];
  if (v.length) s.f64(v.length).set(v);
  if (extra.length) s.f64(extra.length, 8 * v.length).set(extra);
  x[fn](s.at, ...args);
  return { n: v.length, read: (count, at = 0) => Array.from(s.f64(count, 8 * at)) };
}
const cppParts = (P) => {
  const r = call('neon_parts', P).read(28);
  return { Vb: r[0], Vm: r[1], Ve: r[2], pdMin: r[3], period: r[4], charge: r[5], flash: r[6], never: r[7], steady: r[8], Vs: r[9], R: r[10], C: r[11], Vmin: r[27] };
};
const cppPaschen = (P, pds) => { const n = pds.length, c = call('neon_paschen', P, pds, [n]), r = c.read(3 * n, c.n + n); return { ne: r.slice(0, n), he: r.slice(n, 2 * n), ar: r.slice(2 * n) }; };
// the oscillator stepped by the C++, in pieces of 2000 steps (the scratch area holds 8192 numbers)
function cppRun(P, v0, lit, dt, n) {
  const v = [], q = [];
  let strikes = 0;
  for (let at = 0; at < n; at += 2000) {
    const m = Math.min(2000, n - at), c = call('neon_run', P, [v0, lit ? 1 : 0, dt], [m]), r = c.read(2 * m + 2, c.n + 3);
    v.push(...r.slice(0, m)); q.push(...r.slice(m, 2 * m)); strikes += r[2 * m];
    v0 = r[m - 1]; lit = r[2 * m + 1] > 0.5;
  }
  return { v, q, strikes };
}
const cppCell = (P, n0, dt, lights) => { const n = lights.length, c = call('neon_cell', P, [n0, dt, ...lights], [n]); return c.read(n, c.n + 2 + n); };
const circuit = (P) => ({ Vs: P.supply, R: P.rate, C: P.cap, ...lamp(P) });

// the engine on a steady 1 V, in blocks of a second: its gain at each sample
function gains(P, seconds) {
  const e = new Effect(fs);
  e.setParams(P);
  const n = Math.round(seconds * fs), inp = new Float32Array(n).fill(1), L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i += fs) e.process(inp.subarray(i, i + fs), L.subarray(i, i + fs), R.subarray(i, i + fs));
  e.destroy();
  return L;
}
// the deepest dip and the top, in dB, after the first second
const swing = (L) => { let lo = Infinity, hi = -Infinity; for (let i = fs; i < L.length; i++) { lo = Math.min(lo, L[i]); hi = Math.max(hi, L[i]); } return { lo: dB(lo), hi: dB(hi) }; };
// the flashes: where the gain starts to fall steeply
function flashes(L) {
  const t = [];
  for (let i = 1; i < L.length; i++) if (L[i] < L[i - 1] * (1 - 2e-3) && !(L[i - 1] < L[i - 2] * (1 - 2e-3))) t.push(i / fs);
  return t;
}

// 1. Paschen's curve: the closed form against Townsend's condition solved for V
{
  const pds = [0.3, 0.5, 0.8, 1, 1.5, 2, 3, 5, 10, 20, 30];
  let worst = 0, walls = 0, agree = 0;
  for (const gamma of [0.01, 0.05, 0.3, 0.5]) {
    const c = cppPaschen(W({ gamma }), pds);
    for (const gas of Object.keys(GASES)) pds.forEach((pd, i) => {
      const want = breakdown(gas, pd, gamma), got = c[gas][i];
      if (!Number.isFinite(want)) { walls++; if (!Number.isFinite(got)) agree++; return; }
      worst = Math.max(worst, Math.abs(got / want - 1));
    });
  }
  check(worst < 1e-9, 'Paschen\'s law is Townsend\'s condition γ (e^(αd) − 1) = 1 solved for V, for neon, helium and argon', `worst ${worst.toExponential(1)}`);
  check(walls > 0 && agree === walls, 'left of the curve\'s wall, both say nothing strikes', `${agree} of ${walls}`);
}

// 2. the minimum, where the lamp burns
{
  let worst = 0;
  for (const gas of Object.keys(GASES)) for (const gamma of [0.01, 0.05, 0.3, 0.5]) {
    const m = minimum(gas, gamma), p = cppParts(W({ gas, gamma }));
    worst = Math.max(worst, Math.abs(p.Vmin / m.V - 1), Math.abs(p.Vm / ((3 / Math.E) * m.V) - 1), Math.abs(p.pdMin / m.pd - 1) / 1e3);
  }
  check(worst < 1e-9, 'the curve\'s minimum is e (B/A) ln(1 + 1/γ), found by search, and the lamp burns from 3/e of it', `worst ${worst.toExponential(1)}`);
  const at = (gamma) => cppParts(W({ gamma })).Vmin, p = cppParts(D);
  check(Math.abs(at(0.3) - 100) < 0.5 && Math.abs(at(0.05) - 207) < 0.5 && Math.abs(at(0.01) - 314) < 0.5 && Math.abs(p.pdMin - 1) < 0.01,
    'the Cathode γ hint: neon\'s minimum is 100 V at 0.3, near 1 Torr·cm, 207 V at 0.05 and 314 V at 0.01', `${at(0.3).toFixed(2)}, ${at(0.05).toFixed(2)}, ${at(0.01).toFixed(2)} V; ${p.pdMin.toFixed(3)} Torr·cm`);
  const g5 = cppParts(W({ gamma: 0.05 }));
  check(Math.abs(g5.Vb - 219) < 0.5 && Math.abs(g5.Vm - 228) < 0.5, 'the Cathode γ hint: at 0.05 the stock lamp strikes at 219 V but burns from 228 V', `${g5.Vb.toFixed(1)}, ${g5.Vm.toFixed(1)} V`);
  const v = (o) => cppParts(W(o));
  const ne = v({}), he = v({ gas: 'he' }), ar = v({ gas: 'ar' });
  check([[ne.Vb, 143], [ne.Vm, 110], [he.Vb, 56], [he.Vm, 50], [ar.Vb, 169], [ar.Vm, 66]].every(([a, b]) => Math.abs(a - b) < 0.5),
    'the Gas hint: neon strikes at 143 V and burns from 110, helium 56 and 50, argon 169 and 66', [ne, he, ar].map((p) => `${p.Vb.toFixed(1)}/${p.Vm.toFixed(1)}`).join(', '));
  const vb = (pd) => v({ pd }).Vb;
  check(Math.abs(vb(2) - 118) < 0.5 && Math.abs(vb(3) - 143) < 0.5 && Math.abs(vb(10) - 302) < 0.5 && !Number.isFinite(vb(0.36)) && Number.isFinite(vb(0.38)),
    'the Gap × pressure hint: 118 V at 2 Torr·cm, 143 at 3, 302 at 10; a wall at 0.37 Torr·cm', `${vb(2).toFixed(1)}, ${vb(3).toFixed(1)}, ${vb(10).toFixed(1)} V; ${vb(0.38).toFixed(0)} V at 0.38`);
  const one = v({ pd: 0.9966 });
  check(one.Vb - one.Ve < 0 && Math.abs(cppParts(D).Vm - 110) < 0.5, 'the Gap × pressure hint: the lamp burns from 110 V, so near the minimum it strikes below it, and cannot flash', `strikes ${one.Vb.toFixed(2)} V, goes out ${one.Ve.toFixed(2)} V`);
}

// 3. the oscillator: the exact steps against Runge–Kutta
for (const over of [{}, { gas: 'he', pd: 10, supply: 150 }, { cap: 1e-6, rate: 2.2e6 }, { supply: 300, rate: 4.7e6 }]) {
  const P = W(over), c = circuit(P), T = period(c), seconds = 3.2 * T, rk = oscillate(c, c.Ve, seconds, Math.min(1e-6, T / 2e5));
  const dt = 1 / fs, n = Math.ceil(seconds * fs), run = cppRun(P, c.Ve, false, dt, n);
  // the C++'s strikes, located within their steps by where its voltage turns down
  let charge = 0;
  const qs = [];
  let k0 = -1;
  for (let i = 0; i < n; i++) {
    const turned = i > 0 && run.v[i] < run.v[i - 1] && (i < 2 || run.v[i - 1] >= run.v[i - 2]);
    if (turned) { if (k0 >= 0) qs.push(charge); charge = 0; k0 = i; }
    charge += run.q[i];
  }
  check(run.strikes === rk.strikes.length, `${JSON.stringify(over)}: the exact steps strike as often as Runge–Kutta in ${seconds.toFixed(2)} s`, `${run.strikes}, ${rk.strikes.length}`);
  const gap = Math.abs(rk.strikes[2] - rk.strikes[1] - T) / T;
  check(gap < 1e-5, `${JSON.stringify(over)}: Runge–Kutta's period is the closed form's, charging then flashing`, `${(1e3 * T).toFixed(3)} ms, off by ${gap.toExponential(1)}`);
  const pp = cppParts(P);
  check(Math.abs(pp.period / T - 1) < 1e-12, `${JSON.stringify(over)}: and the C++'s`, `${(1e3 * pp.period).toFixed(3)} ms, the flash ${(1e3 * pp.flash).toFixed(2)} ms`);
  const dq = Math.abs(qs[1] / rk.charges[0] - 1);
  check(dq < 1e-4, `${JSON.stringify(over)}: the charge each flash passes, C (Vb − Ve) and what the supply adds meanwhile`, `${(1e6 * qs[1]).toFixed(4)} µC against ${(1e6 * rk.charges[0]).toFixed(4)} µC, C ΔV ${(1e6 * c.C * (c.Vb - c.Ve)).toFixed(4)} µC`);
  // the voltage between strikes: the exact exponential against the Runge–Kutta at the same times
}

// 4. when it doesn't oscillate: R too small to let the glow go out, or the supply below the strike
{
  const p = cppParts(D), Rstar = (p.Vs - p.Vm) / HOLD - BALLAST;
  check(Math.abs(Rstar - 1.4e6) < 0.01e6, 'the Rate hint: below about 1.4 MΩ the supply holds the glow', `${(Rstar / 1e3).toFixed(1)} kΩ`);
  const runs = (R) => cppRun(W({ rate: R }), p.Ve, false, 1 / fs, 4 * fs).strikes;
  check(runs(0.98 * Rstar) === 1 && runs(1.02 * Rstar) > 1 && cppParts(W({ rate: 0.98 * Rstar })).steady === 1 && cppParts(W({ rate: 1.02 * Rstar })).steady === 0,
    'just below it the lamp strikes once and glows on; just above, it flashes', `${runs(0.98 * Rstar)}, ${runs(1.02 * Rstar)} strikes in 4 s`);
  const held = swing(gains(W({ rate: 0.6e6 }), 4)), dark = swing(gains(W({ supply: 130 }), 4));
  check(held.hi - held.lo < 0.01 && held.lo < -6, 'the glow held on: the bass held down, steady', `${held.lo.toFixed(2)} to ${held.hi.toFixed(2)} dB`);
  check(dark.hi - dark.lo < 1e-4 && Math.abs(dark.hi - dB(divider(RDARK, D.depth))) < 1e-3 && cppParts(W({ supply: 130 })).never === 1,
    'the Supply hint: below the strike, 143 V, it never fires and the bass passes untouched', `${dark.hi.toFixed(4)} dB`);
}

// 5. the rates the hints give, from the engine's own flashes
{
  const rate = (over) => { const f = flashes(gains(W(over), 9)).slice(1); return (f.length - 1) / (f.at(-1) - f[0]); };
  const want = (over) => 1 / cppParts(W(over)).period;
  let worst = 0;
  for (const over of [{}, { rate: 2.2e6, cap: 47e-9 }, { supply: 300 }, { gas: 'he', pd: 10, supply: 150 }]) worst = Math.max(worst, Math.abs(rate(over) / want(over) - 1));
  check(worst < 2e-4, 'the engine flashes at the closed form\'s rate', `worst ${worst.toExponential(1)}`);
  const f = (over) => 1 / cppParts(W(over)).period, T = (over) => cppParts(W(over)).period;
  check(Math.abs(f({}) - 3.4) < 0.05 && Math.abs(f({ rate: 2.2e6 }) - 7) < 0.15 && Math.abs(T({ rate: 47e6 }) - 3) < 0.06,
    'the Rate hint: 4.7 MΩ about 3.4 a second, 2.2 MΩ about 7, 47 MΩ once in 3 s', `${f({}).toFixed(3)}, ${f({ rate: 2.2e6 }).toFixed(2)} Hz, ${T({ rate: 47e6 }).toFixed(3)} s`);
  const hold = (Vs) => (Vs - cppParts(D).Vm) / HOLD - BALLAST;
  check(Math.abs(f({ supply: 150 }) - 1.25) < 0.01 && Math.abs(f({ supply: 300 }) - 10.9) < 0.05 && Math.abs(hold(400) - 5.8e6) < 0.05e6 && cppParts(W({ supply: 400 })).steady === 1,
    'the Supply hint: 150 V about 1.25 a second, 180 V 3.4, 300 V 10.9; at 400 V it needs more than 5.8 MΩ', `${f({ supply: 150 }).toFixed(3)}, ${f({ supply: 300 }).toFixed(3)} Hz, ${(hold(400) / 1e6).toFixed(2)} MΩ`);
  check(Math.abs(f({ cap: 10e-9 }) - 34) < 0.5 && Math.abs(T({ cap: 1e-6 }) - 3) < 0.05,
    'the Capacitor hint: 10 nF some 34 a second, 1 µF once in 3 s', `${f({ cap: 10e-9 }).toFixed(2)} Hz, ${T({ cap: 1e-6 }).toFixed(3)} s`);
  const fl = cppParts(D).flash;
  check(Math.abs(fl - 2.8e-3) < 0.05e-3, 'the README: the stock flash lasts 2.8 ms', `${(1e3 * fl).toFixed(2)} ms`);
}

// 6. the cell and the divider
{
  const tau = D.cell, dt = 1 / fs, lights = Array.from({ length: 4000 }, (_, i) => (i > 100 && i < 300 ? 8 * Math.exp(-(i - 100) / 48) : 0));
  const want = cellRun(0, lights, dt, tau), got = cppCell(D, 0, dt, lights);
  const worst = Math.max(...want.map((n, i) => Math.abs(got[i] - n))) / Math.max(...want);
  check(worst < 1e-4, 'the cell\'s electrons, Heun\'s method each sample against Runge–Kutta in small steps', `worst ${worst.toExponential(1)} of the peak`);
  // the engine's gain: its charges into the cell and the divider, sample by sample
  const P = D, c = circuit(P), seconds = 2, run = cppRun(P, c.Ve, false, dt, seconds * fs);
  const n = cellRun(0, run.q.map((q) => q / dt / IREF), dt, tau, 4), L = gains(P, seconds);
  const err = Math.max(...n.map((m, i) => Math.abs(dB(L[i]) - dB(divider(cellR(m), P.depth)))));
  check(err < 1e-3, 'the engine\'s gain is the divider with the cell the flashes light', `worst ${err.toExponential(1)} dB`);
  check(Math.abs(divider(RDARK, 0.9) - 0.9) < 0.02 && Math.abs(divider(RDARK, 1) - 0.9) < 0.02, 'the Level hint: dark, the divider passes nine tenths', `${divider(RDARK, 0.9).toFixed(3)}, ${divider(RDARK, 1).toFixed(3)}`);
}

// 7. the Depth and Cell hints, from the engine
{
  const dip = (over) => { const s = swing(gains(W(over), 5)); return s.hi - s.lo; };
  const d0 = dip({ depth: 0 }), d9 = dip({ depth: 0.9 }), d1 = dip({ depth: 1 });
  check(Math.abs(d9 - 11) < 0.2 && Math.abs(d1 - 13.4) < 0.2 && d0 < 0.5, 'the Depth hint: each flash ducks the bass about 11 dB at 90 %, 13.4 dB at full, under half a decibel at 0', `${d9.toFixed(2)}, ${d1.toFixed(2)}, ${d0.toFixed(2)} dB`);
  // the time from a flash's deepest dip to halfway back, in dB
  const back = (over) => {
    const L = gains(W(over), 5), f = flashes(L), i0 = Math.round(f[1] * fs);
    let k = i0; for (let i = i0; i < i0 + fs / 4; i++) if (L[i] < L[k]) k = i;
    const lo = dB(L[k]), hi = dB(divider(RDARK, D.depth));
    let j = k; while (j < L.length && dB(L[j]) < (lo + hi) / 2) j++;
    return (j - k) / fs;
  };
  const quick = back({ cell: 8e-3, rate: 22e6 }), stock = back({ rate: 22e6 }), slow = back({ cell: 120e-3, rate: 22e6 });
  check(Math.abs(quick - 12e-3) < 1e-3 && Math.abs(stock - 35e-3) < 1e-3 && Math.abs(slow - 107e-3) < 1e-3, 'the Cell hint: halfway back in about 12 ms at 8 ms, 35 ms at the stock 30 ms, 107 ms at 120 ms', `${(1e3 * quick).toFixed(1)}, ${(1e3 * stock).toFixed(1)}, ${(1e3 * slow).toFixed(1)} ms halfway back`);
}

// 8. messages and CPU
{
  const e = new Effect(fs);
  e.setParams(D);
  const n = fs, inp = new Float32Array(n), L = new Float32Array(n), R = new Float32Array(n);
  e.process(inp, L, R);
  const m = e.messages().filter((q) => q.type === 1);
  e.destroy();
  const vs = m.flatMap((q) => [0, 1, 2, 3, 4].map((j) => q.values[4 * j]));
  const peak = Math.max(...m.flatMap((q) => [0, 1, 2, 3, 4].map((j) => q.values[4 * j + 1])));
  const c = circuit(D);
  check(m.length >= 40 && Math.max(...vs) <= c.Vb + 1e-3 && Math.min(...vs) >= c.Ve - 1e-3 && Math.abs(peak - (c.Vb - c.Vm) / BALLAST * 1e3) < 0.3,
    'the engine reports the capacitor between Ve and Vb, and each flash\'s peak current', `${m.length} messages, ${Math.min(...vs).toFixed(1)}–${Math.max(...vs).toFixed(1)} V, ${peak.toFixed(2)} mA`);
}
if (!CI) {
  const n = 10 * fs, inp = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 82.4 * i) / fs));
  for (const P of [D, W({ rate: 0.5e6 }), W({ cap: 10e-9, rate: 0.9e6 })]) {
    const e = new Effect(fs);
    e.setParams(P);
    const L = new Float32Array(n), R = new Float32Array(n), t0 = performance.now();
    e.process(inp, L, R);
    const share = (performance.now() - t0) / 1000 / 10;
    e.destroy();
    check(share < 0.03, `CPU: R ${P.rate / 1e6} MΩ, C ${P.cap * 1e9} nF, under 3 % of a core (WebAssembly)`, `${(100 * share).toFixed(2)} %`);
  }
}

done();
