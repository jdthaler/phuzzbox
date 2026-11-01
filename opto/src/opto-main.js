// opto-main.js — the Opto Compressor's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, animate } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './opto-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ model, for the views
const db = (x) => 20 * Math.log10(x);

// the quasi-static gain reduction (dB) for steady sines of amplitudes A (opto-web.cpp)
function staticCurve(P, A) {
  const v = Effect.native(P), s = scratch(model), n = A.length;
  s.f64(v.length).set(v);
  s.f64(n, 8 * v.length).set(A);
  model.opto_static(s.at, n);
  return Array.from(s.f64(n, 8 * (v.length + n)));
}

// The cell as it plays: its gain reduction, the panel's light and the traps' fill, over the last
// few seconds, from the engine's messages.
const cellView = {
  title: 'The cell',
  caption: 'the last six seconds: how far the cell turns the bass down (orange, dB), the panel\'s light (green, against its reference glow) and how full the cell\'s traps are (blue). Play a note and hold it: the cell catches it in about 10 ms; let go, and the first half of the gain comes back in under a tenth of a second, the rest as the traps let their electrons go, slower the longer the note was held.',
  mount(holder, api) {
    holder.classList.add('history');
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const KEEP = 600, hist = []; // 10 ms each
    let last = null;
    api.on('pedal', (messages) => {
      for (const m of messages) if (m.type === 1) { hist.push([m.values[7], m.values[3], m.values[2]]); last = m.values; }
      if (hist.length > KEEP) hist.splice(0, hist.length - KEEP);
    });
    const show = () => {
      if (!last) { legend.innerHTML = '<span>Play, and watch the cell</span>'; return; }
      const r = last[4];
      legend.innerHTML = `<span style="color:var(--accent)">● ${last[0].toFixed(1).replace('-', '−')} dB</span><span>cell ${r >= 1e6 ? `${(r / 1e6).toFixed(1)} MΩ` : `${(r / 1e3).toFixed(1)} kΩ`}</span><span style="color:var(--good)">● light ${(100 * last[3]).toFixed(0)} %</span><span style="color:var(--accent-2)">● traps ${(100 * last[2]).toFixed(0)} % full</span>`;
    };
    let shown = 0;
    animate(canvas, () => {
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const box = { l: 40, r: w - 40, t: 10, b: h - 22 }, dbMin = -30;
      const X = (i) => box.r - ((box.r - box.l) * (hist.length - 1 - i)) / (KEEP - 1);
      const Y = (d) => box.t + ((box.b - box.t) * Math.min(1, Math.max(0, d / dbMin)));
      const Yf = (f) => box.b - (box.b - box.t) * Math.min(1, Math.max(0, f)); // 0..1 on the right
      g.strokeStyle = css('--grid'); g.fillStyle = css('--ink-2'); g.lineWidth = 1; g.font = '11px system-ui, sans-serif';
      g.textAlign = 'right';
      for (let d = 0; d >= dbMin; d -= 6) { g.beginPath(); g.moveTo(box.l, Y(d)); g.lineTo(box.r, Y(d)); g.stroke(); g.fillText(`${d}`.replace('-', '−'), box.l - 6, Y(d) + 4); }
      g.textAlign = 'left';
      for (const f of [0, 0.5, 1]) g.fillText(`${100 * f} %`, box.r + 4, Yf(f) + 4);
      g.textAlign = 'center';
      for (let s = 0; s <= 6; s++) { const xx = box.r - ((box.r - box.l) * s) / 6; g.fillText(s ? `−${s} s` : 'now', xx, h - 6); }
      const line = (k, Yk, color, width) => {
        g.beginPath(); g.strokeStyle = color; g.lineWidth = width;
        hist.forEach((p, i) => (i ? g.lineTo(X(i), Yk(p[k])) : g.moveTo(X(i), Yk(p[k]))));
        g.stroke();
      };
      line(2, Yf, css('--accent-2'), 1.5);
      line(1, (v) => Yf(Math.min(1, v)), css('--good'), 1);
      line(0, Y, css('--accent'), 2.5);
      if (++shown % 6 === 0) show();
    });
    show();
  },
};

