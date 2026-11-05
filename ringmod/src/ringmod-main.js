// ringmod-main.js — the Ring Modulator's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, freqAxes, animate } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './ringmod-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ model, for the views
const N = 256; // points across one cycle of the carrier

const call = (P, fn, extra = []) => {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  if (extra.length) s.f64(extra.length, 8 * v.length).set(extra);
  fn(s.at);
  return (k, off) => Array.from(s.f64(k, 8 * (v.length + off)));
};
function parts(P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  model.ringmod_parts(s.at);
  const [Rs, Rc, RL, L, is, nvt, is1, rise, makeup, gain] = s.f64(10);
  return { Rs, Rc, RL, L, is, nvt, is1, rise, makeup, gain };
}
// one cycle of the carrier in its steady state, and the switching function and the leak at each point
function cycle(P) {
  const r = call(P, (at) => model.ringmod_cycle(at, N));
  return { vcar: r(N, 0), g: r(N, N), w0: r(N, 2 * N) };
}
// the ring solved for one input and carrier voltage, as built: u, vc, w, and the diodes' currents
function solve(P, vin, vcar) {
  const r = call(P, (at) => model.ringmod_ring(at, 1), [600, 470, 600, vin, vcar]);
  return r(7, 5);
}
// the complex Fourier coefficient m of one cycle
function coefficient(x, m) {
  let re = 0, im = 0;
  x.forEach((v, i) => { const a = (-2 * Math.PI * m * i) / x.length; re += v * Math.cos(a); im += v * Math.sin(a); });
  return Math.hypot(re, im) / x.length;
}
const mA = (i) => (Math.abs(i) < 1e-3 ? `${(1e6 * i).toFixed(0)} µA` : `${(1e3 * i).toFixed(1)} mA`).replace('-', '−');
const hz = (f) => (f >= 1000 ? `${(f / 1000).toFixed(2)} kHz` : f >= 100 ? `${f.toFixed(0)} Hz` : `${f.toFixed(1)} Hz`);

