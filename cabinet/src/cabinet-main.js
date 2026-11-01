// cabinet-main.js — the Speaker Cabinet's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, freqAxes, animate, markNote } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './cabinet-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ model, for the views
const N = 240, FMIN = 15, FMAX = 10000;
const FREQS = Float64Array.from({ length: N }, (_, i) => FMIN * (FMAX / FMIN) ** (i / (N - 1)));
const db = (x) => 20 * Math.log10(x);
const LOUD = 0.3; // V: a passive bass played hard

// the small-signal response at FREQS (cabinet-web.cpp): |H|, |Z| (Ω) and |X| (m per input volt)
function response(P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  s.f64(N, 8 * v.length).set(FREQS);
  model.cabinet_response(s.at, N);
  const o = s.f64(5 * N, 8 * (v.length + N));
  return { h: Array.from(o.subarray(0, N)), z: Array.from(o.subarray(2 * N, 3 * N)), x: Array.from(o.subarray(4 * N, 5 * N)) };
}
function info(P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  model.cabinet_info(s.at);
  return { fb: s.f64(13)[8] };
}
const line = (g, xs, ys, color, width, dash = []) => {
  g.beginPath(); g.setLineDash(dash); g.strokeStyle = color; g.lineWidth = width;
  xs.forEach((X, i) => (i ? g.lineTo(X, ys[i]) : g.moveTo(X, ys[i])));
  g.stroke(); g.setLineDash([]);
};

