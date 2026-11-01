// sympathetic-main.js — the Sympathetic Strings' page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, animate, markNote } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './sympathetic-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ strings, for the views
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const nameOf = (f) => { const s = Math.round(12 * Math.log2(f / 440)) + 57; return `${NAMES[((s % 12) + 12) % 12]}${Math.floor(s / 12)}`; };

// the strings as the engine tunes them
function stringsOf(P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  model.sympathetic_strings(s.at);
  const o = s.f64(4 + 7 * 12), n = o[0];
  return Array.from({ length: n }, (_, j) => { const q = o.slice(4 + 7 * j, 11 + 7 * j); return { f0: q[0], L: q[1], T: q[2], B: q[5], partials: q[6], name: nameOf(q[0]) }; });
}
// each string's energy, from the engine's messages, held and let fall
const live = { e: [], held: [] };
const listen = (api) => api.on('pedal', (messages) => { for (const m of messages) if (m.type === 1) live.e = Array.from(m.values); });
const level = (j) => {
  const big = Math.max(1e-30, ...live.e);
  live.held[j] = Math.max(Math.sqrt((live.e[j] ?? 0) / big), (live.held[j] ?? 0) * 0.95);
  return live.held[j];
};

// The strings: each to scale, ringing as much as it rings.
const stringsView = {
  title: 'The strings',
  caption: 'the strings from above, each drawn to its length (the lowest is longest: every string is at the same stress, so its length sets its note, as a harp\'s) and shaking as much as it rings now, the loudest at full width. The bridge your bass drives is on the left. Play a note in the key and watch the strings that share its harmonics wake; play one outside it and they stay nearly still.',
  perform: true,
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    let S = stringsOf(api.P);
    api.on('params', () => { S = stringsOf(api.P); live.held = []; });
    listen(api);
    let t = 0;
    animate(canvas, () => {
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      t += 1;
      const Lmax = Math.max(...S.map((s) => s.L)), left = 46, right = w - 12, row = (h - 16) / Math.max(1, S.length);
      // the bridge
      g.fillStyle = css('--ink-2'); g.fillRect(left - 6, 6, 4, h - 12);
      g.font = '11px system-ui, sans-serif'; g.textAlign = 'right';
      S.forEach((s, j) => {
        const y = 8 + row * (j + 0.5), len = ((right - left) * s.L) / Lmax, a = level(j), amp = Math.min(row * 0.45, 2 + row * 0.45 * a);
        g.fillStyle = a > 0.3 ? css('--accent') : css('--ink-2');
        if (row >= 11 || j % Math.ceil(11 / row) === 0) g.fillText(s.name, left - 12, y + 4);
        g.beginPath(); g.strokeStyle = a > 0.05 ? css('--accent') : css('--ink-2'); g.globalAlpha = 0.35 + 0.65 * a; g.lineWidth = 1.5;
        const ph = Math.sin(t * (0.6 + 0.07 * j));
        for (let k = 0; k <= 40; k++) { const X = left + (len * k) / 40, Y = y + (a > 0.02 ? amp * ph * Math.sin((Math.PI * k) / 40) : 0); k ? g.lineTo(X, Y) : g.moveTo(X, Y); }
        g.stroke(); g.globalAlpha = 1;
        g.fillStyle = css('--ink-2'); g.beginPath(); g.arc(left + len, y, 2.5, 0, 2 * Math.PI); g.fill();
      });
    });
  },
};

// The partials: where every string's partials lie, against the note's harmonics.
const FMIN = 30, FMAX = 6000;
const partialsView = {
  title: 'The partials',
  caption: 'every partial of every string, one row a string, on a scale of frequency: the ticks are where each can ring, stretched a little sharp by the wire\'s stiffness, brighter the more that string rings now. The green line is the note you are playing and its harmonics are the ticks along the top: where they meet a string\'s partials, that string rings along.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let S = stringsOf(api.P);
    const show = () => { legend.innerHTML = `<span style="color:var(--accent)">● ${S.length} strings, ${S.reduce((a, s) => a + s.partials, 0)} partials</span><span>lowest ${S[0].name}, ${S[0].L.toFixed(2)} m</span>`; };
    api.on('params', () => { S = stringsOf(api.P); show(); });
    listen(api);
    animate(canvas, () => {
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const box = { l: 40, r: w - 10, t: 12, b: h - 20 }, x = (f) => box.l + ((box.r - box.l) * Math.log(f / FMIN)) / Math.log(FMAX / FMIN);
      g.strokeStyle = css('--grid'); g.fillStyle = css('--ink-2'); g.lineWidth = 1; g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
      for (const f of [50, 100, 200, 500, 1000, 2000, 5000]) { g.beginPath(); g.moveTo(x(f), box.t); g.lineTo(x(f), box.b); g.stroke(); if (w > 320 || [100, 1000].includes(f)) g.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x(f), h - 5); }
      const row = (box.b - box.t) / Math.max(1, S.length);
      g.textAlign = 'right';
      S.forEach((s, j) => {
        const y = box.t + row * j, a = level(j);
        g.fillStyle = css('--ink-2'); if (row >= 11 || j % Math.ceil(11 / row) === 0) g.fillText(s.name, box.l - 4, y + row / 2 + 4);
        g.strokeStyle = a > 0.05 ? css('--accent') : css('--ink-2'); g.globalAlpha = 0.3 + 0.7 * a; g.lineWidth = 1.5;
        g.beginPath();
        for (let n = 1; n <= s.partials; n++) { const f = (n * s.f0 * Math.sqrt(1 + s.B * n * n)) / Math.sqrt(1 + s.B), X = x(f); if (X > box.r) break; g.moveTo(X, y + 2); g.lineTo(X, y + row - 2); }
        g.stroke(); g.globalAlpha = 1;
      });
      markNote(g, x, box, api.note);
    });
    show();
  },
};

const SYMP_SCOPE = 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. The strings take a moment to ring up, and ring on after the note.';
const SYMP_SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts: where the note\'s harmonics meet the strings\' partials, the output stands up in narrow peaks that stay after the note. The green line is the note you are playing, and the ticks its harmonics.';

createPedal({ PEDAL, worklet: new URL('./sympathetic-worklet.js', import.meta.url), views: [stringsView, partialsView, spectrumView({ caption: SYMP_SPECTRUM }), scopeView({ caption: SYMP_SCOPE })] });
