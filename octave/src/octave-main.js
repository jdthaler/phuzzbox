// octave-main.js — the Octave Down's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, animate } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './octave-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ divider, for the views
const N = 800, A = 0.2; // points drawn; the sine's amplitude (V), a bass played firmly

// the divider playing a steady sine of f (octave-web.cpp): eight of its cycles, N points
function wave(P, f) {
  const v = Effect.native(P), s = scratch(model), stride = Math.max(1, Math.round((8 * 48000) / f / N));
  s.f64(v.length + 2).set([...v, f, A]);
  model.octave_wave(s.at, N, stride);
  const o = s.f64(5 * N, 8 * (v.length + 2));
  return { xf: Array.from(o.subarray(0, N)), q1: Array.from(o.subarray(N, 2 * N)), q2: Array.from(o.subarray(2 * N, 3 * N)), y1: Array.from(o.subarray(3 * N, 4 * N)), y2: Array.from(o.subarray(4 * N)) };
}

// The divider, as a logic analyser shows it: the filtered bass, the two flip-flops, the octaves.
const dividerView = {
  title: 'The divider',
  caption: `eight cycles of a steady ${A * 1000} mV sine at the note you are playing (55 Hz until you play), through the divider as it is set: the filtered bass with the comparator's thresholds (dashed), the flip-flops q₁ and q₂ toggling on its rising crossings, and the octaves, the filtered bass with its polarity flipped by each. One octave down repeats every two cycles, two octaves down every four.`,
  mount(holder, api) {
    holder.classList.add('lanes');
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let w = null, f = 55, key = '', tracked = 0;
    const update = () => {
      const fn = api.note?.f && api.note.f > 25 && api.note.f < 600 ? api.note.f : f;
      const k = `${Object.values(api.P).join()}|${Math.round(fn * 10)}`;
      if (k === key) return;
      key = k; f = fn; w = wave(api.P, f);
    };
    api.on('params', () => { key = ''; update(); });
    api.on('pedal', (messages) => { for (const m of messages) if (m.type === 1) tracked = m.values[0]; });
    let shown = 0;
    animate(canvas, () => {
      if (++shown % 15 === 0) {
        update();
        legend.innerHTML = `<span>the picture: ${f.toFixed(1)} Hz</span><span style="color:var(--good)">● ${tracked > 0 ? `the comparator now: ${tracked.toFixed(1)} Hz` : 'the dividers wait for a note'}</span>`;
      }
      if (!w) return;
      const { g, w: W, h } = fit(canvas);
      g.clearRect(0, 0, W, h);
      const lanes = [['x_f', w.xf, 'signal'], ['q₁', w.q1, 'logic'], ['q₂', w.q2, 'logic'], ['1 down', w.y1, 'signal'], ['2 down', w.y2, 'signal']];
      const l = 54, r = W - 8, lh = (h - 8) / lanes.length, X = (i) => l + ((r - l) * i) / (N - 1);
      const top = Math.max(1e-6, ...w.xf.map(Math.abs), ...w.y1.map(Math.abs), ...w.y2.map(Math.abs));
      g.font = '11px system-ui, sans-serif'; g.textAlign = 'right';
      lanes.forEach(([name, ys, kind], k) => {
        const mid = 4 + lh * (k + 0.5), amp = lh * 0.38, Y = (v) => mid - (kind === 'logic' ? v : v / top) * amp;
        g.strokeStyle = css('--grid'); g.lineWidth = 1; g.beginPath(); g.moveTo(l, mid); g.lineTo(r, mid); g.stroke();
        g.fillStyle = css('--ink-2'); g.fillText(name, l - 8, mid + 4);
        if (k === 0) {
          g.setLineDash([4, 3]); g.strokeStyle = css('--warn');
          for (const s of [1, -1]) { const yy = Y(s * api.P.hyst); g.beginPath(); g.moveTo(l, yy); g.lineTo(r, yy); g.stroke(); }
          g.setLineDash([]);
        }
        g.beginPath(); g.strokeStyle = kind === 'logic' ? css('--good') : k === 0 ? css('--ink') : css('--accent'); g.lineWidth = kind === 'logic' ? 1.5 : 2;
        ys.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))));
        g.stroke();
      });
    });
    update();
  },
};

const OCTAVE_SCOPE = 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. With the octave alone, the output\'s wave repeats every two of the input\'s cycles: every other hump of the note turned upside down.';
const OCTAVE_SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts: the octave puts a new line at half the note\'s frequency and between each of its harmonics, and two octaves down at a quarter. The green line is the note you are playing, as the tuner hears it at the input, and the ticks along the top its harmonics.';

createPedal({ PEDAL, worklet: new URL('./octave-worklet.js', import.meta.url), views: [dividerView, spectrumView({ caption: OCTAVE_SPECTRUM }), scopeView({ caption: OCTAVE_SCOPE })] });
