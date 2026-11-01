// envelope-main.js — the Envelope Filter's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, freqAxes, animate, markNote, markPartials, atFreq } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './envelope-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ model, for the views
const N = 240, FMIN = 20, FMAX = 20000;
const FREQS = Float64Array.from({ length: N }, (_, i) => FMIN * (FMAX / FMIN) ** (i / (N - 1)));
const db = (x) => 20 * Math.log10(x);

// |H| of the filter (with the blend and level) at FREQS for a cutoff fc (envelope-web.cpp)
function response(P, fc) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length + 1).set([...v, fc]);
  s.f64(N, 8 * (v.length + 1)).set(FREQS);
  model.envelope_response(s.at, N);
  return Array.from(s.f64(N, 8 * (v.length + 1 + N)));
}
// the cutoffs the cells settle to with the follower at rest and with the LED as bright (or, Down,
// as dark) as it goes
function ends(P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  s.f64(2, 8 * v.length).set([0, 100]);
  model.envelope_static(s.at, 2);
  const [rest, full] = s.f64(2, 8 * (v.length + 2));
  return { rest, full };
}

// The filter: its response now, where the cells have the cutoff, and at the sweep's two ends.
const filterView = {
  title: 'The filter',
  caption: 'the filter\'s response where the photocells have its cutoff now (solid), at rest and at the far end of the sweep (dashed). Play, and watch each note push the peak up (or, Down, pull it down) and let it drift back. The green line is the note you are playing, and the ticks its harmonics: the quack is the peak passing over them. The green dots are those harmonics on the filter\'s curve, each as large as it is loud in your bass now: watch the peak lift the ones it passes.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let e = null, rest = null, full = null, now = null, fc = null, drawn = null, last = 0;
    const compute = () => {
      e = ends(api.P);
      rest = response(api.P, e.rest); full = response(api.P, e.full);
      if (fc === null) fc = e.rest;
      drawn = fc; now = response(api.P, fc);
    };
    const show = () => {
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>now ${drawn.toFixed(0)} Hz</span><span>dashed: at rest ${e.rest.toFixed(0)} Hz, ${api.P.direction === 'down' ? 'darkest' : 'brightest'} ${e.full.toFixed(0)} Hz</span>`;
    };
    api.on('params', () => { compute(); show(); });
    api.on('pedal', (messages) => {
      for (const m of messages) if (m.type === 1) fc = m.values[0];
      const t = performance.now();
      if (fc !== null && Math.abs(fc / drawn - 1) > 0.005 && t - last > 30) { last = t; drawn = fc; now = response(api.P, fc); show(); }
    });
    animate(canvas, () => {
      if (!now) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const top = Math.max(12, Math.ceil((db(api.P.reso) + 4) / 6) * 6);
      const { x, y, box } = freqAxes(g, w, h, { dbMin: top - 48, dbMax: top });
      const line = (vals, color, width, dash = []) => {
        g.beginPath(); g.setLineDash(dash); g.strokeStyle = color; g.lineWidth = width;
        vals.forEach((v, i) => { const X = x(FREQS[i]), Y = Math.max(box.t, Math.min(box.b, y(db(v)))); i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
        g.stroke(); g.setLineDash([]);
      };
      line(rest, css('--ink-2'), 1.2, [5, 4]);
      line(full, css('--ink-2'), 1.2, [2, 3]);
      line(now, css('--accent'), 2.5);
      markNote(g, x, box, api.note);
      markPartials(g, x, y, box, api, (f) => db(atFreq(FREQS, now, f)));
    });
    compute(); show();
  },
};

// The sweep: the cutoff over the last four seconds, and the LED's current that drives it.
const sweepView = {
  title: 'The sweep',
  caption: 'the last four seconds: the filter\'s cutoff (orange, on the frequency scale at the left), the LED\'s current (green, 0 to 20 mA at the right) and how full the photocells\' traps are (blue). The follower lights the LED as you pluck; the cells answer within a few milliseconds, and after a long hard note their traps keep the cutoff up a little longer.',
  mount(holder, api) {
    holder.classList.add('history');
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const KEEP = 400, hist = []; // 10 ms each
    let last = null, shown = 0;
    api.on('pedal', (messages) => {
      for (const m of messages) if (m.type === 1) { hist.push([m.values[0], m.values[2], m.values[4]]); last = m.values; }
      if (hist.length > KEEP) hist.splice(0, hist.length - KEEP);
    });
    const show = () => {
      if (!last) { legend.innerHTML = '<span>Play, and watch the sweep</span>'; return; }
      const r = last[5];
      legend.innerHTML = `<span style="color:var(--accent)">● ${last[0].toFixed(0)} Hz</span><span style="color:var(--good)">● LED ${last[2].toFixed(1)} mA</span><span>cell ${r >= 1e6 ? `${(r / 1e6).toFixed(2)} MΩ` : `${(r / 1e3).toFixed(1)} kΩ`}</span><span style="color:var(--accent-2)">● traps ${(100 * last[4]).toFixed(0)} % full</span>`;
    };
    animate(canvas, () => {
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const box = { l: 44, r: w - 44, t: 10, b: h - 22 }, F0 = 50, F1 = 5000;
      const X = (i) => box.r - ((box.r - box.l) * (hist.length - 1 - i)) / (KEEP - 1);
      const Yf = (f) => box.b - ((box.b - box.t) * Math.log(Math.max(F0, Math.min(F1, f)) / F0)) / Math.log(F1 / F0);
      const Yr = (v) => box.b - (box.b - box.t) * Math.min(1, Math.max(0, v)); // 0..1 on the right
      g.strokeStyle = css('--grid'); g.fillStyle = css('--ink-2'); g.lineWidth = 1; g.font = '11px system-ui, sans-serif';
      g.textAlign = 'right';
      const ticks = box.b - box.t > 120 ? [50, 100, 200, 500, 1000, 2000, 5000] : [100, 1000];
      for (const f of ticks) { g.beginPath(); g.moveTo(box.l, Yf(f)); g.lineTo(box.r, Yf(f)); g.stroke(); g.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, box.l - 6, Yf(f) + 4); }
      g.textAlign = 'left';
      for (const v of [0, 0.5, 1]) g.fillText(`${20 * v} mA`, box.r + 4, Yr(v) + 4);
      g.textAlign = 'center';
      for (let s = 0; s <= 4; s++) { const xx = box.r - ((box.r - box.l) * s) / 4; g.fillText(s ? `−${s} s` : 'now', xx, h - 6); }
      const line = (k, Yk, color, width) => {
        g.beginPath(); g.strokeStyle = color; g.lineWidth = width;
        hist.forEach((p, i) => (i ? g.lineTo(X(i), Yk(p[k])) : g.moveTo(X(i), Yk(p[k]))));
        g.stroke();
      };
      if (hist.length > 1) {
        line(2, Yr, css('--accent-2'), 1.5);
        line(1, (mA) => Yr(mA / 20), css('--good'), 1);
        line(0, Yf, css('--accent'), 2.5);
      }
      if (++shown % 6 === 0) show();
    });
    show();
  },
};

const ENVELOPE_SCOPE = 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. Band-pass, the output rings at the cutoff: watch its wave change shape as the peak sweeps over the note\'s harmonics, faster at the pluck and slower as it falls back.';
const ENVELOPE_SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts: the harmonics under the filter\'s peak stand up out of the rest, and the peak moves as you play. The green line is the note you are playing, as the tuner hears it at the input, and the ticks along the top its harmonics.';

createPedal({ PEDAL, worklet: new URL('./envelope-worklet.js', import.meta.url), views: [filterView, sweepView, scopeView({ caption: ENVELOPE_SCOPE }), spectrumView({ caption: ENVELOPE_SPECTRUM })] });
