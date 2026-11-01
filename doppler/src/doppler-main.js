// doppler-main.js — the Doppler's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, animate } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './doppler-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ pass, for the views
const EAR = 0.0875;

// one pass as the controls make it: the geometry, and the pitch and level heard over it
function passOf(P, m = 401) {
  const v = Effect.native(P), s = scratch(model);
  const io = s.f64(v.length + 1); io.set(v); io[v.length] = m;
  model.doppler_pass(s.at);
  const o = s.f64(5 + 5 * m), at = (k) => o.slice(5 + k * m, 5 + (k + 1) * m);
  return { p: { v: o[0], u: o[1], d: o[2], c: o[3], T: o[4] }, s: at(0), r: [at(1), at(3)], g: [at(2), at(4)] };
}

// where the newest pass is: from the engine's messages while it plays, otherwise a clock of our own
const clock = { msg: null, at: 0 };
const listen = (api) => api.on('pedal', (messages) => {
  for (const m of messages) if (m.type === 1) { const v = m.values; clock.msg = { s: v[0], T: v[1], v: v[2], u: v[3], d: v[4], c: v[5] }; clock.at = performance.now(); }
});
function now(fallback) {
  const t = performance.now();
  if (clock.msg && t - clock.at < 400) return { ...clock.msg, s: clock.msg.s + (t - clock.at) / 1000 };
  const p = fallback;
  return { ...p, s: (((t / 1000) % p.T) + p.T) % p.T - p.T / 2 };
}

// The road: from above, the source on its road and you, and the wavefronts it sent as they spread.
const roadView = {
  title: 'The road',
  caption: 'from above: the road d away, the source on it (orange) and you, with your two ears. The rings are what the source sent, every few milliseconds, each spreading at the speed of sound from where the source was when it sent it: bunched ahead of it, spread behind, so you hear it higher coming and lower going. Above Mach 1 the source outruns its rings, and they pile up on a cone: where the cone crosses you, the boom.',
  perform: true,
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let geo = passOf(api.P, 3).p;
    const show = () => {
      const p = geo, M = p.v / p.c;
      legend.innerHTML = `<span style="color:var(--accent)">● ${p.v.toFixed(0)} m/s, Mach ${M.toFixed(2)}${p.u ? `, you at ${p.u.toFixed(0)} m/s` : ''}</span><span>${p.d.toFixed(1)} m away, every ${p.T.toFixed(1)} s</span>`;
    };
    api.on('params', () => { geo = passOf(api.P, 3).p; show(); });
    listen(api);
    animate(canvas, () => {
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const q = now(geo);
      // metres to pixels: the road d above you, a span wide enough to see the pass come and go
      let k = (0.62 * h) / q.d, half = w / (2 * k);
      if (half < 3 * q.d) { half = 3 * q.d; k = w / (2 * half); }
      const ox = w / 2, oy = h * 0.82, X = (m) => ox + m * k, Y = (m) => oy - m * k;
      // the road
      g.strokeStyle = css('--grid'); g.lineWidth = Math.min(10, Math.max(2, 3 * k)); g.beginPath(); g.moveTo(0, Y(q.d)); g.lineTo(w, Y(q.d)); g.stroke();
      g.setLineDash([6, 8]); g.lineWidth = 1; g.strokeStyle = css('--ink-2'); g.beginPath(); g.moveTo(0, Y(q.d)); g.lineTo(w, Y(q.d)); g.stroke(); g.setLineDash([]);
      // the rings: sent every Δ, from where the source was then (the air is still: they stay put as you move)
      const span = w / k, dt = Math.max(span / (14 * q.c), 0.002), on = (s) => s >= -q.T / 2 && s <= q.T / 2;
      g.strokeStyle = css('--accent'); g.lineWidth = 1;
      for (let j = 1; j < 400; j++) {
        const sent = Math.floor(q.s / dt) * dt - (j - 1) * dt, r = q.c * (q.s - sent);
        if (r > 1.5 * span) break;
        if (!on(sent) || r <= 0) continue;
        g.globalAlpha = Math.max(0.06, 0.55 * (1 - r / (1.5 * span)));
        g.beginPath(); g.arc(X(q.v * sent - q.u * q.s), Y(q.d), r * k, 0, 2 * Math.PI); g.stroke();
      }
      g.globalAlpha = 1;
      // the source, and its Mach cone
      if (on(q.s)) {
        const sx = X((q.v - q.u) * q.s), sy = Y(q.d);
        if (q.v > q.c) {
          const mu = Math.asin(q.c / q.v), L = 2 * span * k;
          g.strokeStyle = css('--accent'); g.lineWidth = 2; g.beginPath();
          g.moveTo(sx - L * Math.cos(mu), sy - L * Math.sin(mu)); g.lineTo(sx, sy); g.lineTo(sx - L * Math.cos(mu), sy + L * Math.sin(mu)); g.stroke();
        }
        g.fillStyle = css('--accent'); g.beginPath(); g.arc(sx, sy, 6, 0, 2 * Math.PI); g.fill();
      }
      // you: a head and two ears
      g.fillStyle = css('--ink'); g.beginPath(); g.arc(ox, oy, 6, 0, 2 * Math.PI); g.fill();
      g.fillStyle = css('--ink-2');
      for (const e of [-1, 1]) { g.beginPath(); g.arc(ox + e * Math.max(7, EAR * k), oy, 2.5, 0, 2 * Math.PI); g.fill(); }
      g.font = '11px system-ui, sans-serif'; g.textAlign = 'left'; g.fillStyle = css('--ink-2');
      g.fillText(`${(2 * half).toFixed(0)} m across`, 8, h - 6);
      g.textAlign = 'right'; g.fillText('you', ox - 12, oy + 4);
    });
    show();
  },
};