// The ring: the four diodes between the transformers, each lit by its current as you play, and
// what comes out against what goes in: w = ±u, the sign the carrier's.
const ringView = {
  title: 'The ring',
  caption: 'the four diodes between the two transformers, each lit by the current through it as you play: when the carrier swings positive it drives current through the top and bottom diodes, D1 and D3, and the bass passes straight across; when it swings negative, through the crossed pair, D2 and D4, which connect the transformers the other way round, and the bass comes out upside down. On the right, the voltage out of the ring, w, against the bass going in, u, as you play: the dots lie along the two lines w = +u and w = −u, coloured by the carrier\'s sign. The ring is a switch that multiplies the bass by the sign of the carrier.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const trail = [], KEEP = 400;
    let lastI = [0, 0, 0, 0], slope = 0.5, lastCar = 0;
    const update = () => {
      const P = api.P, amp = P.carrierLevel;
      // the line the dots follow: w / u for a small u with the carrier at its peak
      const r = solve(P, 0.01, amp);
      slope = Math.abs(r[2] / 0.01);
      const on = solve(P, 0, amp);
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>carrier + : D1 and D3 on, w = +u</span><span><i style="background:${css('--accent-2')}"></i>carrier − : D2 and D4 on, w = −u</span><span>at the carrier's peak, ${mA(on[3])} through each diode that is on; w = ±${slope.toFixed(2)} × the bass into T1</span>`;
    };
    const diode = (g, x0, y0, x1, y1, current, label, at = 0.5) => {
      const ang = Math.atan2(y1 - y0, x1 - x0), cx = x0 + (x1 - x0) * at, cy = y0 + (y1 - y0) * at, s = 9;
      const b = current > 0 ? Math.min(1, Math.max(0, (Math.log10(current) + 6) / 4)) : 0; // lit from 1 µA, bright by 10 mA
      g.save();
      g.translate(cx, cy); g.rotate(ang);
      g.shadowColor = css('--accent'); g.shadowBlur = 18 * b;
      g.fillStyle = css('--accent'); g.globalAlpha = 0.15 + 0.85 * b;
      g.beginPath(); g.moveTo(-s, -s); g.lineTo(-s, s); g.lineTo(s, 0); g.closePath(); g.fill();
      g.globalAlpha = 1; g.shadowBlur = 0;
      g.strokeStyle = css('--ink'); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-s, -s); g.lineTo(-s, s); g.lineTo(s, 0); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(s, -s); g.lineTo(s, s); g.stroke();
      g.restore();
      g.fillStyle = css('--ink-2'); g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText(label, cx + 16 * Math.sin(ang), cy - 14 * Math.cos(ang) + 4);
    };
    const coil = (g, x, y0, y1, side) => {
      const n = 6, r = (y1 - y0) / (2 * n);
      g.beginPath();
      for (let k = 0; k < n; k++) g.arc(x, y0 + r * (2 * k + 1), r, -Math.PI / 2, Math.PI / 2, side < 0);
      g.stroke();
    };
    const draw = () => {
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const wide = w > 560;
      const ring = wide ? { l: 0, t: 0, w: w * 0.55, h } : { l: 0, t: 0, w, h: h * 0.6 };
      const plot = wide ? { l: w * 0.58, t: 8, r: w - 10, b: h - 24 } : { l: 46, t: h * 0.62, r: w - 10, b: h - 20 };
      // the ring
      // T1's ends A (top) and B, T2's C (top) and D; room underneath for the carrier and ground
      const half = Math.max(18, Math.min((ring.h - 52) / 2, ring.w * 0.2)), midY = ring.t + 18 + half;
      const xA = ring.l + ring.w * 0.3, xC = ring.l + ring.w * 0.7, yT = midY - half, yB = midY + half;
      g.lineWidth = 1.5; g.strokeStyle = css('--ink-2');
      // T1 (secondary) and T2 (primary), with their partners drawn beside them
      coil(g, xA - 6, yT, yB, -1); coil(g, xA - 22, yT, yB, 1);
      coil(g, xC + 6, yT, yB, 1); coil(g, xC + 22, yT, yB, -1);
      g.beginPath();
      g.moveTo(xA - 14, yT - 4); g.lineTo(xA - 14, yB + 4); g.moveTo(xC + 14, yT - 4); g.lineTo(xC + 14, yB + 4); // the cores
      g.moveTo(xA - 6, yT); g.lineTo(xA, yT); g.lineTo(xC, yT); g.lineTo(xC + 6, yT);
      g.moveTo(xA - 6, yB); g.lineTo(xA, yB); g.lineTo(xC, yB); g.lineTo(xC + 6, yB);
      g.moveTo(xC, yT); g.lineTo(xA, yB); g.moveTo(xC, yB); g.lineTo(xA, yT);
      // the centre taps: the carrier into T1's, T2's to ground
      g.moveTo(xA - 6, midY); g.lineTo(xA + 10, midY); g.lineTo(xA + 10, yB + 12);
      g.moveTo(xC + 6, midY); g.lineTo(xC - 10, midY); g.lineTo(xC - 10, yB + 14);
      g.moveTo(xC - 18, yB + 14); g.lineTo(xC - 2, yB + 14); g.moveTo(xC - 14, yB + 18); g.lineTo(xC - 6, yB + 18);
      g.stroke();
      g.beginPath(); g.arc(xA + 10, yB + 20, 8, 0, 2 * Math.PI); g.stroke();
      g.beginPath();
      for (let k = 0; k <= 20; k++) { const xx = xA + 5 + (10 * k) / 20, yy = yB + 20 - 4 * Math.sin((2 * Math.PI * k) / 20); k ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
      g.stroke();
      g.fillStyle = css('--ink-2'); g.font = '11px system-ui, sans-serif';
      g.textAlign = 'right'; g.fillText('bass in', xA - 30, midY + 4);
      g.textAlign = 'left'; g.fillText('out', xC + 30, midY + 4);
      g.fillText(`carrier ${lastCar >= 0 ? '+' : '−'}`, xA + 22, yB + 24);
      g.textAlign = 'center'; g.fillText('T1', xA - 14, yT - 10); g.fillText('T2', xC + 14, yT - 10);
      // the diodes: D1 A→C, D2 C→B, D3 B→D, D4 D→A
      diode(g, xA, yT, xC, yT, lastI[0], 'D1');
      diode(g, xC, yT, xA, yB, lastI[1], 'D2', 0.24);
      diode(g, xA, yB, xC, yB, lastI[2], 'D3');
      diode(g, xC, yB, xA, yT, lastI[3], 'D4', 0.24);
      // w against u
      const big = Math.max(0.05, ...trail.map(([u]) => Math.abs(u))) * 1.15, wb = big * Math.max(slope, 0.2) * 1.3;
      const X = (u) => plot.l + ((plot.r - plot.l) * (u + big)) / (2 * big);
      const Y = (v) => (plot.t + plot.b) / 2 - ((plot.b - plot.t) / 2) * Math.max(-1.05, Math.min(1.05, v / wb));
      g.strokeStyle = css('--grid'); g.lineWidth = 1;
      g.strokeRect(plot.l, plot.t, plot.r - plot.l, plot.b - plot.t);
      g.beginPath(); g.moveTo(X(0), plot.t); g.lineTo(X(0), plot.b); g.moveTo(plot.l, Y(0)); g.lineTo(plot.r, Y(0)); g.stroke();
      g.setLineDash([4, 4]);
      for (const [s, c] of [[1, '--accent'], [-1, '--accent-2']]) { g.strokeStyle = css(c); g.globalAlpha = 0.5; g.beginPath(); g.moveTo(X(-big), Y(-s * slope * big)); g.lineTo(X(big), Y(s * slope * big)); g.stroke(); }
      g.setLineDash([]); g.globalAlpha = 1;
      g.fillStyle = css('--ink-2'); g.textAlign = 'center';
      g.fillText(`u (V), ±${big.toFixed(2)}`, (plot.l + plot.r) / 2, plot.b + 14);
      g.textAlign = 'left'; g.fillText('w ↑', plot.l + 4, plot.t + 12);
      trail.forEach(([u, ww, c], j) => { g.fillStyle = css(c >= 0 ? '--accent' : '--accent-2'); g.globalAlpha = 0.15 + (0.85 * j) / trail.length; g.fillRect(X(u) - 1.5, Y(ww) - 1.5, 3, 3); });
      g.globalAlpha = 1;
    };
    api.on('params', () => { update(); draw(); });
    api.on('pedal', (messages) => {
      for (const m of messages) {
        if (m.type !== 1) continue;
        for (let j = 0; j < 4; j++) {
          const v = m.values.slice(7 * j, 7 * j + 7);
          trail.push([v[1], v[2], v[0]]);
          lastI = [v[3], v[4], v[5], v[6]]; lastCar = v[0];
        }
      }
      if (trail.length > KEEP) trail.splice(0, trail.length - KEEP);
    });
    animate(canvas, draw);
    update();
  },
};

