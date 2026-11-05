// openair-main.js — Open Air's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, freqAxes, animate, markNote, markPartials, atFreq } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './openair-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ model, for the views
const FREQS = Array.from({ length: 300 }, (_, i) => 20 * 1000 ** (i / 299));
const db = (v) => 20 * Math.log10(Math.max(v, 1e-9));

function call(fn, P, extra, ...args) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  if (extra) s.f64(extra.length, 8 * v.length).set(extra);
  model[fn](s.at, ...args);
  return { s, n: v.length };
}
function parts(P) {
  const { s } = call('openair_parts', P);
  const [r1, r2, cos, c, sigma, lag] = s.f64(6);
  return { r1, r2, cos, c, sigma, lag };
}
// what at FREQS: 0 the response H, 1 the reflection Q, 2 the impedance Z, as [re, im] pairs
function spectrum(P, what) {
  const { s, n } = call('openair_spectrum', P, FREQS, FREQS.length, what);
  const r = s.f64(2 * FREQS.length, 8 * (n + FREQS.length));
  return FREQS.map((_, i) => [r[2 * i], r[2 * i + 1]]);
}
function absorption(P) {
  const { s, n } = call('openair_absorption', P, FREQS, FREQS.length);
  return Array.from(s.f64(FREQS.length, 8 * (n + FREQS.length)));
}
const mag = ([a, b]) => Math.hypot(a, b);
const line = (g, xs, ys) => { g.beginPath(); xs.forEach((x, i) => (i ? g.lineTo(x, ys[i]) : g.moveTo(x, ys[i]))); g.stroke(); };
const hz = (f) => (f >= 1000 ? `${(f / 1000).toFixed(1)} kHz` : `${f.toFixed(0)} Hz`);

