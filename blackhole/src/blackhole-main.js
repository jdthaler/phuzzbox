// blackhole-main.js — the Black Hole's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, animate, markNote } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './blackhole-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ modes, for the views
const COLOURS = ['--accent', '#60a5fa', '#a78bfa', '#34d399'];
const colour = (k) => (COLOURS[k].startsWith('--') ? css(COLOURS[k]) : COLOURS[k]);

// the four modes as the engine rings them
function modesOf(P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  model.blackhole_modes(s.at);
  const o = s.f64(42);
  return { a: o[0], gain: o[1], modes: Array.from({ length: 4 }, (_, k) => { const q = o.slice(2 + 10 * k, 12 + 10 * k); return { l: q[0], m: q[1], n: q[2], f: q[3], gamma: q[4], Q: q[5], amp: q[6], plus: q[7], cross: q[8], on: q[9] }; }) };
}
const label = (md) => `(${md.l},${md.m},${md.n})`;

// The modes: each mode's frequency and how long it rings, as the spin goes from 0 to six nines.
const FMIN = 10, FMAX = 4000, TMIN = 1e-3, TMAX = 10;
const modesView = {
  title: 'The modes',
  caption: 'the hole\'s four modes, each at its frequency (across) and its decay time 1/γ (up), the dot as large as the merger rings it. The lines are where each mode goes as the spin runs from none (bottom left of each) to six nines: the l = m modes climb toward 2 : 3 : 4 times the horizon\'s spin and ring longer and longer. The green line is the note you are playing: a mode near it rings with it.',
  perform: true,
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let now = null, paths = null;
    const compute = () => {
      now = modesOf(api.P);
      paths = [0, 1, 2, 3].map(() => []);
      for (let u = 0; u <= 6.001; u += 0.1) modesOf({ ...api.P, nines: u }).modes.forEach((md, k) => paths[k].push(md));
      const lead = now.modes[0];
      legend.innerHTML = `<span style="color:var(--accent)">● (2,2,0) ${lead.f.toFixed(1)} Hz, Q ${lead.Q.toFixed(1)}, rings ${(1000 / lead.gamma).toFixed(1)} ms</span><span>a = ${now.a.toFixed(Math.max(2, Math.ceil(api.P.nines) + 1))}</span>`;
    };
    api.on('params', compute);
    animate(canvas, () => {
      if (!now) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const box = { l: 44, r: w - 10, t: 10, b: h - 20 };
      const x = (f) => box.l + ((box.r - box.l) * Math.log(f / FMIN)) / Math.log(FMAX / FMIN);
      const y = (t) => box.b - ((box.b - box.t) * Math.log(t / TMIN)) / Math.log(TMAX / TMIN);
      g.strokeStyle = css('--grid'); g.fillStyle = css('--ink-2'); g.lineWidth = 1; g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
      for (const f of [10, 30, 100, 300, 1000, 3000]) { g.beginPath(); g.moveTo(x(f), box.t); g.lineTo(x(f), box.b); g.stroke(); g.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x(f), h - 5); }
      g.textAlign = 'right';
      const every = (box.b - box.t) / 4 < 14 ? 2 : 1;
      [[1e-3, '1 ms'], [1e-2, '10 ms'], [0.1, '0.1 s'], [1, '1 s'], [10, '10 s']].forEach(([t, s], i) => { g.beginPath(); g.moveTo(box.l, y(t)); g.lineTo(box.r, y(t)); g.stroke(); if (i % every === 0) g.fillText(s, box.l - 4, y(t) + 4); });
      const clip = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      paths.forEach((p, k) => {
        g.beginPath(); g.strokeStyle = colour(k); g.globalAlpha = 0.45; g.lineWidth = 1.5;
        p.forEach((md, i) => { const X = clip(x(md.f), box.l, box.r), Y = clip(y(1 / md.gamma), box.t, box.b); i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
        g.stroke(); g.globalAlpha = 1;
      });
      // the dots, quietest first; each labelled where there is room (the loudest first)
      const at = now.modes.map((md, k) => ({ md, k, X: x(md.f), Y: y(1 / md.gamma) })).filter((d) => d.X >= box.l && d.X <= box.r && d.Y >= box.t && d.Y <= box.b);
      [...at].reverse().forEach(({ md, k, X, Y }) => { g.beginPath(); g.arc(X, Y, 3 + 7 * Math.sqrt(md.amp), 0, 2 * Math.PI); g.fillStyle = colour(k); g.globalAlpha = md.amp > 0 ? 1 : 0.3; g.fill(); g.globalAlpha = 1; });
      const placed = [];
      g.textAlign = 'left';
      for (const { md, k, X, Y } of at) {
        const lx = X + 4 + 7 * Math.sqrt(md.amp), ly = k ? Y - 6 : Y + 14, wide = g.measureText(label(md)).width;
        if (lx + wide > box.r || placed.some((p) => Math.abs(p.y - ly) < 12 && lx < p.x + p.w && p.x < lx + wide)) continue;
        placed.push({ x: lx, y: ly, w: wide });
        g.fillStyle = colour(k); g.fillText(label(md), lx, ly);
      }
      markNote(g, x, box, api.note);
    });
    compute();
  },
};

