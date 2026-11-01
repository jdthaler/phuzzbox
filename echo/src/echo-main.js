// echo-main.js — the Tape Echo's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, freqAxes, animate, markNote } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './echo-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ heads and tape, for the views
const N = 200, FMIN = 20, FMAX = 20000;
const FREQS = Float64Array.from({ length: N }, (_, i) => FMIN * (FMAX / FMIN) ** (i / (N - 1)));
const HEAD_IDS = ['head1', 'head2', 'head3'];
const headsAt = (P) => HEAD_IDS.map((id) => P[id]);
const db = (v) => 20 * Math.log10(Math.max(1e-9, Math.abs(v)));

// the heads' response at the knob's speed (echo-web.cpp): the FIR as designed
function response(P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length + N).set([...v, ...FREQS]);
  model.echo_response(s.at, N);
  return Array.from(s.f64(N, 8 * (v.length + N)));
}
// what the tape keeps of x from −X to X
function curve(P, X, n) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length + 1).set([...v, X]);
  model.echo_curve(s.at, n);
  return Array.from(s.f64(n, 8 * (v.length + 1)));
}
const headsOn = (P) => HEAD_IDS.map((_, j) => P.heads.includes(String(j + 1)));

// The heads: what one pass through the tape keeps of each frequency, and what the repeats keep.
const headsView = {
  title: 'The heads',
  caption: 'what one pass through the tape keeps of each frequency at this speed (solid): the playback heads hear the tape\'s field through their spacing, the coating\'s thickness and their gap, and short wavelengths lose most. Dashed, the second, third and fourth repeats, each recorded again and played again, darker every time. The dip, if you see one, is where a wavelength fits the gap. The green line is the note you are playing.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let H = null, state = null, shown = 0;
    const compute = () => { H = response(api.P); };
    api.on('params', compute);
    api.on('pedal', (messages) => { for (const m of messages) if (m.type === 1) state = m.values; });
    const show = () => {
      const v = state ? state[0] : api.P.speed, on = headsOn(api.P);
      const ds = headsAt(api.P).map((d, j) => (on[j] ? `${Math.round(1000 * (state ? state[1 + j] : d / api.P.speed))} ms` : null)).filter(Boolean);
      legend.innerHTML = `<span style="color:var(--accent)">● tape ${(100 * v).toFixed(1)} cm/s</span><span>echoes ${ds.join(', ')}</span>`;
    };
    animate(canvas, () => {
      if (!H) return;
      if (++shown % 10 === 0) show();
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const { x, y, box } = freqAxes(g, w, h, { dbMin: -48, dbMax: 6 });
      const line = (k, color, width, dash = []) => {
        g.beginPath(); g.setLineDash(dash); g.strokeStyle = color; g.lineWidth = width;
        H.forEach((v, i) => { const Y = Math.max(box.t, Math.min(box.b, y(k * db(v) + (k - 1) * db(api.P.repeats || 1e-9)))); i ? g.lineTo(x(FREQS[i]), Y) : g.moveTo(x(FREQS[i]), Y); });
        g.stroke(); g.setLineDash([]);
      };
      if (api.P.repeats > 0) for (const k of [4, 3, 2]) line(k, css('--ink-2'), 1.2, [4, 4]);
      line(1, css('--accent'), 2.5);
      markNote(g, x, box, api.note);
    });
    compute(); show();
  },
};

