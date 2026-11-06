// helmholtz-main.js — Helmholtz's Resonators' page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, freqAxes, animate, markNote, markPartials, atFreq } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './helmholtz-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ model, for the views
const FMIN = 50, FMAX = 2000;
const FREQS = Array.from({ length: 400 }, (_, i) => FMIN * (FMAX / FMIN) ** (i / 399));
const db = (v) => 20 * Math.log10(Math.max(v, 1e-9));
const hz = (f) => (f >= 1000 ? `${(f / 1000).toFixed(2)} kHz` : `${f.toFixed(1)} Hz`);

function call(fn, P, extra, ...args) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  if (extra) s.f64(extra.length, 8 * v.length).set(extra);
  model[fn](s.at, ...args);
  return { s, n: v.length };
}
function parts(P) {
  const r = call('helmholtz_parts', P).s.f64(65);
  return { c: r[0], one: r[3], res: Array.from({ length: 10 }, (_, k) => ({ f0: r[5 + 6 * k], Q: r[6 + 6 * k] })) };
}
// |pressure inside / pressure outside| for resonator k at the frequencies fr; with less, |inside − outside|
function gains(P, k, fr, less = 0) {
  const { s, n } = call('helmholtz_response', P, fr, fr.length, k);
  const r = s.f64(2 * fr.length, 8 * (n + fr.length));
  return fr.map((_, i) => Math.hypot(r[2 * i] - less, r[2 * i + 1]));
}