// The response: what reaches you, against the air alone and against a hard ground.
const responseView = {
  title: 'The response',
  caption: 'how loud each frequency reaches you (solid), against the bass a metre away: the direct sound and the ground\'s reflection added, each through the air. The dashed line is the air alone, the direct sound\'s absorption, which takes the treble, more the farther and the drier. The dotted line is what a hard ground, a perfect mirror, would give: the paths in phase at the bottom, 6 dB up, and cancelling wherever the reflected one is longer by half a wavelength. A soft ground shifts the reflection\'s phase and pulls the first of those nulls down into the bass\'s range: the ground effect\'s dip. The green dots are the harmonics of the note you play, riding on the curve.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let H, air, hard, dip;
    const update = () => {
      const P = api.P, pp = parts(P), a = absorption(P);
      H = spectrum(P, 0).map(mag);
      air = a.map((al) => 10 ** ((-al * pp.r1) / 20));
      hard = FREQS.map((f, i) => {
        const g1 = air[i], g2 = (pp.r1 / pp.r2) * 10 ** ((-a[i] * pp.r2) / 20), ph = (2 * Math.PI * f * (pp.r2 - pp.r1)) / pp.c;
        return Math.hypot(g1 + g2 * Math.cos(ph), g2 * Math.sin(ph));
      });
      dip = null;
      for (let i = 1; i < FREQS.length - 1; i++) if (FREQS[i] > 50 && FREQS[i] < 3000 && H[i] < H[i - 1] && H[i] <= H[i + 1] && (!dip || H[i] < dip.v)) dip = { f: FREQS[i], v: H[i] };
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>as heard</span><span>dashed: the air alone, ${db(air[FREQS.findIndex((f) => f >= 4000)]).toFixed(0)} dB at 4 kHz</span><span>dotted: a hard ground</span>${dip ? `<span>dip ${hz(dip.f)}, ${db(dip.v).toFixed(0)} dB</span>` : ''}`;
    };
    const draw = () => {
      if (!H) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const { x, y, box } = freqAxes(g, w, h, { dbMin: -48, dbMax: 12, step: 12 });
      const ys = (v) => v.map((m) => Math.max(box.t, Math.min(box.b, y(db(m)))));
      const xs = FREQS.map(x);
      g.save(); g.beginPath(); g.rect(box.l, box.t, box.r - box.l, box.b - box.t); g.clip();
      g.strokeStyle = css('--ink-2'); g.lineWidth = 1.2;
      g.setLineDash([5, 4]); line(g, xs, ys(air));
      g.setLineDash([2, 3]); line(g, xs, ys(hard));
      g.setLineDash([]);
      g.strokeStyle = css('--accent'); g.lineWidth = 2.5; line(g, xs, ys(H)); g.lineWidth = 1;
      g.restore();
      markNote(g, x, box, api.note);
      markPartials(g, x, y, box, api, (f) => db(atFreq(FREQS, H, f)));
    };
    api.on('params', () => { update(); draw(); });
    animate(canvas, draw);
    update();
  },
};

// The ground: the spherical wave's reflection Q against the plane wave's Rp.
const groundView = {
  title: 'The ground',
  caption: 'how strongly the ground reflects each frequency, |Q| (solid), against what it would reflect of a plane wave arriving at the same angle, |Rp| (dashed), from the ground\'s impedance by Miki\'s law. Near grazing a plane wave is reflected almost whole but turned over, cancelling the direct sound; a real source\'s wave is spherical, and along a soft ground it also travels as a ground wave, which Weyl and van der Pol\'s formula adds: at low frequencies it lifts |Q| above 1. Higher up, |Q| falls toward |Rp|. Over asphalt both are 1.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let Q, Rp;
    const update = () => {
      const P = api.P, pp = parts(P);
      Q = spectrum(P, 1).map(mag);
      Rp = pp.sigma ? spectrum(P, 2).map(([a, b]) => { const re = a * pp.cos, im = b * pp.cos; return Math.hypot(re - 1, im) / Math.hypot(re + 1, im); }) : FREQS.map(() => 1);
      const grazing = (Math.asin(pp.cos) * 180) / Math.PI;
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>|Q|, the spherical wave</span><span>dashed: |Rp|, a plane wave</span><span>${pp.sigma ? `σ ${pp.sigma.toFixed(0)} kPa·s/m²` : 'rigid'}</span><span>${grazing.toFixed(1)}° above the ground</span>`;
    };
    const draw = () => {
      if (!Q) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      g.font = '11px system-ui, sans-serif';
      const box = { l: 40, r: w - 10, t: 10, b: h - 22 }, f0 = 20, f1 = 20000, top = 2;
      const x = (f) => box.l + ((box.r - box.l) * Math.log(f / f0)) / Math.log(f1 / f0), y = (v) => box.b - ((box.b - box.t) * Math.min(v, top)) / top;
      g.strokeStyle = css('--grid'); g.fillStyle = css('--ink-2'); g.lineWidth = 1; g.textAlign = 'center';
      for (const f of [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]) { g.beginPath(); g.moveTo(x(f), box.t); g.lineTo(x(f), box.b); g.stroke(); if (w > 320 || [100, 1000, 10000].includes(f)) g.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x(f), h - 6); }
      g.textAlign = 'right';
      for (const v of [0, 0.5, 1, 1.5, 2]) { g.beginPath(); g.moveTo(box.l, y(v)); g.lineTo(box.r, y(v)); g.stroke(); g.fillText(`${v}`, box.l - 6, y(v) + 4); }
      const xs = FREQS.map(x);
      g.strokeStyle = css('--ink-2'); g.lineWidth = 1.2; g.setLineDash([5, 4]); line(g, xs, Rp.map(y)); g.setLineDash([]);
      g.strokeStyle = css('--accent'); g.lineWidth = 2.5; line(g, xs, Q.map(y)); g.lineWidth = 1;
      markNote(g, x, box, api.note);
    };
    api.on('params', () => { update(); draw(); });
    animate(canvas, draw);
    update();
  },
};

const SCOPE = 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. Close by over grass the wave keeps its shape; across a kilometre the treble is gone and a note comes out as little more than its fundamental.';
const SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts (0 dBV is a sine of 1 V peak). The field is linear: it makes no new frequencies, only takes some away, the harmonics in the ground\'s dip and the treble the air absorbs. The green line is the note you are playing, and the ticks along the top its harmonics.';

createPedal({ PEDAL, worklet: new URL('./openair-worklet.js', import.meta.url), views: [responseView, groundView, scopeView({ caption: SCOPE }), spectrumView({ caption: SPECTRUM })] });