// The static curve: what comes out for a steady note at each level, against what goes in.
const curveView = {
  title: 'The curve',
  caption: 'for a steady note at each level (its peak, in dB of volts), what comes out (orange) against what goes in, with the pedal\'s gain and no cell (dashed). The ring is what you are playing now. After the cell, the curve bends over and keeps climbing slowly; feed-forward, it can turn back down.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const LO = -50, HI = 10, N = 61;
    const levels = Array.from({ length: N }, (_, i) => LO + ((HI - LO) * i) / (N - 1));
    let curve = null, now = null;
    const update = () => { curve = staticCurve(api.P, levels.map((d) => 10 ** (d / 20))); };
    api.on('params', update);
    api.on('pedal', (messages) => { for (const m of messages) if (m.type === 1 && m.values[5] > 1e-4) now = m.values; });
    animate(canvas, () => {
      if (!curve) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const box = { l: 40, r: w - 10, t: 10, b: h - 22 }, G = api.P.gain;
      const yLo = LO + G - 20, yHi = HI + G + 2;
      const X = (d) => box.l + ((box.r - box.l) * (d - LO)) / (HI - LO);
      const Y = (d) => box.t + ((box.b - box.t) * (yHi - Math.max(yLo, Math.min(yHi, d)))) / (yHi - yLo);
      g.strokeStyle = css('--grid'); g.fillStyle = css('--ink-2'); g.lineWidth = 1; g.font = '11px system-ui, sans-serif';
      g.textAlign = 'center';
      for (let d = LO; d <= HI; d += 10) { g.beginPath(); g.moveTo(X(d), box.t); g.lineTo(X(d), box.b); g.stroke(); g.fillText(`${d}`.replace('-', '−'), X(d), h - 6); }
      g.textAlign = 'right';
      for (let d = Math.ceil(yLo / 10) * 10; d <= yHi; d += 10) { g.beginPath(); g.moveTo(box.l, Y(d)); g.lineTo(box.r, Y(d)); g.stroke(); g.fillText(`${d}`.replace('-', '−'), box.l - 6, Y(d) + 4); }
      g.strokeStyle = css('--ink-2'); g.setLineDash([5, 4]); g.beginPath(); g.moveTo(X(LO), Y(LO + G)); g.lineTo(X(HI), Y(HI + G)); g.stroke(); g.setLineDash([]);
      g.strokeStyle = css('--accent'); g.lineWidth = 2.5; g.beginPath();
      levels.forEach((d, i) => { const yy = Y(d + G + curve[i]); i ? g.lineTo(X(d), yy) : g.moveTo(X(d), yy); });
      g.stroke();
      g.fillStyle = css('--ink-2'); g.textAlign = 'left';
      g.fillText('out (dBV) against in (dBV)', box.l + 6, box.t + 12);
      if (now) {
        const di = db(now[5]), dout = db(now[6]);
        if (di >= LO && di <= HI) { g.strokeStyle = css('--good'); g.lineWidth = 2; g.beginPath(); g.arc(X(di), Y(dout), 5, 0, 2 * Math.PI); g.stroke(); }
      }
    });
    update();
  },
};

const OPTO_SCOPE = 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. Hit a note hard and its first few milliseconds get through before the cell catches it; on a low E with a lot of Peak Reduction, the panel\'s flicker on every half-cycle shows as a slight lean in the wave.';
const OPTO_SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts: the cell turns the whole note down alike, so the harmonics keep their places; only on low notes, heavily compressed, does the cell\'s flicker add a little of its own. The green line is the note you are playing, as the tuner hears it at the input, and the ticks along the top its harmonics.';

createPedal({ PEDAL, worklet: new URL('./opto-worklet.js', import.meta.url), views: [cellView, curveView, scopeView({ caption: OPTO_SCOPE }), spectrumView({ caption: OPTO_SPECTRUM })] });
