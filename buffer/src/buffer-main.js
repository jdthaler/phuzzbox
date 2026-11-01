// buffer-main.js — the Buffer's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, freqAxes, animate, markNote } from '../../shared/plot.js';
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

// The live spectrum of what comes out, with the circuit's curve over it.
const spectrumView = {
  title: 'Spectrum',
  caption: 'the output as it plays (play the test bass or your own): the treble falls where the solid curve above falls. The green line is the note you are playing, as the tuner hears it at the input, and the ticks along the top its harmonics.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    let data = null;
    animate(canvas, () => {
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const { x, y, box } = freqAxes(g, w, h, { dbMin: -100, dbMax: -10 });
      const a = api.analyser;
      if (!a) { g.fillStyle = css('--ink-2'); g.textAlign = 'center'; g.fillText('Start audio, then play', (box.l + box.r) / 2, (box.t + box.b) / 2); return; }
      markNote(g, x, box, api.note);
      data ??= new Float32Array(a.frequencyBinCount);
      a.getFloatFrequencyData(data);
      const fs = api.ctx.sampleRate, bin = fs / a.fftSize;
      g.beginPath(); g.strokeStyle = css('--accent'); g.lineWidth = 1.5;
      let started = false;
      for (let i = 1; i < data.length; i++) {
        const f = i * bin;
        if (f < 20 || f > 20000) continue;
        const Y = Math.max(box.t, Math.min(box.b, y(data[i])));
        if (!started) { g.moveTo(x(f), Y); started = true; } else g.lineTo(x(f), Y);
      }
      g.stroke();
    });
  },
};

createPedal({ PEDAL, worklet: new URL('./buffer-worklet.js', import.meta.url), views: [circuitView, spectrumView] });
