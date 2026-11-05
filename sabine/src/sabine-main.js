// sabine-main.js — Sabine's Room's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, animate, markNote } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './sabine-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ model, for the views
const CENTRES = [125, 250, 500, 1000, 2000, 4000];
const C0 = 343.2;
const db = (v) => 10 * Math.log10(Math.max(v, 1e-12)); // of energies

function call(fn, P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  model[fn](s.at);
  return s;
}
function parts(P) {
  const r = call('sabine_parts', P).f64(28);
  const band = (k) => CENTRES.map((_, b) => r[4 + 4 * b + k]);
  return { V: r[0], S: r[1], d: r[2], Re: r[3], A: band(0), sabine: band(1), eyring: band(2), m: band(3) };
}
function early(P) {
  const r = call('sabine_early', P).f64(65 * 8);
  return Array.from({ length: 65 }, (_, i) => ({ r: r[8 * i], order: r[8 * i + 1], gain: Array.from(r.subarray(8 * i + 2, 8 * i + 8)) }));
}
const line = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
const fmt = (v, unit) => `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${unit}`;

// The decay: each octave's reverberation time, Eyring's and Sabine's.
const decayView = {
  title: 'The decay',
  caption: 'how long each octave takes to die away by 60 dB once the bass stops, its reverberation time T60: Eyring\'s (solid), which the pedal plays, and Sabine\'s (dashed), 55.3 V/(c A) with A the absorption area, every surface\'s area times its absorption coefficient, plus the air\'s. The two agree in a live room and part in a dead one, where Sabine\'s overstates it. The legend gives the room\'s volume, its absorption at 1 kHz, the critical distance, where the room is as loud as the bass, and Schroeder\'s frequency, 2000 √(T/V), above which the room\'s modes overlap and it sounds diffuse rather than resonant. The green line is the note you are playing.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let pp;
    const update = () => {
      pp = parts(api.P);
      const rc = Math.sqrt(pp.A[3] / (16 * Math.PI)), fs = 2000 * Math.sqrt(pp.eyring[3] / pp.V);
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>Eyring</span><span>dashed: Sabine</span><span>V ${fmt(pp.V, 'm³')}</span><span>A ${fmt(pp.A[3], 'm²')} at 1 kHz</span><span>critical distance ${fmt(rc, 'm')}</span><span>Schroeder ${fmt(fs, 'Hz')}</span>`;
    };
    const draw = () => {
      if (!pp) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      g.font = '11px system-ui, sans-serif';
      const f0 = 88, f1 = 5657, most = Math.max(...pp.sabine, ...pp.eyring);
      const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20], step = steps.find((s) => most / s <= 5) || 50, top = step * Math.ceil((most * 1.05) / step);
      const box = { l: 40, r: w - 10, t: 10, b: h - 22 };
      const x = (f) => box.l + ((box.r - box.l) * Math.log(f / f0)) / Math.log(f1 / f0), y = (t) => box.b - ((box.b - box.t) * t) / top;
      g.strokeStyle = css('--grid'); g.fillStyle = css('--ink-2'); g.lineWidth = 1; g.textAlign = 'center';
      for (const f of CENTRES) { g.beginPath(); g.moveTo(x(f), box.t); g.lineTo(x(f), box.b); g.stroke(); g.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x(f), h - 6); }
      g.textAlign = 'right';
      for (let t = 0; t <= top + 1e-9; t += step) { g.beginPath(); g.moveTo(box.l, y(t)); g.lineTo(box.r, y(t)); g.stroke(); g.fillText(`${+t.toFixed(1)} s`, box.l - 4, y(t) + 4); }
      g.strokeStyle = css('--ink-2'); g.lineWidth = 1.2; g.setLineDash([5, 4]);
      line(g, CENTRES.map((f, b) => [x(f), y(pp.sabine[b])]));
      g.setLineDash([]);
      g.strokeStyle = css('--accent'); g.fillStyle = css('--accent'); g.lineWidth = 2.5;
      line(g, CENTRES.map((f, b) => [x(f), y(pp.eyring[b])]));
      CENTRES.forEach((f, b) => { g.beginPath(); g.arc(x(f), y(pp.eyring[b]), 3.5, 0, 2 * Math.PI); g.fill(); });
      g.lineWidth = 1;
      markNote(g, x, box, api.note);
    };
    api.on('params', () => { update(); draw(); });
    animate(canvas, draw);
    update();
  },
};

// The echogram: what reaches you at 1 kHz after the bass sounds, arrival by arrival.
const echoView = {
  title: 'The echogram',
  caption: 'what reaches you at 1 kHz after a click of the bass, in dB of the click\'s energy a metre away: first the direct sound, d away, then each of the first 64 reflections (the stems), each an image of the bass mirrored in the walls, as far away as its path and weakened by each surface it bounced off and by the air. Then the reflections come too thick to count, and the pedal plays the diffuse field (the curve, its energy in each millisecond), 4π c/V of it a second, dying away in Eyring\'s time. Reflections of the first order are the brightest stems; the dotted line is where the late sound takes over.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let pp, refl;
    const update = () => {
      pp = parts(api.P);
      refl = early(api.P);
      const gap = ((refl[1].r - refl[0].r) / C0) * 1000;
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>direct, ${(db(refl[0].gain[3] ** 2)).toFixed(0)} dB at ${fmt(pp.d, 'm')}</span><span>first reflection ${gap.toFixed(1)} ms later</span><span>late sound from ${(((pp.Re - pp.d) / C0) * 1000).toFixed(0)} ms</span><span>T60 ${fmt(pp.eyring[3], 's')} at 1 kHz</span>`;
    };
    const draw = () => {
      if (!pp) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      g.font = '11px system-ui, sans-serif';
      const start = (pp.Re - pp.d) / C0, span = Math.max(0.1, Math.min(2 * pp.eyring[3], 2.5 * start + 0.05));
      const top = 6 * Math.ceil(db(refl[0].gain[3] ** 2) / 6 + 0.5), range = 60;
      const box = { l: 40, r: w - 10, t: 10, b: h - 22 };
      const x = (t) => box.l + ((box.r - box.l) * t) / span, y = (v) => Math.min(box.b, box.t + ((box.b - box.t) * (top - v)) / range);
      g.strokeStyle = css('--grid'); g.fillStyle = css('--ink-2'); g.lineWidth = 1; g.textAlign = 'center';
      const most = Math.max(2, Math.floor((box.r - box.l) / 60)), tick = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1].find((s) => span / s <= most) || 2;
      for (let t = 0; t <= span + 1e-9; t += tick) { g.beginPath(); g.moveTo(x(t), box.t); g.lineTo(x(t), box.b); g.stroke(); g.textAlign = x(t) > box.r - 24 ? 'right' : 'center'; g.fillText(`${+(t * 1000).toFixed(0)} ms`, Math.min(x(t), box.r), h - 6); }
      g.textAlign = 'right';
      for (let v = top; v >= top - range; v -= 12) { g.beginPath(); g.moveTo(box.l, y(v)); g.lineTo(box.r, y(v)); g.stroke(); g.fillText(`${v}`, box.l - 4, y(v) + 4); }
      // the late sound
      const T = pp.eyring[3], power = (t) => ((4 * Math.PI * C0) / pp.V) * 1e-3 * Math.exp((-6 * Math.log(10) * (t + pp.d / C0)) / T);
      g.strokeStyle = css('--accent-2'); g.lineWidth = 2;
      const pts = [];
      for (let k = 0; k <= 200; k++) { const t = start + ((span - start) * k) / 200; pts.push([x(t), y(db(power(t)))]); }
      if (start < span) line(g, pts);
      g.setLineDash([2, 3]); g.strokeStyle = css('--ink-2'); g.lineWidth = 1;
      line(g, [[x(start), box.t], [x(start), box.b]]);
      g.setLineDash([]);
      // the arrivals
      refl.forEach((e, i) => {
        const t = (e.r - pp.d) / C0;
        if (t > span) return;
        g.strokeStyle = i === 0 ? css('--accent') : e.order === 1 ? css('--ink') : css('--ink-2');
        g.lineWidth = i === 0 ? 3 : 1.5;
        line(g, [[x(t), box.b], [x(t), y(db(e.gain[3] ** 2))]]);
      });
      g.lineWidth = 1;
    };
    api.on('params', () => { update(); draw(); });
    animate(canvas, draw);
    update();
  },
};

const SCOPE = 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. Near the bass the note keeps its shape; across a reverberant room it comes out smeared, each period overlaid with the ones before it still ringing.';
const SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts (0 dBV is a sine of 1 V peak). The room is linear: it makes no new frequencies. It lifts or cuts each octave by how long the octave rings, and adds the notes you played a moment ago, still dying away.';

createPedal({ PEDAL, worklet: new URL('./sabine-worklet.js', import.meta.url), views: [decayView, echoView, scopeView({ caption: SCOPE }), spectrumView({ caption: SPECTRUM })] });
