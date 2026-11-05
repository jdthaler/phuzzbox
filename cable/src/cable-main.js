// cable-main.js — the Transatlantic Cable's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, animate, markNote } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './cable-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ model, for the views

const call = (P, fn, extra = []) => {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  if (extra.length) s.f64(extra.length, 8 * v.length).set(extra);
  fn(s.at);
  return { s, n: v.length, at: (k, off) => Array.from(s.f64(k, 8 * off)) };
};
function parts(P) {
  const r = Array.from(call(P, (at) => model.cable_parts(at)).s.f64(16));
  return { R: r[0], L: r[1], C: r[2], G: r[3], length: r[4], loading: r[5], coil: r[6], source: r[7], load: r[8], gain: r[9], sections: r[10], delay: r[11], loss: r[12], z0: r[13], cutoff: r[14] };
}
function response(P, freqs) {
  const n = freqs.length, r = call(P, (at) => model.cable_response(at, n), freqs);
  return { gain: r.at(n, r.n + n), phase: r.at(n, r.n + 2 * n) };
}
function step(P, dt, n) {
  const r = call(P, (at) => model.cable_step(at, n), [dt, ...new Array(n).fill(0)]);
  return r.at(n, r.n + 1);
}
const km = (m) => `${(m / 1000).toFixed(m < 10e3 ? 1 : 0)} km`;
const time = (s) => (s >= 1 ? `${s.toFixed(1)} s` : s >= 1e-3 ? `${(s * 1e3).toFixed(s < 0.01 ? 1 : 0)} ms` : `${(s * 1e6).toFixed(0)} µs`);
const LOADING = ['unloaded', 'coil-loaded', 'Heaviside-loaded'];

// the voltage along the line, from the engine's messages
function tracker(api) {
  const now = { along: new Float32Array(24), far: 0 }, peak = new Float32Array(24);
  api.on('pedal', (messages) => {
    for (const m of messages) {
      if (m.type !== 1) continue;
      now.along.set(m.values.subarray(0, 24));
      now.far = m.values[24];
      for (let k = 0; k < 24; k++) peak[k] = Math.max(0.97 * peak[k], Math.abs(now.along[k]));
    }
  });
  return { now, peak };
}