// The response: the sound at the microphone for each frequency, and the impedance the amp sees.
const responseView = {
  title: 'The response',
  caption: 'what the microphone hears for a small, steady sine at each frequency (orange, dB of its volts per volt in), and the impedance the amp drives (blue, ohms on the right). Sealed, the impedance peaks at the box\'s resonance and the sound rolls off below it; ported, it has two peaks with a dip between at the port\'s tuning, where the port does the work. The green line is the note you are playing.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let r = null, fb = 0;
    const update = () => {
      r = response(api.P); fb = info(api.P).fb;
      let k = 0; r.z.forEach((v, i) => { if (FREQS[i] < 300 && v > r.z[k]) k = i; });
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>sound</span><span><i style="background:${css('--accent-2')}"></i>impedance, ${r.z[k].toFixed(0)} Ω at ${FREQS[k].toFixed(0)} Hz</span>${fb ? `<span>port tuned to ${fb.toFixed(1)} Hz</span>` : ''}`;
    };
    api.on('params', update);
    animate(canvas, () => {
      if (!r) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const top = Math.ceil((Math.max(...r.h.map(db)) + 3) / 6) * 6;
      const { x, y, box } = freqAxes(g, w - 30, h, { fmin: FMIN, fmax: FMAX, dbMin: top - 42, dbMax: top });
      // ohms, log, 1 to 300, on the right
      const Z = (z) => box.b - ((box.b - box.t) * Math.log(Math.max(1, Math.min(300, z)))) / Math.log(300);
      g.fillStyle = css('--ink-2'); g.textAlign = 'left';
      for (const z of box.b - box.t > 110 ? [1, 3, 10, 30, 100, 300] : [1, 10, 100]) g.fillText(`${z}`, box.r + 4, Z(z) + 4);
      if (box.b - box.t <= 110) g.fillText('Ω', box.r + 4, Z(300) + 4);
      if (fb) { g.strokeStyle = css('--ink-2'); g.setLineDash([2, 3]); g.beginPath(); g.moveTo(x(fb), box.t); g.lineTo(x(fb), box.b); g.stroke(); g.setLineDash([]); }
      const xs = Array.from(FREQS, x);
      line(g, xs, r.z.map(Z), css('--accent-2'), 1.5);
      line(g, xs, r.h.map((v) => Math.max(box.t, Math.min(box.b, y(db(v))))), css('--accent'), 2.5);
      markNote(g, x, box, api.note);
    });
    update();
  },
};

// The cone: how far a loud note at each frequency moves the cones, against their linear travel,
// and their travel now.
const coneView = {
  title: 'The cone',
  caption: `how far a ${LOUD} V sine at each frequency would move the cones at this gain (orange, mm peak), against their linear travel Xmax (dashed); and the cones' travel over the last second, as you play. Low notes move them most: sealed, the travel levels off below the box's resonance; ported, it dips to almost nothing at the port's tuning and then climbs fast below it, where the port no longer loads the cones. Past Xmax the motor loses its grip and the suspension stiffens, and the sound thickens.`,
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const KEEP = 500, trace = []; // 2 ms each
    let r = null, peak = 0, shown = 0;
    api.on('params', () => { r = response(api.P); });
    api.on('pedal', (messages) => {
      for (const m of messages) if (m.type === 1) { for (let i = 0; i < 20; i++) trace.push(m.values[i]); peak = Math.max(peak * 0.9, m.values[20]); }
      if (trace.length > KEEP) trace.splice(0, trace.length - KEEP);
    });
    const show = () => {
      const xm = api.P.xmax;
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>travel now ${(1e3 * peak).toFixed(2)} mm</span><span>Xmax ${(1e3 * xm).toFixed(1)} mm${peak > xm ? ', past it' : ''}</span>`;
    };
    animate(canvas, () => {
      if (!r) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      // two plots: stacked in a tall card, side by side in a wide, short one
      const xm = 1e3 * api.P.xmax, beside = w > 2.4 * h || h < 170;
      const split = beside ? Math.round(w * 0.55) : Math.round(h * 0.58);
      // travel against frequency, log mm from Xmax/30 to 4 Xmax
      const fbox = beside ? { l: 40, r: split - 10, t: 10, b: h - 22 } : { l: 40, r: w - 10, t: 10, b: split - 20 };
      const X = (f) => fbox.l + ((fbox.r - fbox.l) * Math.log(f / FMIN)) / Math.log(FMAX / 10 / FMIN);
      const lo = xm / 30, hi = xm * 4;
      const Y = (mm) => fbox.b - ((fbox.b - fbox.t) * Math.log(Math.max(lo, Math.min(hi, mm)) / lo)) / Math.log(hi / lo);
      g.strokeStyle = css('--grid'); g.fillStyle = css('--ink-2'); g.lineWidth = 1; g.font = '11px system-ui, sans-serif';
      g.textAlign = 'center';
      for (const f of fbox.r - fbox.l > 200 ? [20, 50, 100, 200, 500, 1000] : [20, 100, 1000]) { g.beginPath(); g.moveTo(X(f), fbox.t); g.lineTo(X(f), fbox.b); g.stroke(); g.fillText(f >= 1000 ? '1k' : `${f}`, X(f), fbox.b + 14); }
      g.textAlign = 'right';
      const ticks = fbox.b - fbox.t > 90 ? [0.1, 0.3, 1, 3, 10, 30] : [0.1, 1, 10];
      for (const mm of ticks) if (mm >= lo && mm <= hi) { g.beginPath(); g.moveTo(fbox.l, Y(mm)); g.lineTo(fbox.r, Y(mm)); g.stroke(); g.fillText(`${mm}`, fbox.l - 6, Y(mm) + 4); }
      g.textAlign = 'left'; g.fillText('mm', fbox.l + 4, fbox.t + 10);
      g.strokeStyle = css('--warn'); g.setLineDash([5, 4]); g.beginPath(); g.moveTo(fbox.l, Y(xm)); g.lineTo(fbox.r, Y(xm)); g.stroke(); g.setLineDash([]);
      const idx = FREQS.findIndex((f) => f > FMAX / 10);
      const fs = Array.from(FREQS.subarray(0, idx));
      line(g, fs.map(X), fs.map((_, i) => Y(1e3 * LOUD * r.x[i])), css('--accent'), 2.5);
      markNote(g, X, fbox, api.note);
      // the travel over the last second, ±1.5 Xmax
      const tbox = beside ? { l: split + 40, r: w - 10, t: 10, b: h - 22 } : { l: 40, r: w - 10, t: split, b: h - 20 };
      const mid = (tbox.t + tbox.b) / 2, T = (mm) => mid - ((tbox.b - tbox.t) / 2) * Math.max(-1, Math.min(1, mm / (1.5 * xm)));
      g.strokeStyle = css('--grid'); g.beginPath(); g.moveTo(tbox.l, mid); g.lineTo(tbox.r, mid); g.stroke();
      g.strokeStyle = css('--warn'); g.setLineDash([5, 4]);
      for (const s of [1, -1]) { g.beginPath(); g.moveTo(tbox.l, T(s * xm)); g.lineTo(tbox.r, T(s * xm)); g.stroke(); }
      g.setLineDash([]);
      g.fillStyle = css('--ink-2'); g.textAlign = 'right';
      g.fillText(`+${xm.toFixed(1)}`, tbox.l - 6, T(xm) + 4); g.fillText(`−${xm.toFixed(1)}`, tbox.l - 6, T(-xm) + 4);
      g.textAlign = 'center';
      g.fillText('the last second', (tbox.l + tbox.r) / 2, h - 6);
      if (trace.length > 1) {
        const tx = (i) => tbox.r - ((tbox.r - tbox.l) * (trace.length - 1 - i)) / (KEEP - 1);
        line(g, trace.map((_, i) => tx(i)), trace.map((v) => T(1e3 * v)), css('--accent'), 1.5);
      }
      if (++shown % 6 === 0) show();
    });
    r = response(api.P);
    show();
  },
};

const CABINET_SCOPE = 'the voltage at the input (dashed) and at the microphone (solid) as you play, each scaled to fit. The cabinet hears the cones\' acceleration, so the low end comes out shaped and shifted in time against the bass\'s wave; push the gain and a low note\'s peaks round off where the cones run out of travel.';
const CABINET_SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts: the low strings\' fundamentals fall away below the box\'s resonance, the coil\'s inductance darkens the top, and when the cones run out of travel new odd harmonics appear above a low note. The green line is the note you are playing, as the tuner hears it at the input, and the ticks along the top its harmonics.';

createPedal({ PEDAL, worklet: new URL('./cabinet-worklet.js', import.meta.url), views: [responseView, coneView, scopeView({ caption: CABINET_SCOPE }), spectrumView({ caption: CABINET_SPECTRUM })] });