// The ringing: a click's h₊ and h×, as the engine rings it.
const ringView = {
  title: 'The ringing',
  caption: 'what one click does to the hole: the strain it rings with, h₊ (orange, the left channel) and h× (blue, the right), each mode a decaying spiral e^{−iωt} seen through its spin-weighted harmonic at your inclination. Without spin it is gone in two cycles; near the limit it rings on, a bell.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    let curve = null, span = 0;
    const compute = () => {
      const { modes, gain } = modesOf(api.P), live = modes.filter((md) => md.on);
      span = Math.min(2, Math.max(0.02, 5 / Math.min(...live.map((md) => md.gamma))));
      const n = 600; curve = { p: new Float64Array(n), x: new Float64Array(n) };
      for (let i = 0; i < n; i++) {
        const t = (span * i) / (n - 1);
        for (const md of live) { const env = Math.exp(-md.gamma * t), ph = -2 * Math.PI * md.f * t; curve.p[i] += gain * md.plus * env * Math.cos(ph); curve.x[i] += gain * md.cross * env * Math.sin(ph); }
      }
    };
    api.on('params', compute);
    animate(canvas, () => {
      if (!curve) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const box = { l: 10, r: w - 10, t: 10, b: h - 20 }, big = Math.max(1e-12, ...curve.p.map(Math.abs), ...curve.x.map(Math.abs));
      const X = (i) => box.l + ((box.r - box.l) * i) / (curve.p.length - 1), Y = (v) => (box.t + box.b) / 2 - ((box.b - box.t) / 2) * (v / big);
      g.strokeStyle = css('--grid'); g.lineWidth = 1; g.beginPath(); g.moveTo(box.l, Y(0)); g.lineTo(box.r, Y(0)); g.stroke();
      for (const [arr, c] of [[curve.x, '#60a5fa'], [curve.p, css('--accent')]]) { g.beginPath(); g.strokeStyle = c; g.lineWidth = 1.8; arr.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v)))); g.stroke(); }
      g.fillStyle = css('--ink-2'); g.font = '11px system-ui, sans-serif'; g.textAlign = 'right';
      g.fillText(span >= 0.1 ? `${span.toFixed(2)} s` : `${(1000 * span).toFixed(0)} ms`, box.r, h - 5);
    });
    compute();
  },
};

const BH_SCOPE = 'the voltage at the input (dashed) and the left channel, h₊ (solid), as you play, each scaled to fit. With little spin the hole only colours each note; near the limit it rings on after it.';
const BH_SPECTRUM = 'what goes in (dashed) and what comes out on the left (solid), in dB of volts: the hole lifts the frequencies near its modes, broadly without spin and in sharp peaks near the limit. The green line is the note you are playing, and the ticks its harmonics.';

createPedal({ PEDAL, worklet: new URL('./blackhole-worklet.js', import.meta.url), views: [modesView, ringView, spectrumView({ caption: BH_SPECTRUM }), scopeView({ caption: BH_SCOPE })] });