// Along the cable: the voltage at 24 points from the near end to the far end, now, and how far it
// has swung lately (shaded). On an unloaded cable the signal seeps in and dies away within the
// first stretch, the higher notes sooner; on a loaded one it travels as a wave.
const alongView = {
  title: 'Along the cable',
  caption: 'the voltage along the cable from your end (left) to the far end (right), thirty times a second, and how far it has swung lately (shaded). On an unloaded cable, the 1858 Atlantic cable\'s kind, a note doesn\'t travel down the line so much as seep into it, as heat does into a bar: it dies away within the first stretch, the higher notes sooner. Loaded, the line carries it as a wave, and with the far end open the wave comes back.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const { now, peak } = tracker(api);
    let pp;
    const update = () => {
      pp = parts(api.P);
      const t = pp.loading === 2 ? `a wave takes ${time(pp.delay)} to cross` : `RCℓ² = ${time(pp.R * pp.C * pp.length ** 2)}`;
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>${km(pp.length)}, ${LOADING[pp.loading]}</span><span>${t}</span>`;
    };
    const draw = () => {
      if (!pp) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const box = { l: 34, r: w - 10, t: 12, b: h - 24 };
      const top = Math.max(1e-3, ...peak) * 1.1, X = (k) => box.l + ((box.r - box.l) * (k + 0.5)) / 24, Y = (v) => (box.t + box.b) / 2 - ((box.b - box.t) / 2) * (v / top);
      g.strokeStyle = css('--grid'); g.lineWidth = 1; g.strokeRect(box.l, box.t, box.r - box.l, box.b - box.t);
      g.beginPath(); g.moveTo(box.l, Y(0)); g.lineTo(box.r, Y(0)); g.stroke();
      g.fillStyle = css('--ink-2'); g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText('your end', box.l + 26, box.b + 14); g.fillText('far end', box.r - 24, box.b + 14); g.fillText(km(pp.length / 2), (box.l + box.r) / 2, box.b + 14);
      g.textAlign = 'right'; g.fillText(`${(1000 * top).toFixed(top < 0.01 ? 1 : 0)} mV`, box.l - 4, box.t + 8);
      g.fillStyle = 'rgba(232,217,176,0.15)'; g.beginPath();
      for (let k = 0; k < 24; k++) (k ? g.lineTo(X(k), Y(peak[k])) : g.moveTo(X(k), Y(peak[k])));
      for (let k = 23; k >= 0; k--) g.lineTo(X(k), Y(-peak[k]));
      g.fill();
      g.strokeStyle = css('--accent'); g.lineWidth = 2.5; g.beginPath();
      for (let k = 0; k < 24; k++) (k ? g.lineTo(X(k), Y(now.along[k])) : g.moveTo(X(k), Y(now.along[k])));
      g.stroke(); g.lineWidth = 1;
    };
    api.on('params', update);
    animate(canvas, draw);
    update();
  },
};

// The line's response: what reaches the far end of each frequency, in dB, with the coils' cutoff
// marked.
const F = Float64Array.from({ length: 200 }, (_, i) => 20 * 1000 ** (i / 199));
const responseView = {
  title: 'The response',
  caption: 'how much of each frequency reaches the far end, in dB, from the source\'s volt. An unloaded cable\'s loss in decibels grows as the square root of the frequency, a slope no circuit of a few parts makes, so the highs vanish first and fastest over a long cable; on a submarine cable it levels off at a few kilohertz, where the cable\'s own inductance takes over from its resistance. Coils every 1.83 km hold the loss down to their cutoff (dashed), and above it pass nothing. Heaviside\'s line loses every frequency alike. With the far end open the waves reflect, and the response ripples. The green line is the note you are playing.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let H, pp;
    const update = () => {
      pp = parts(api.P);
      H = response(api.P, Array.from(F)).gain.map((v) => 20 * Math.log10(Math.max(v, 1e-12)));
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>${km(pp.length)}, ${LOADING[pp.loading]}</span>${pp.cutoff ? `<span>cutoff ${(pp.cutoff / 1000).toFixed(2)} kHz</span>` : ''}${pp.loading === 2 ? `<span>a flat ${(-20 * Math.log10(pp.loss)).toFixed(1)} dB along it</span>` : ''}`;
    };
    const draw = () => {
      if (!H) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const box = { l: 40, r: w - 10, t: 12, b: h - 24 };
      const top = Math.ceil((Math.max(...H) + 3) / 10) * 10, bot = top - 80;
      const X = (f) => box.l + ((box.r - box.l) * Math.log(f / 20)) / Math.log(1000), Y = (d) => box.t + ((box.b - box.t) * (top - Math.max(d, bot))) / (top - bot);
      g.strokeStyle = css('--grid'); g.lineWidth = 1; g.strokeRect(box.l, box.t, box.r - box.l, box.b - box.t);
      g.fillStyle = css('--ink-2'); g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
      for (const f of [100, 1000, 10000]) { g.beginPath(); g.moveTo(X(f), box.t); g.lineTo(X(f), box.b); g.stroke(); g.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, X(f), box.b + 14); }
      g.textAlign = 'right';
      for (let d = top; d >= bot; d -= 20) g.fillText(`${d}`, box.l - 4, Y(d) + 4);
      if (pp.cutoff) { g.setLineDash([4, 4]); g.beginPath(); g.moveTo(X(pp.cutoff), box.t); g.lineTo(X(pp.cutoff), box.b); g.stroke(); g.setLineDash([]); }
      g.strokeStyle = css('--accent'); g.lineWidth = 2.5; g.beginPath();
      H.forEach((d, i) => (i ? g.lineTo(X(F[i]), Y(d)) : g.moveTo(X(F[i]), Y(d))));
      g.stroke(); g.lineWidth = 1;
      markNote(g, X, box, api.note);
    };
    api.on('params', () => { update(); draw(); });
    animate(canvas, draw);
    update();
  },
};

