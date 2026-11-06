// rubens-main.js — Rubens' Tube's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, freqAxes, animate, markNote, markPartials, atFreq } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './rubens-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ model, for the views
const FREQS = Array.from({ length: 600 }, (_, i) => 20 * 250 ** (i / 599)); // 20 Hz to 5 kHz
const db = (v) => 20 * Math.log10(Math.max(v, 1e-9));
const MIC = 0.001; // V/Pa
const NOTE = 0.3;  // the bass's volts for the flames

function call(fn, P, extra, ...args) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  if (extra) s.f64(extra.length, 8 * v.length).set(extra);
  model[fn](s.at, ...args);
  return { s, n: v.length };
}
function parts(P) {
  const r = call('rubens_parts', P).s.f64(11);
  return { c: r[0], cutoff: r[6], modes: r[7], xm: r[8] };
}
function modes(P, n) { const r = call('rubens_modes', P).s.f64(4 * n); return Array.from({ length: n }, (_, i) => r[4 * i + 2]); }
function response(P) {
  const { s, n } = call('rubens_response', P, FREQS, FREQS.length, -1);
  const r = s.f64(4 * FREQS.length, 8 * (n + FREQS.length));
  return FREQS.map((_, i) => Math.hypot(r[4 * i], r[4 * i + 1]));
}
function along(P, f, volts, xs) {
  const { s, n } = call('rubens_along', P, [f, volts, ...xs], xs.length);
  return Array.from(s.f64(xs.length, 8 * (n + 2 + xs.length)));
}
// the gas leaving a hole goes as √(P + p): its mean over a cycle of p = A sin ωt, against √P
function meanFlow(A, P) {
  let s = 0;
  for (let i = 0; i < 64; i++) s += Math.sqrt(Math.max(0, 1 + (A / P) * Math.sin((2 * Math.PI * (i + 0.5)) / 64)));
  return s / 64;
}
const line = (g, xs, ys) => { g.beginPath(); xs.forEach((x, i) => (i ? g.lineTo(x, ys[i]) : g.moveTo(x, ys[i]))); g.stroke(); };
const hz = (f) => (f >= 1000 ? `${(f / 1000).toFixed(2)} kHz` : `${f.toFixed(1)} Hz`);

