// buffer-main.js — the Buffer's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, freqAxes } from '../../shared/plot.js';
import { spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './buffer-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ model, for the views
const N = 240, FREQS = Float64Array.from({ length: N }, (_, i) => 20 * 1000 ** (i / (N - 1)));

function response(P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  s.f64(N, 8 * v.length).set(FREQS);
  model.buffer_response(s.at, N);
  const out = Array.from(s.f64(3 * N, 8 * (v.length + N)));
  s.f64(v.length).set(v);
  model.buffer_resonances(s.at);
  const [fRec, fWant] = s.f64(2);
  return { rec: out.slice(0, N), want: out.slice(N, 2 * N), H: out.slice(2 * N), fRec, fWant };
}
const db = (x) => 20 * Math.log10(x);

// The circuit's response: the pickup as plugged in, as wanted, and the pedal's filter between them.
const circuitView = {
  title: 'The pickup\'s response',
  caption: 'what your pickup gives at each frequency into your interface (dashed) and into the cable and input you chose (solid); the Buffer plays the difference (thin). The bump is the pickup resonating with the cable\'s capacitance.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let r = response(api.P);
    const draw = () => {
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const { x, y, box } = freqAxes(g, w, h, { dbMin: -30, dbMax: 12 });
      const line = (vals, color, width, dash = []) => {
        g.beginPath(); g.setLineDash(dash); g.strokeStyle = color; g.lineWidth = width;
        vals.forEach((v, i) => { const X = x(FREQS[i]), Y = Math.max(box.t, Math.min(box.b, y(db(v)))); i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
        g.stroke(); g.setLineDash([]);
      };
      line(r.rec, css('--ink-2'), 1.5, [5, 4]);
      line(r.H, css('--accent-2'), 1);
      line(r.want, css('--accent'), 2.5);
      for (const [f, c] of [[r.fRec, css('--ink-2')], [r.fWant, css('--accent')]]) {
        if (!f || f > 20000) continue;
        g.strokeStyle = c; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(x(f), box.t); g.lineTo(x(f), box.b); g.stroke(); g.setLineDash([]);
      }
    };
    legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>into what it drives</span><span><i style="background:${css('--ink-2')}"></i>into your interface</span><span><i style="background:${css('--accent-2')}"></i>the Buffer's filter</span><span>dotted: 1/(2π√LC)</span>`;
    api.on('params', () => { r = response(api.P); draw(); });
    new ResizeObserver(draw).observe(canvas);
    draw();
  },
};

// the Spectrum (shared/views.js), with what the Buffer does to it
const BUFFER_SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts (0 dBV is a sine of 1 V peak): the treble falls where the solid curve in The pickup\'s response falls. The green line is the note you are playing, as the tuner hears it at the input, and the ticks along the top its harmonics.';

createPedal({ PEDAL, worklet: new URL('./buffer-worklet.js', import.meta.url), views: [circuitView, spectrumView({ caption: BUFFER_SPECTRUM })] });