// The arrival: what the far end sees when a volt is switched on at the near end, Kelvin's view of a
// telegraph key pressed: for this length (solid), half of it and twice it (faint, where the Length
// knob reaches).
const arrivalView = {
  title: 'The arrival',
  caption: 'what the far end sees when a volt is switched on at your end, as a telegraph key does: for this length (solid), and for half and twice it (faint). On an unloaded cable the voltage creeps up, and how long it takes grows as the square of the length (Kelvin\'s law of squares): twice the cable, four times the wait. Across the Atlantic it was seconds, and the 1858 cable\'s messages crept. On a Heaviside line the step arrives whole after the line\'s delay, smaller by its loss, and with the far end open the reflections arrive after it, stair by stair.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const N = 600;
    let curves, span, pp;
    const update = () => {
      pp = parts(api.P);
      // long enough for the doubled cable's arrival: four of its delays, or eight of its RCℓ²
      const twice = 2 * pp.length;
      span = pp.loading === 2 ? 4 * 2 * pp.delay : Math.min(2, Math.max(2e-4, 0.8 * pp.R * pp.C * twice * twice + 4 * twice * Math.sqrt((pp.L + (pp.loading === 1 ? pp.coil / 1828.8 : 0)) * pp.C)));
      const lens = [0.5, 1, 2].map((k) => k * pp.length);
      curves = lens.map((l) => (l >= 1e3 && l <= 200e3 ? step({ ...api.P, length: l }, span / N, N) : null));
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>${km(pp.length)}</span><span>faint: ${km(lens[0])} and ${km(lens[2])}</span>`;
    };
    const draw = () => {
      if (!curves) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const box = { l: 40, r: w - 10, t: 12, b: h - 24 };
      const top = Math.max(1e-6, ...curves.filter(Boolean).flatMap((c) => c.map(Math.abs))) * 1.1;
      const X = (i) => box.l + ((box.r - box.l) * i) / (N - 1), Y = (v) => box.b - ((box.b - box.t) * (v + 0.1 * top)) / (1.1 * top);
      g.strokeStyle = css('--grid'); g.lineWidth = 1; g.strokeRect(box.l, box.t, box.r - box.l, box.b - box.t);
      g.beginPath(); g.moveTo(box.l, Y(0)); g.lineTo(box.r, Y(0)); g.stroke();
      g.fillStyle = css('--ink-2'); g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText('0', box.l, box.b + 14); g.fillText(time(span / 2), (box.l + box.r) / 2, box.b + 14); g.fillText(time(span), box.r - 16, box.b + 14);
      g.textAlign = 'right'; g.fillText(`${(1000 * top / 1.1).toFixed(0)} mV`, box.l - 4, box.t + 10);
      curves.forEach((c, j) => {
        if (!c) return;
        g.strokeStyle = j === 1 ? css('--accent') : 'rgba(232,217,176,0.45)'; g.lineWidth = j === 1 ? 2.5 : 1.5; g.beginPath();
        c.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))));
        g.stroke();
      });
      g.lineWidth = 1;
    };
    api.on('params', () => { update(); draw(); });
    animate(canvas, draw);
    update();
  },
};

const SCOPE = 'the bass going in (dashed) and coming out of the far end (solid), each scaled to fit. Down an unloaded cable the edges round off and the wave lags, the highs lost first; down a Heaviside line it arrives late but whole, and with the far end open, its echoes follow.';
const SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts. Watch the highs fall away as the cable grows, as the square root of the frequency, unloaded; stop dead above the coils\' cutoff; or, on Heaviside\'s line, all fall together. The green line is the note you are playing, and the ticks along the top its harmonics.';

createPedal({ PEDAL, worklet: new URL('./cable-worklet.js', import.meta.url), views: [alongView, responseView, arrivalView, scopeView({ caption: SCOPE }), spectrumView({ caption: SPECTRUM })] });