// The sidebands: the switching function the bass is multiplied by, over two cycles of the carrier,
// and what it does to the note you play: the lines at f ± fc, 3fc ± f, ...
const sidebandView = {
  title: 'The sidebands',
  caption: 'above, the carrier (dashed) and what the ring multiplies the bass by as it swings (solid): the change in the output for a change in the input, from the circuit\'s equations at each instant. A strong carrier makes it a square wave, +½ and −½ (the transformers\' 600 Ω into their 600 Ω load halve it); a weak one, a copy of the carrier, as the diodes multiply smoothly. Below, where that sends the note you play, f (dashed, at 0 dB, no longer there): to f + fc and |f − fc|, and, from a square switching function\'s odd harmonics, to 3fc ± f, 5fc ± f, a third and a fifth as loud. In grey, the carrier itself, leaking through the mismatched diode, against a 0.3 V note.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let cyc, pp, C, Cw, P;
    const update = () => {
      P = api.P; pp = parts(P); cyc = cycle(P);
      C = Array.from({ length: 10 }, (_, m) => coefficient(cyc.g, m));
      Cw = Array.from({ length: 10 }, (_, m) => coefficient(cyc.w0, m));
      const f = api.note?.f ?? 55, fc = P.carrier;
      const wet = P.mix * pp.makeup;
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>f + fc = ${hz(f + fc)}, |f − fc| = ${hz(Math.abs(f - fc))}, each ${(20 * Math.log10(wet * C[1])).toFixed(1)} dB</span><span>3fc ± f: ${(20 * Math.log10(wet * C[3])).toFixed(1)} dB</span><span>${api.note?.f ? 'for the note you are playing' : 'for the A at 55 Hz, until you play'}; above, two cycles of the carrier, ±${P.carrierLevel.toFixed(2)} V</span>`;
    };
    const draw = () => {
      if (!cyc) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      // above: two cycles of the carrier and of the switching function
      const top = { l: 46, r: w - 10, t: 8, b: Math.round(h * 0.36) };
      const gmax = Math.max(0.05, ...cyc.g.map(Math.abs)) * 1.15, amp = Math.max(...cyc.vcar.map(Math.abs)) || 1;
      const X = (i) => top.l + ((top.r - top.l) * i) / (2 * N);
      const Y = (v) => (top.t + top.b) / 2 - ((top.b - top.t) / 2) * (v / gmax);
      g.strokeStyle = css('--grid'); g.lineWidth = 1;
      g.strokeRect(top.l, top.t, top.r - top.l, top.b - top.t);
      g.beginPath(); g.moveTo(top.l, Y(0)); g.lineTo(top.r, Y(0)); g.stroke();
      g.strokeStyle = css('--ink-2'); g.setLineDash([4, 3]); g.beginPath();
      for (let i = 0; i <= 2 * N; i++) { const v = cyc.vcar[i % N] / amp * gmax * 0.9; i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v)); }
      g.stroke(); g.setLineDash([]);
      g.strokeStyle = css('--accent'); g.lineWidth = 2; g.beginPath();
      for (let i = 0; i <= 2 * N; i++) { const v = cyc.g[i % N]; i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v)); }
      g.stroke(); g.lineWidth = 1;
      g.fillStyle = css('--ink-2'); g.font = '11px system-ui, sans-serif'; g.textAlign = 'right';
      g.fillText(`+${gmax.toFixed(2)}`, top.l - 4, top.t + 9); g.fillText(`−${gmax.toFixed(2)}`, top.l - 4, top.b);
      // below: the lines, in dB against the note
      g.save(); g.translate(0, Math.round(h * 0.42));
      const { x, y, box } = freqAxes(g, w, h - Math.round(h * 0.42), { fmin: 10, fmax: 20000, dbMin: -60, dbMax: 6, step: 12 });
      const f = api.note?.f ?? 55, fc = P.carrier, wet = P.mix * pp.makeup;
      const stick = (fr, a, colour, dash = false) => {
        if (!(fr >= 10 && fr <= 20000) || !(a > 0)) return;
        const Y0 = y(Math.max(-60, 20 * Math.log10(a)));
        g.strokeStyle = colour; g.lineWidth = 2.5; g.setLineDash(dash ? [4, 3] : []);
        g.beginPath(); g.moveTo(x(fr), box.b); g.lineTo(x(fr), Math.max(box.t, Y0)); g.stroke();
        g.setLineDash([]); g.lineWidth = 1;
      };
      stick(f, 1, css('--good'), true);
      const dry = Math.abs(1 - P.mix + wet * C[0]);
      if (dry > 1e-3) stick(f, dry, css('--good'));
      for (let m = 1; m < 10; m++) for (const s of [1, -1]) stick(Math.abs(f + s * m * fc), wet * C[m], css('--accent'));
      for (let m = 1; m < 10; m++) stick(m * fc, (wet * Cw[m]) / 0.3, css('--ink-2'));
      g.restore();
    };
    api.on('params', () => { update(); draw(); });
    let lastF = 0;
    animate(canvas, () => { const f = api.note?.f ?? 0; if (Math.abs(f - lastF) > 0.5) { lastF = f; update(); } draw(); });
    update();
  },
};

const SCOPE = 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. With a strong carrier the bass comes out chopped: each time the carrier changes sign, the output flips upside down, so it is the bass times a square wave. With the carrier slow, a few hertz, you can watch it flip; at a few hundred, the flips are faster than the bass and the two make a new waveform with neither\'s period.';
const SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts (0 dBV is a sine of 1 V peak): each partial of the bass at f leaves for f + fc and |f − fc|, the carrier at fc; the note itself is gone, and so, but for the mismatched diode\'s leak, is the carrier. The green line is the note you are playing, and the ticks along the top its harmonics, which the output no longer lines up with unless the carrier is a whole number of times the note.';

createPedal({ PEDAL, worklet: new URL('./ringmod-worklet.js', import.meta.url), views: [ringView, sidebandView, scopeView({ caption: SCOPE }), spectrumView({ caption: SPECTRUM })] });