// The response: the pressure at the microphone for each volt on the speaker.
const responseView = {
  title: 'The response',
  caption: 'the pressure at the microphone for each volt the amplifier puts on the speaker, in dB of a pascal (solid): the pipe\'s resonances, where its length holds a whole number of half wavelengths, n c/2L. The ticks along the bottom are where the modes would ring with rigid ends and only the walls to damp them. The speaker\'s cone loads the lowest: their peaks are broad and low, the cone moving with the gas; higher up the cone is too heavy to move and the peaks are the pipe\'s own, sharpening as the walls take less of each. The response stops at the pipe\'s first cross mode, where plane waves give out. The green line is the note you play, the dots its harmonics.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let H, M, pp;
    const update = () => {
      const P = api.P;
      pp = parts(P);
      H = response(P);
      M = modes(P, pp.modes);
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>at the microphone, ${P.mic.toFixed(0)} % along</span><span>modes ${hz(pp.c / (2 * P.length))} apart</span><span>c ${pp.c.toFixed(1)} m/s</span><span>plane waves to ${hz(pp.cutoff)}</span>`;
    };
    const draw = () => {
      if (!H) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const { x, y, box } = freqAxes(g, w, h, { fmin: 20, fmax: 5000, dbMin: 0, dbMax: 72, step: 12 });
      const xs = FREQS.map(x), ys = H.map((v, i) => (FREQS[i] > pp.cutoff ? NaN : Math.max(box.t, Math.min(box.b, y(db(v))))));
      g.save(); g.beginPath(); g.rect(box.l, box.t, box.r - box.l, box.b - box.t); g.clip();
      g.strokeStyle = css('--ink-2'); g.lineWidth = 1;
      for (const f of M) { if (f > 5000) break; g.beginPath(); g.moveTo(x(f), box.b); g.lineTo(x(f), box.b - 6); g.stroke(); }
      g.strokeStyle = css('--accent'); g.lineWidth = 2;
      g.beginPath();
      let on = false;
      xs.forEach((X, i) => { if (Number.isNaN(ys[i])) { on = false; return; } if (on) g.lineTo(X, ys[i]); else { g.moveTo(X, ys[i]); on = true; } });
      g.stroke();
      g.restore();
      g.lineWidth = 1;
      markNote(g, x, box, api.note);
      markPartials(g, x, y, box, api, (f) => (f > pp.cutoff ? -Infinity : db(atFreq(FREQS, H, f))));
    };
    api.on('params', () => { update(); draw(); });
    animate(canvas, draw);
    update();
  },
};

// The flames: the standing wave the note you play sets up along the pipe, and the flames over it.
const flamesView = {
  title: 'The flames',
  caption: 'the pipe from the side, the speaker at the left and the cap at the right, with the gas burning from a row of holes along its top, as the note you play (its fundamental, 0.3 V from the bass) would set them. The line inside is the sound\'s pressure amplitude along the pipe, the standing wave. Bernoulli: the gas leaves a hole at a speed that goes as √(P + p), so where the pressure swings most, at the antinodes, it averages less over a cycle, and the flames are shortest; at the nodes they stand tallest, as Ficken and Stephenson explained. When the sound swings more than about four times the gas\'s pressure, the gas rushing out on each push wins and the pattern turns over, as Ficken and Stephenson saw with the gas low or the sound loud (which, Gardner, Gee and Dix say, has not been fully explained). The dotted line marks the microphone.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const HOLES = 48;
    let amp = [], flow = [], key = '', f0 = 0, pp;
    const update = () => {
      const P = api.P, f = api.note?.f || 41.2;
      const k = JSON.stringify(P) + f.toFixed(2);
      if (k === key) return;
      key = k;
      pp = parts(P);
      f0 = f;
      const xs = Array.from({ length: HOLES }, (_, i) => ((i + 0.5) / HOLES) * P.length);
      amp = along(P, f, NOTE * P.drive, xs);
      flow = amp.map((A) => meanFlow(A, P.pressure));
      const most = Math.max(...amp);
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>the flames at ${hz(f)}</span><span>swing ${most.toFixed(0)} Pa, gas ${P.pressure.toFixed(0)} Pa</span><span>λ/2 ${(pp.c / (2 * f)).toFixed(2)} m</span>`;
    };
    const draw = () => {
      update();
      if (!amp.length) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const P = api.P, l = 16, r = w - 16, top = h * 0.62, bottom = h * 0.86, X = (i) => l + ((r - l) * (i + 0.5)) / HOLES;
      // the pipe
      g.fillStyle = css('--panel-2'); g.strokeStyle = css('--ink-2'); g.lineWidth = 1;
      g.fillRect(l, top, r - l, bottom - top); g.strokeRect(l, top, r - l, bottom - top);
      g.fillStyle = css('--ink-2'); g.fillRect(l - 8, top - 6, 8, bottom - top + 12);
      // the standing wave inside
      const most = Math.max(...amp, 1e-9);
      g.strokeStyle = css('--accent-2'); g.lineWidth = 1.5;
      line(g, amp.map((_, i) => X(i)), amp.map((A) => bottom - 3 - ((bottom - top - 6) * A) / most));
      // the microphone
      const xm = l + ((r - l) * pp.xm) / P.length;
      g.setLineDash([2, 3]); g.strokeStyle = css('--ink'); line(g, [xm, xm], [top, bottom]); g.setLineDash([]);
      // the flames
      const tall = top - 12, sec = performance.now() / 1000;
      flow.forEach((q, i) => {
        const flick = 1 + 0.04 * Math.sin(sec * 23 + i * 1.7) + 0.03 * Math.sin(sec * 37 + i * 0.9);
        const fh = tall * Math.min(1.2, q) * flick, fx = X(i), fw = Math.max(2, ((r - l) / HOLES) * 0.36);
        if (fh < 2) return;
        const grd = g.createLinearGradient(fx, top, fx, top - fh);
        grd.addColorStop(0, '#3f7cff'); grd.addColorStop(0.25, '#ffb347'); grd.addColorStop(1, 'rgba(255,90,30,0)');
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(fx - fw, top);
        g.quadraticCurveTo(fx - fw, top - fh * 0.5, fx, top - fh);
        g.quadraticCurveTo(fx + fw, top - fh * 0.5, fx + fw, top);
        g.fill();
      });
    };
    api.on('params', () => { key = ''; });
    animate(canvas, draw);
  },
};

const SCOPE = 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. A note near a resonance comes out as a sine that swells and rings on; one between them, thinner and quick to stop.';
const SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts (0 dBV is a sine of 1 V peak). The pipe is linear: it makes no new frequencies, only lifts the harmonics that fall on its resonances. The green line is the note you are playing, and the ticks along the top its harmonics.';

createPedal({ PEDAL, worklet: new URL('./rubens-worklet.js', import.meta.url), views: [responseView, flamesView, scopeView({ caption: SCOPE }), spectrumView({ caption: SPECTRUM })] });