// The pitch: over one pass, the pitch you hear against the pitch sent, and how loud, with now marked.
const pitchView = {
  title: 'The pitch',
  caption: 'over one pass, from when the source sets off to when it fades, the pitch you hear against the pitch it sends (above, in cents: 100 a semitone) and how loud it is (below, in dB against its level at the closest point of a slow pass). Below Mach 1 the pitch falls through the pass, steeper the closer the road. Above, nothing, then two: what it sends now (solid) and what it sent as it came (dashed), heard backwards. The line is now.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let pass = passOf(api.P);
    const show = () => {
      const r = Array.from(pass.r[0]).filter((v) => v !== 0), c = (v) => 1200 * Math.log2(Math.abs(v));
      const p = pass.p, lag = p.v > p.c ? (p.d * Math.sqrt((p.v / p.c) ** 2 - 1)) / (p.v - p.u) : 0;
      legend.innerHTML = !r.length ? '<span>no sound reaches you in this pass</span>'
        : p.v > p.c ? `<span style="color:var(--accent)">● the boom ${lag.toFixed(2)} s after it passes, then its sound now</span><span style="color:#60a5fa">- - and its approach, backwards</span>`
        : `<span style="color:var(--accent)">● coming ${c(r[1]) >= 0 ? '+' : ''}${c(r[1]).toFixed(0)} cents, going ${c(r.at(-2)).toFixed(0)} cents</span>`;
    };
    api.on('params', () => { pass = passOf(api.P); show(); });
    listen(api);
    animate(canvas, () => {
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const { s, r, g: lv, p } = pass, m = s.length;
      const top = { l: 44, r: w - 10, t: 8, b: Math.round(h * 0.58) }, bot = { l: 44, r: w - 10, t: Math.round(h * 0.66), b: h - 18 };
      const x = (t) => top.l + ((top.r - top.l) * (t + p.T / 2)) / p.T;
      const cents = (v) => 1200 * Math.log2(Math.abs(v)), dB = (v) => 20 * Math.log10(v);
      let cmax = 100;
      for (const b of r) for (const v of b) if (v) cmax = Math.max(cmax, Math.abs(cents(v)));
      cmax = Math.min(2400, Math.ceil(cmax / 100) * 100);
      const yc = (c) => (top.t + top.b) / 2 - ((top.b - top.t) / 2) * (c / cmax);
      const yd = (d) => bot.t + ((bot.b - bot.t) * (12 - Math.max(-36, Math.min(12, d)))) / 48;
      g.strokeStyle = css('--grid'); g.fillStyle = css('--ink-2'); g.lineWidth = 1; g.font = '11px system-ui, sans-serif'; g.textAlign = 'right';
      for (const c of [-cmax, 0, cmax]) { g.beginPath(); g.moveTo(top.l, yc(c)); g.lineTo(top.r, yc(c)); g.stroke(); g.fillText(`${c > 0 ? '+' : ''}${c}`, top.l - 4, yc(c) + 4); }
      for (const d of [12, 0, -12, -24, -36]) { g.beginPath(); g.moveTo(bot.l, yd(d)); g.lineTo(bot.r, yd(d)); g.stroke(); if (d === 0 || (d % 24 === 0 && bot.b - bot.t > 40) || bot.b - bot.t > 90) g.fillText(`${d}`, bot.l - 4, yd(d) + 4); }
      g.textAlign = 'right'; g.fillText('cents', top.r - 4, top.t + 10); g.fillText('dB', bot.r - 4, bot.t + 10);
      g.textAlign = 'center'; g.fillText(`${p.T.toFixed(1)} s`, (top.l + top.r) / 2, h - 4);
      // each branch, broken where it is not heard
      [0, 1].forEach((b) => {
        g.strokeStyle = b ? '#60a5fa' : css('--accent'); g.lineWidth = 1.8; g.setLineDash(b ? [5, 4] : []);
        for (const [arr, y] of [[r[b], (i) => yc(cents(r[b][i]))], [lv[b], (i) => yd(dB(lv[b][i]))]]) {
          g.beginPath(); let pen = false;
          for (let i = 0; i < m; i++) { if (!arr[i]) { pen = false; continue; } const X = x(s[i]), Y = y(i); pen ? g.lineTo(X, Y) : g.moveTo(X, Y); pen = true; }
          g.stroke();
        }
      });
      g.setLineDash([]);
      const q = now(p);
      g.strokeStyle = css('--good'); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x(q.s), top.t); g.lineTo(x(q.s), bot.b); g.stroke();
    });
    show();
  },
};

const DOP_SCOPE = 'the voltage at the input (dashed) and at your left ear (solid), each scaled to fit: the source fades in from afar, swells as it passes and fades again, its waves squeezed coming and stretched going.';
const DOP_SPECTRUM = 'what goes in (dashed) and what reaches your left ear (solid), in dB of volts: each harmonic slides down as the source passes. The green line is the note you are playing, and the ticks its harmonics.';

createPedal({ PEDAL, worklet: new URL('./doppler-worklet.js', import.meta.url), views: [roadView, pitchView, spectrumView({ caption: DOP_SPECTRUM }), scopeView({ caption: DOP_SCOPE })] });
