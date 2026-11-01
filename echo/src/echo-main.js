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
const HEADS = [0.04, 0.08, 0.12];
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
const headsOn = (P) => HEADS.map((_, j) => P.heads.includes(String(j + 1)));

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
      const ds = HEADS.map((d, j) => (on[j] ? `${Math.round(1000 * (state ? state[1 + j] : d / api.P.speed))} ms` : null)).filter(Boolean);
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

const ECHO_SCOPE = 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. Each echo is the note again, a little rounder: the heads take the edges off, and the repeats more.';
const ECHO_SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts: the echoes add the note again, its upper harmonics lower than the dry note\'s. The green line is the note you are playing, and the ticks its harmonics.';

createPedal({ PEDAL, worklet: new URL('./echo-worklet.js', import.meta.url), views: [headsView, tapeView, spectrumView({ caption: ECHO_SPECTRUM }), scopeView({ caption: ECHO_SCOPE })] });
