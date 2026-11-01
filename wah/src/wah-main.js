// wah-main.js — the Wah's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, freqAxes, animate, markNote } from '../../shared/plot.js';
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
  caption: 'the circuit\'s response for a small signal: where the rocker is now (solid), heel down and toe down (dashed). Rock the pedal, or turn the Rocker knob, and watch the peak slide.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let now = null, heel = null, toe = null, ends = '';
    const compute = () => {
      const key = ['sweepC', 'qR', 'inductor', 'vcc', 'taper'].map((k) => api.P[k]).join();
      if (key !== ends) { heel = response({ ...api.P, position: 0 }); toe = response({ ...api.P, position: 1 }); ends = key; }
      now = response(api.P);
    };
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
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>now</span><span>dashed: heel down, ${a.f.toFixed(0)} Hz</span><span>dotted: toe down, ${b.f.toFixed(0)} Hz</span>`;
    };
    api.on('params', () => { compute(); show(); draw(); });
    new ResizeObserver(draw).observe(canvas);
    compute(); show(); draw();
  },
};

// The live spectrum of what comes out.
const spectrumView = {
  title: 'Spectrum',
  caption: 'the output as it plays (play the test bass or your own): the harmonics near the peak ring out. The green line is the note you are playing, as the tuner hears it at the input, and the ticks along the top its harmonics.',
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

createPedal({ PEDAL, worklet: new URL('./wah-worklet.js', import.meta.url), views: [filterView, spectrumView] });