// The resonators: each one's response, the one at your ear bright.
const responseView = {
  title: 'The resonators',
  caption: 'the pressure inside each of Helmholtz\'s ten resonators for each pascal of sound outside, in dB, the one at your ear bright. Each is the air in its neck, a mass, on the spring of the air inside: below its resonance the air inside simply follows the air outside, at it the sound inside is Q times the sound outside, and above it falls away, 12 dB an octave. The green line is the note you play, the dots its harmonics: the one nearest the bright peak is the partial you hear ring out.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let H = [], pp;
    const update = () => {
      const P = api.P;
      pp = parts(P);
      H = pp.res.map((_, k) => gains(P, k, FREQS));
      const r = pp.res[pp.one];
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>resonator ${pp.one + 1} at your ear</span><span>${hz(r.f0)}, Q ${r.Q.toFixed(0)}</span><span>c ${pp.c.toFixed(1)} m/s</span>`;
    };
    const draw = () => {
      if (!H.length) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const { x, y, box } = freqAxes(g, w, h, { fmin: FMIN, fmax: FMAX, dbMin: -24, dbMax: 48, step: 12 });
      const xs = FREQS.map(x);
      g.save(); g.beginPath(); g.rect(box.l, box.t, box.r - box.l, box.b - box.t); g.clip();
      H.forEach((curve, k) => {
        if (k === pp.one) return;
        g.strokeStyle = css('--ink-2'); g.globalAlpha = 0.45; g.lineWidth = 1;
        g.beginPath(); curve.forEach((v, i) => { const Y = Math.max(box.t, Math.min(box.b, y(db(v)))); if (i) g.lineTo(xs[i], Y); else g.moveTo(xs[i], Y); }); g.stroke();
      });
      g.globalAlpha = 1; g.strokeStyle = css('--accent'); g.lineWidth = 2;
      g.beginPath(); H[pp.one].forEach((v, i) => { const Y = Math.max(box.t, Math.min(box.b, y(db(v)))); if (i) g.lineTo(xs[i], Y); else g.moveTo(xs[i], Y); }); g.stroke();
      g.restore();
      g.lineWidth = 1;
      markNote(g, x, box, api.note);
      markPartials(g, x, y, box, api, (f) => db(atFreq(FREQS, H[pp.one], f)));
    };
    api.on('params', () => { update(); draw(); });
    animate(canvas, draw);
    update();
  },
};

// Koenig's flames: each resonator's air shaking a gas flame, seen in a rotating mirror.
const flamesView = {
  title: 'Koenig\'s flames',
  caption: 'Rudolph Koenig\'s manometric flames on Helmholtz\'s ten resonators, side by side: each with a little gas chamber behind a rubber membrane at its second opening, its flame leaping as the air in the resonator shakes. In a rotating mirror a steady flame draws a smooth ribbon and a shaking one a row of tongues, one to each cycle, wider apart for the lower resonators. Here each flame shakes as the air in its resonator\'s neck moves, which goes as the pressure inside less the pressure outside, the loudest the tallest and 30 dB under it flat: below its pitch a resonator\'s air simply follows the air outside and its neck\'s air barely moves, so that a note lights only the resonators its partials fall on, the tone analysed at a glance.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    let pp, H2 = [], bins = 0, rate = 0, buf = null, key = '';
    const levels = new Float64Array(10);
    const prepare = () => {
      const an = api.input;
      if (!an) return false;
      const k = `${JSON.stringify(api.P)}|${an.fftSize}|${api.ctx.sampleRate}`;
      if (k === key) return true;
      key = k;
      pp = parts(api.P);
      rate = api.ctx.sampleRate;
      bins = Math.min(an.frequencyBinCount, Math.ceil((2.5 * FMAX * an.fftSize) / rate));
      const fr = Array.from({ length: bins }, (_, b) => Math.max(1, (b * rate) / an.fftSize));
      H2 = pp.res.map((_, j) => gains(api.P, j, fr, 1).map((v) => v * v));
      buf = new Float32Array(an.frequencyBinCount);
      return true;
    };
    const draw = () => {
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      if (!pp) pp = parts(api.P);
      levels.fill(-Infinity);
      if (prepare()) {
        api.input.getFloatFrequencyData(buf);
        for (let j = 0; j < 10; j++) {
          let s = 0;
          for (let b = 1; b < bins; b++) if (Number.isFinite(buf[b])) s += H2[j][b] * 10 ** (buf[b] / 10);
          levels[j] = 10 * Math.log10(s + 1e-30);
        }
      }
      const top = Math.max(...levels), sec = performance.now() / 1000;
      const row = (h - 8) / 10, l = 70, r = w - 10;
      g.font = '11px system-ui, sans-serif'; g.textBaseline = 'middle';
      for (let j = 0; j < 10; j++) {
        const y0 = 4 + row * (j + 1) - 3, amp = top > -110 ? Math.max(0, Math.min(1, (levels[j] - top + 30) / 30)) : 0;
        const lambda = Math.max(6, (36 * pp.res[0].f0) / pp.res[j].f0), base = row * 0.28, lift = row * 0.55 * amp;
        g.fillStyle = j === pp.one ? css('--accent') : css('--ink-2');
        g.textAlign = 'right';
        g.fillText(`${j + 1} · ${pp.res[j].f0.toFixed(0)} Hz`, l - 8, y0 - row * 0.35);
        const grd = g.createLinearGradient(0, y0, 0, y0 - base - lift);
        grd.addColorStop(0, '#3f7cff'); grd.addColorStop(0.35, '#ffb347'); grd.addColorStop(1, 'rgba(255,110,40,0.85)');
        g.fillStyle = grd;
        g.beginPath(); g.moveTo(l, y0);
        const shift = (sec * 60) % lambda;
        for (let X = l; X <= r; X += 2) {
          const ph = ((X - l + shift) % lambda) / lambda; // a tongue each cycle: rising slowly, falling fast
          g.lineTo(X, y0 - base - lift * Math.sin(Math.PI * ph) ** 2);
        }
        g.lineTo(r, y0); g.closePath(); g.fill();
      }
    };
    api.on('params', () => { key = ''; pp = parts(api.P); });
    animate(canvas, draw);
  },
};

const SCOPE = 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. A note whose partial falls on the resonance comes out with a sine riding on it that swells and rings on after the note.';
const SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts (0 dBV is a sine of 1 V peak). The resonator is linear: it makes no new frequencies, only lifts the partial that falls on its resonance and lets the rest of the bass through below it. The green line is the note you are playing, and the ticks along the top its harmonics.';

createPedal({ PEDAL, worklet: new URL('./helmholtz-worklet.js', import.meta.url), views: [responseView, flamesView, scopeView({ caption: SCOPE }), spectrumView({ caption: SPECTRUM })] });
