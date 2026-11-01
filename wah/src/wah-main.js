// wah-main.js — the Wah's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, freqAxes } from '../../shared/plot.js';
import { spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './wah-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ circuit, for the views
const N = 240, FREQS = Float64Array.from({ length: N }, (_, i) => 20 * 1000 ** (i / (N - 1)));

// |H| of the circuit for a small signal at its operating point, at FREQS
function response(P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  s.f64(N, 8 * v.length).set(FREQS);
  model.wah_response(s.at, N);
  return Array.from(s.f64(N, 8 * (v.length + N)));
}
const db = (x) => 20 * Math.log10(x);
const peakOf = (H) => { let k = 0; H.forEach((v, i) => { if (v > H[k]) k = i; }); return { f: FREQS[k], db: db(H[k]) }; };

// The filter: where the rocker has it now, and its two ends.
const filterView = {
  title: 'The sweep',
  caption: 'the circuit\'s response for a small signal: where the rocker is now (solid), heel down and toe down (dashed). Rock the pedal, or turn the Rocker knob, and watch the peak slide. In Auto the envelope follower rocks it: play, and watch each note push the peak and let it fall back.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let now = null, heel = null, toe = null, ends = '';
    // in Auto the envelope follower has the rocker: where it last said (the engine's messages)
    let rocker = null, drawn = null, last = 0;
    const auto = () => api.P.control === 'auto';
    const compute = () => {
      const key = ['sweepC', 'qR', 'inductor', 'vcc', 'taper'].map((k) => api.P[k]).join();
      if (key !== ends) { heel = response({ ...api.P, position: 0 }); toe = response({ ...api.P, position: 1 }); ends = key; }
      drawn = auto() && rocker !== null ? rocker : api.P.position;
      now = response({ ...api.P, position: drawn });
    };
    api.on('pedal', (messages) => {
      for (const m of messages) if (m.type === 1) rocker = m.values[0];
      const t = performance.now();
      if (auto() && rocker !== null && Math.abs(rocker - drawn) > 0.01 && t - last > 40) { last = t; compute(); show(); draw(); }
    });
    const draw = () => {
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const { x, y, box } = freqAxes(g, w, h, { dbMin: -30, dbMax: 30 });
      const line = (vals, color, width, dash = []) => {
        g.beginPath(); g.setLineDash(dash); g.strokeStyle = color; g.lineWidth = width;
        vals.forEach((v, i) => { const X = x(FREQS[i]), Y = Math.max(box.t, Math.min(box.b, y(db(v)))); i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
        g.stroke(); g.setLineDash([]);
      };
      line(heel, css('--ink-2'), 1.2, [5, 4]);
      line(toe, css('--ink-2'), 1.2, [2, 3]);
      line(now, css('--accent'), 2.5);
      const p = peakOf(now);
      g.fillStyle = css('--ink');
      g.textAlign = x(p.f) > (box.l + box.r) / 2 ? 'right' : 'left';
      g.fillText(` ${p.f.toFixed(0)} Hz, ${p.db >= 0 ? '+' : '−'}${Math.abs(p.db).toFixed(1)} dB `, x(p.f), Math.max(box.t + 12, y(p.db) - 6));
    };
    const show = () => {
      const a = peakOf(heel), b = peakOf(toe);
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>${auto() ? `now: the follower has it at ${(100 * drawn).toFixed(0)} %` : 'now'}</span><span>dashed: heel down, ${a.f.toFixed(0)} Hz</span><span>dotted: toe down, ${b.f.toFixed(0)} Hz</span>`;
    };
    api.on('params', () => { compute(); show(); draw(); });
    new ResizeObserver(draw).observe(canvas);
    compute(); show(); draw();
  },
};

// the Spectrum (shared/views.js), with what the wah does to it
const WAH_SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts (0 dBV is a sine of 1 V peak): the harmonics near the peak in The sweep ring out above the input\'s. The green line is the note you are playing, as the tuner hears it at the input, and the ticks along the top its harmonics.';

createPedal({ PEDAL, worklet: new URL('./wah-worklet.js', import.meta.url), views: [filterView, spectrumView({ caption: WAH_SPECTRUM })] });
