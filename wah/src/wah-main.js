// wah-main.js — the Wah's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, freqAxes, animate, markNote, markPartials, atFreq } from '../../shared/plot.js';
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
// Plugged in backwards from a passive bass, the circuit can oscillate on its own: is it squealing,
// at what pitch, how loud (the C++ plays it for 0.4 s from its operating point after a nudge)
function squeal(P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  model.wah_squeal(s.at);
  const [on, f, peak] = s.f64(3);
  return on ? { f, peak } : null;
}
const db = (x) => 20 * Math.log10(x);
const peakOf = (H) => { let k = 0; H.forEach((v, i) => { if (v > H[k]) k = i; }); return { f: FREQS[k], db: db(H[k]) }; };

// The filter: where the rocker has it now, and its two ends.
const filterView = {
  title: 'The sweep',
  caption: 'the circuit\'s response for a small signal: where the rocker is now (solid), heel down and toe down (dashed). Rock the pedal, or turn the Rocker knob, and watch the peak slide. In Auto the envelope follower rocks it: play, and watch each note push the peak and let it fall back. The green line is the note you are playing, and the green dots its harmonics on the curve, each as large as it is loud in your bass now: rock the pedal and watch the peak lift them one after another. Plugged in backwards (Reversed) it is the input jack\'s voltage per volt from the bass, far lower; and where the circuit oscillates on its own there is no response to draw, only the squeal\'s pitch.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let now = null, heel = null, toe = null, ends = '', squeals = null, heelSq = null, toeSq = null;
    // in Auto the envelope follower has the rocker: where it last said (the engine's messages)
    let rocker = null, drawn = null, last = 0;
    const auto = () => api.P.control === 'auto';
    // the squeal check plays the circuit for 0.4 s: remember it for each rocker position (to 2 %)
    let squealAt = new Map();
    const squealFor = (position) => {
      const k = Math.round(position * 50);
      if (!squealAt.has(k)) squealAt.set(k, squeal({ ...api.P, position: k / 50 }));
      return squealAt.get(k);
    };
    const compute = () => {
      const key = JSON.stringify({ ...api.P, position: 0, level: 0, blend: 0 });
      if (key !== ends) {
        heel = response({ ...api.P, position: 0 }); toe = response({ ...api.P, position: 1 }); ends = key;
        squealAt = new Map();
        heelSq = api.P.reversed ? squealFor(0) : null;
        toeSq = api.P.reversed ? squealFor(1) : null;
      }
      drawn = auto() && rocker !== null ? rocker : api.P.position;
      now = response({ ...api.P, position: drawn });
      squeals = api.P.reversed ? squealFor(drawn) : null;
    };
    api.on('pedal', (messages) => {
      for (const m of messages) if (m.type === 1) rocker = m.values[0];
      const t = performance.now();
      if (auto() && rocker !== null && Math.abs(rocker - drawn) > 0.01 && t - last > 40) { last = t; compute(); show(); draw(); }
    });
    const draw = () => {
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const { x, y, box } = freqAxes(g, w, h, api.P.reversed ? { dbMin: -80, dbMax: 20, step: 20 } : { dbMin: -30, dbMax: 30 });
      const line = (vals, color, width, dash = []) => {
        g.beginPath(); g.setLineDash(dash); g.strokeStyle = color; g.lineWidth = width;
        vals.forEach((v, i) => { const X = x(FREQS[i]), Y = Math.max(box.t, Math.min(box.b, y(db(v)))); i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
        g.stroke(); g.setLineDash([]);
      };
      if (!heelSq) line(heel, css('--ink-2'), 1.2, [5, 4]);
      if (!toeSq) line(toe, css('--ink-2'), 1.2, [2, 3]);
      g.fillStyle = css('--ink');
      if (squeals) { // no steady response: the circuit is oscillating; mark its pitch
        const X = x(squeals.f);
        g.strokeStyle = css('--accent'); g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(X, box.t); g.lineTo(X, box.b); g.stroke();
        g.textAlign = X > (box.l + box.r) / 2 ? 'right' : 'left';
        g.fillText(` squealing at ${squeals.f.toFixed(0)} Hz, ${squeals.peak.toFixed(2)} V peak `, X, box.t + 14);
        return;
      }
      line(now, css('--accent'), 2.5);
      markNote(g, x, box, api.note);
      markPartials(g, x, y, box, api, (f) => db(atFreq(FREQS, now, f)));
      const p = peakOf(now);
      g.fillStyle = css('--ink');
      g.textAlign = x(p.f) > (box.l + box.r) / 2 ? 'right' : 'left';
      g.fillText(` ${p.f.toFixed(0)} Hz, ${p.db >= 0 ? '+' : '−'}${Math.abs(p.db).toFixed(1)} dB `, x(p.f), Math.max(box.t + 12, y(p.db) - 6));
    };
    const show = () => {
      const end = (r, sq, name, how) => (sq ? `<span>${name}: squeals at ${sq.f.toFixed(0)} Hz</span>` : `<span>${how}: ${name}, ${peakOf(r).f.toFixed(0)} Hz</span>`);
      const nowText = squeals ? 'squealing now' : 'now';
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>${auto() ? `${nowText}: the follower has it at ${(100 * drawn).toFixed(0)} %` : nowText}</span>${end(heel, heelSq, 'heel down', 'dashed')}${end(toe, toeSq, 'toe down', 'dotted')}${api.P.reversed ? '<span>plugged in backwards</span>' : ''}`;
    };
    api.on('params', () => { compute(); show(); draw(); });
    animate(canvas, draw); // each frame, so the note's harmonics follow your playing
    compute(); show(); draw();
  },
};

// the Spectrum (shared/views.js), with what the wah does to it
const WAH_SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts (0 dBV is a sine of 1 V peak): the harmonics near the peak in The sweep ring out above the input\'s. The green line is the note you are playing, as the tuner hears it at the input, and the ticks along the top its harmonics.';

createPedal({ PEDAL, worklet: new URL('./wah-worklet.js', import.meta.url), views: [filterView, spectrumView({ caption: WAH_SPECTRUM })] });