// The tape: the anhysteretic curve, and where on it the record head is working.
const tapeView = {
  title: 'The tape',
  caption: 'what the tape keeps of the record head\'s signal (orange): with an ideal bias, the anhysteretic magnetisation, straight for quiet notes and bending over as the particles line up. The dashed line is a perfect tape. The band is how far along the curve your playing reached in the last moment: turn up Record level, or the repeats, and watch it reach the bend.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const M = 161;
    let reach = 0, held = 0, pts = null, X = 1, key = '';
    const compute = () => {
      const g = 10 ** (api.P.record / 20);
      X = Math.max(4 / g, 0.5); // the curve to well past its bend
      const k = `${api.P.record}`;
      if (k !== key) { key = k; pts = curve(api.P, X, M); }
    };
    api.on('params', compute);
    api.on('pedal', (messages) => {
      for (const m of messages) if (m.type === 1) { const g = 10 ** (api.P.record / 20); reach = m.values[4] / g; }
      held = Math.max(reach, held * 0.97);
      legend.innerHTML = `<span style="color:var(--accent)">● the record head reaches ${(1000 * held).toFixed(0)} mV</span><span>${held * 10 ** (api.P.record / 20) > 1 ? 'into the bend' : 'on the straight'}</span>`;
    });
    animate(canvas, () => {
      if (!pts) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const box = { l: 36, r: w - 10, t: 10, b: h - 20 }, ymax = Math.max(...pts.map(Math.abs)) * 1.15;
      const Xp = (v) => box.l + ((box.r - box.l) * (v + X)) / (2 * X), Yp = (v) => (box.t + box.b) / 2 - ((box.b - box.t) / 2) * (v / ymax);
      g.fillStyle = css('--grid');
      g.globalAlpha = 0.6; g.fillRect(Xp(-Math.min(held, X)), box.t, Xp(Math.min(held, X)) - Xp(-Math.min(held, X)), box.b - box.t); g.globalAlpha = 1;
      g.strokeStyle = css('--grid'); g.lineWidth = 1;
      g.beginPath(); g.moveTo(box.l, Yp(0)); g.lineTo(box.r, Yp(0)); g.moveTo(Xp(0), box.t); g.lineTo(Xp(0), box.b); g.stroke();
      g.setLineDash([4, 4]); g.strokeStyle = css('--ink-2');
      g.beginPath(); g.moveTo(Xp(-Math.min(X, ymax)), Yp(-Math.min(X, ymax))); g.lineTo(Xp(Math.min(X, ymax)), Yp(Math.min(X, ymax))); g.stroke(); g.setLineDash([]);
      g.beginPath(); g.strokeStyle = css('--accent'); g.lineWidth = 2.5;
      pts.forEach((v, i) => { const xx = Xp(-X + (2 * X * i) / (M - 1)); i ? g.lineTo(xx, Yp(v)) : g.moveTo(xx, Yp(v)); });
      g.stroke();
      g.fillStyle = css('--ink-2'); g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
      for (const v of [-X, -X / 2, X / 2, X]) { g.textAlign = v === -X ? 'left' : v === X ? 'right' : 'center'; g.fillText(`${v.toFixed(2)} V`, Xp(v), h - 5); }
      g.textAlign = 'left'; g.fillText('on the tape', box.l + 4, box.t + 10);
    });
    compute();
  },
};

