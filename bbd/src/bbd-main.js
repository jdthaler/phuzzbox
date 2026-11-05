// bbd-main.js — the Bucket Brigade's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, freqAxes, animate, markNote, markPartials, atFreq } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './bbd-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ model, for the views
const N = 300, FREQS = Float64Array.from({ length: N }, (_, i) => 20 * 1000 ** (i / (N - 1)));

function response(P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  s.f64(N, 8 * v.length).set(FREQS);
  model.bbd_response(s.at, N);
  const r = Array.from(s.f64(4 * N, 8 * (v.length + N)));
  return { total: r.slice(0, N), chip: r.slice(2 * N, 3 * N) };
}
const khz = (f) => (f >= 1000 ? `${(f / 1000).toFixed(f >= 10e3 ? 0 : 1)} kHz` : `${f.toFixed(0)} Hz`);
const ms = (t) => (t >= 0.01 ? `${(1e3 * t).toFixed(1)} ms` : `${(1e3 * t).toFixed(2)} ms`);

// The buckets: the chain's capacitors, 28 of them evenly from the input to the output, each filled
// with the charge it holds as you play; the bass travels along them at the clock.
const bucketsView = {
  title: 'The buckets',
  caption: 'the chain of capacitors from the input (left) to the output (right), 28 of them evenly spaced along it, each filled up or down with the charge it holds as you play. Each clock cycle every charge moves two stages along, so what you played a delay ago is arriving at the right while what you play now enters at the left: the wave along the chain is the last delay\'s worth of the bass, laid out in space. Speed the clock and the wave stretches out along the chain, as the same stages hold less time.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let charges = new Array(28).fill(0), clockNow = 0, delayNow = 0, big = 0.05;
    const update = () => {
      const P = api.P, n = Number(P.stages);
      legend.innerHTML = `<span>${n} stages, ${n / 2} charges</span><span>clock ${khz(clockNow || P.clock)}</span><span>delay ${ms(delayNow || n / (2 * P.clock))}</span>`;
    };
    const draw = () => {
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const l = 34, r = w - 10, t = 18, b = h - 26, mid = (t + b) / 2, n = charges.length;
      const pitch = (r - l) / n, cw = Math.max(4, pitch * 0.55);
      big = Math.max(0.97 * big, 1.1 * Math.max(0.005, ...charges.map(Math.abs)));
      g.font = '11px system-ui, sans-serif';
      g.strokeStyle = css('--grid'); g.lineWidth = 1;
      g.beginPath(); g.moveTo(l, mid); g.lineTo(r, mid); g.stroke();
      charges.forEach((q, k) => {
        const x0 = l + k * pitch + (pitch - cw) / 2, hh = ((b - t) / 2) * Math.max(-1, Math.min(1, q / big));
        // the capacitor: two plates, and its charge as a fill
        g.strokeStyle = css('--ink-2');
        g.strokeRect(x0, t, cw, b - t);
        g.fillStyle = css(q >= 0 ? '--accent' : '--accent-2');
        g.globalAlpha = 0.85;
        g.fillRect(x0 + 1, hh >= 0 ? mid - hh : mid, cw - 2, Math.abs(hh));
        g.globalAlpha = 1;
      });
      g.fillStyle = css('--ink-2'); g.textAlign = 'left';
      g.fillText('in', 4, mid + 4);
      g.textAlign = 'right'; g.fillText('out', r, t - 5);
      g.textAlign = 'left'; g.fillText(`two stages a clock cycle →   ±${(1e3 * big).toFixed(0)} mV`, l, h - 8);
    };
    api.on('params', () => { update(); draw(); });
    api.on('pedal', (messages) => {
      const m = messages.filter((x) => x.type === 1).pop();
      if (!m) return;
      charges = Array.from(m.values.slice(0, 28));
      clockNow = m.values[28]; delayNow = m.values[29];
      update();
    });
    animate(canvas, draw);
    update();
  },
};

// The response: the pedal's gain against frequency with the clock at rest: the comb the delay and
// the dry make, through the filters, the hold and the transfer loss; above half the clock, aliases.
const responseView = {
  title: 'The response',
  caption: 'the gain from the input to the output against frequency, the clock at rest, in dB (solid), and the chip\'s own (dashed): the anti-aliasing and reconstruction filters, the hold\'s sinc, the charges\' losses along the chain, and, mixed with the dry sound, the comb of peaks and notches the delay makes, which Feedback sharpens. Above half the clock (the shaded band) nothing passes as itself: whatever the filters let through comes out at its alias, folded back below. The green dots are the note you play.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let R, P;
    const db = (x) => 20 * Math.log10(Math.max(x, 1e-6));
    const update = () => {
      P = api.P; R = response(P);
      const n = Number(P.stages), tau = n / (2 * P.clock);
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>delay ${ms(tau)}: notches every ${khz(1 / tau)}</span><span>half the clock ${khz(P.clock / 2)}</span><span>filters ${khz(P.filter)}</span>`;
    };
    const draw = () => {
      if (!R) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const { x, y, box } = freqAxes(g, w, h, { fmin: 20, fmax: 20000, dbMin: -42, dbMax: 12, step: 6 });
      const half = P.clock / 2;
      if (half < 20000) {
        g.fillStyle = css('--accent-2'); g.globalAlpha = 0.12;
        g.fillRect(x(Math.max(20, half)), box.t, box.r - x(Math.max(20, half)), box.b - box.t);
        g.globalAlpha = 1;
      }
      const line = (vals, colour, dash) => {
        g.strokeStyle = colour; g.lineWidth = dash ? 1.5 : 2.5; g.setLineDash(dash ? [5, 4] : []);
        g.beginPath();
        vals.forEach((v, i) => { const Y = Math.max(box.t, Math.min(box.b, y(db(v)))); i ? g.lineTo(x(FREQS[i]), Y) : g.moveTo(x(FREQS[i]), Y); });
        g.stroke(); g.setLineDash([]); g.lineWidth = 1;
      };
      line(R.chip, css('--ink-2'), true);
      line(R.total, css('--accent'), false);
      markNote(g, x, box, api.note);
      markPartials(g, x, y, box, api, (f) => db(atFreq(FREQS, R.total, f)));
    };
    api.on('params', () => { update(); draw(); });
    animate(canvas, draw);
    update();
  },
};

const SCOPE = 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. With Mix at half, the output is the bass plus itself a few milliseconds late; on a long delay you see each note come round again. At a low clock, look closely: the output is smooth, but only because the reconstruction filter has rounded off the chip\'s staircase of held charges.';
const SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts (0 dBV is a sine of 1 V peak): the comb\'s notches pull regular dips through the bass\'s harmonics, and as the clock swings they slide. With the clock low and the filters open, lines appear that the bass never played: its upper harmonics folded back below half the clock. The green line is the note you are playing, and the ticks along the top its harmonics.';

createPedal({ PEDAL, worklet: new URL('./bbd-worklet.js', import.meta.url), views: [bucketsView, responseView, scopeView({ caption: SCOPE }), spectrumView({ caption: SPECTRUM })] });