// The tape loop, as it runs: the tape passing the record head and the playback heads, with what the
// record head left on it (the engine's messages), at the tape's own speed. The heads can be dragged.
const loopView = {
  title: 'The tape loop',
  perform: true,
  caption: 'the tape as it runs past the heads, from the record head (left) to the third playback head and on, at its own speed: the stripes are the magnetisation the record head left on it, red one way and blue the other, a wavelength on the tape for every cycle of your bass. Each playback head (bright when it is heard) plays the stretch of tape passing it, which the record head wrote its distance over the speed ago; their sum is recorded again, so the repeats come round on the tape too. Drag a head along the tape to move it: its echo moves with it. The heads and the tape are drawn to scale (the bar is 5 cm).',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    canvas.style.touchAction = 'none';
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const chunks = []; // [where the record head was at the first value (m), the 24 values]
    let v = api.P.speed, lastAt = 0, scale = 1e-3, shown = 0, drag = -1, geo = null;
    api.on('pedal', (messages) => {
      for (const m of messages) {
        if (m.type === 1) v = m.values[0];
        if (m.type === 2) { chunks.push([m.values[0], m.values.slice(2), m.values[1]]); lastAt = performance.now(); }
      }
      while (chunks.length > 1 && chunks[chunks.length - 1][0] - chunks[0][0] > 0.3) chunks.shift();
      if (chunks.length > 1 && chunks[chunks.length - 1][0] < chunks[chunks.length - 2][0]) chunks.splice(0, chunks.length - 1); // reset, or the wrap at 1000 m
    });
    const SPAN = 0.22; // m of tape after the record head
    const xOf = (d) => geo.l + ((geo.r - geo.l) * d) / SPAN;
    canvas.addEventListener('pointerdown', (e) => {
      if (!geo) return;
      const r = canvas.getBoundingClientRect(), X = e.clientX - r.left;
      const at = headsAt(api.P), j = at.map((d, i) => [i, Math.abs(xOf(d) - X)]).sort((a, b) => a[1] - b[1])[0];
      if (j[1] > 14) return;
      drag = j[0]; canvas.setPointerCapture(e.pointerId); e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect(), X = e.clientX - r.left;
      if (drag < 0) { if (geo) canvas.style.cursor = headsAt(api.P).some((d) => Math.abs(xOf(d) - X) < 14) ? 'ew-resize' : ''; return; }
      const d = Math.max(0.01, Math.min(0.2, ((X - geo.l) / (geo.r - geo.l)) * SPAN));
      api.page.setAll({ [HEAD_IDS[drag]]: Math.round(d * 2000) / 2000 });
    });
    const end = () => { drag = -1; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    animate(canvas, () => {
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      geo = { l: 28, r: w - 12 };
      const th = Math.max(14, Math.min(70, h * 0.3)), ty = Math.round((h - th) / 2 - 6);
      // the tape, and on it what was recorded: newest at the record head
      g.fillStyle = '#3a2a1c'; g.fillRect(geo.l - 20, ty, geo.r - geo.l + 32, th);
      const fs = api.ctx?.sampleRate ?? 48000;
      if (chunks.length) {
        const [X0, vals, n] = chunks[chunks.length - 1];
        const step = (v * n) / vals.length / fs, now = X0 + step * vals.length + v * Math.min(0.04, (performance.now() - lastAt) / 1000);
        let big = 1e-4;
        for (const [, vs] of chunks) for (const q of vs) big = Math.max(big, Math.abs(q));
        scale = Math.max(big, scale * 0.98);
        const pts = [];
        for (const [Xc, vs, nc] of chunks) {
          const dx = (v * nc) / vs.length / fs;
          vs.forEach((q, j) => {
            const d = now - (Xc + j * dx);
            if (d < 0 || d > SPAN) return;
            const u = Math.max(-1, Math.min(1, q / scale)), a = 0.75 * Math.abs(u) ** 0.6;
            g.fillStyle = u > 0 ? `rgba(239,68,68,${a})` : `rgba(96,165,250,${a})`;
            const X = xOf(d), wpx = ((geo.r - geo.l) * dx) / SPAN;
            g.fillRect(X - wpx, ty + 2, Math.max(1, wpx + 0.5), th - 4);
            pts.push([X, u]);
          });
        }
        // and the same as a trace along the tape, so a wave reads as a wave
        g.strokeStyle = 'rgba(255,246,220,0.85)'; g.lineWidth = 1.2; g.beginPath();
        pts.sort((a, b) => a[0] - b[0]).forEach(([X, u], i) => { const Y = ty + th / 2 - (th / 2 - 3) * u; i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
        g.stroke();
      }
      // the heads: the record head at 0, the playback heads where they sit
      const on = headsOn(api.P), at = headsAt(api.P);
      const head = (X, color, label, sub, active) => {
        g.fillStyle = color; g.globalAlpha = active ? 1 : 0.45;
        g.fillRect(X - 5, ty - 18, 10, 16);
        g.globalAlpha = 1;
        g.fillStyle = css(active ? '--ink' : '--ink-2'); g.textAlign = 'center'; g.font = '11px system-ui, sans-serif';
        g.fillText(label, X, ty - 22);
        if (sub) g.fillText(sub, X, ty + th + 14);
      };
      head(xOf(0), css('--accent'), 'rec', '', true);
      at.forEach((d, j) => head(xOf(d), on[j] ? '#e5e7eb' : '#6b7280', `${j + 1}`, `${Math.round((1000 * d) / v)} ms`, on[j]));
      // a scale bar
      g.strokeStyle = css('--ink-2'); g.lineWidth = 1;
      const sy = h - 8; g.beginPath(); g.moveTo(xOf(0), sy); g.lineTo(xOf(0.05), sy); g.stroke();
      g.fillStyle = css('--ink-2'); g.textAlign = 'left'; g.fillText('5 cm', xOf(0.05) + 4, sy + 4);
      if (++shown % 15 === 1) legend.innerHTML = `<span style="color:var(--accent)">● tape ${(100 * v).toFixed(1)} cm/s</span><span>${chunks.length ? 'each stripe a cycle on the tape' : 'start audio and play to record on the tape'}</span>`;
    });
  },
};

const ECHO_SCOPE = 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. Each echo is the note again, a little rounder: the heads take the edges off, and the repeats more.';
const ECHO_SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts: the echoes add the note again, its upper harmonics lower than the dry note\'s. The green line is the note you are playing, and the ticks its harmonics.';

createPedal({ PEDAL, worklet: new URL('./echo-worklet.js', import.meta.url), views: [loopView, headsView, tapeView, spectrumView({ caption: ECHO_SPECTRUM }), scopeView({ caption: ECHO_SCOPE })] });
