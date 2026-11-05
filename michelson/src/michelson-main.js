// michelson-main.js — the Michelson Interferometer's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, animate, markNote } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './michelson-pedal.js';
import { SOURCES } from './michelson-params.js';

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
  const { s } = call(P, (at) => model.michelson_parts(at));
  const r = Array.from(s.f64(16));
  const lines = Array.from({ length: r[2] }, (_, j) => ({ lambda: r[3 + 3 * j], weight: r[4 + 3 * j], width: r[5 + 3 * j] }));
  return { rest: r[0], lambda0: r[1], lines, f0: r[9], Q: r[10], stroke: r[11], air: r[12], airTime: r[13], fullScale: r[14], gain: r[15] };
}
function intensity(P, opds) {
  const r = call(P, (at) => model.michelson_intensity(at, opds.length), opds);
  return r.at(opds.length, r.n + opds.length);
}
function contrastAt(P, opds) {
  const r = call(P, (at) => model.michelson_contrast(at, opds.length), opds);
  return r.at(opds.length, r.n + opds.length);
}
function rings(P, x, angles) {
  const r = call(P, (at) => model.michelson_rings(at, angles.length), [x, ...angles]);
  return r.at(angles.length, r.n + 1 + angles.length);
}
function mountResponse(P, freqs) {
  const r = call(P, (at) => model.michelson_actuator(at, freqs.length), freqs);
  return r.at(freqs.length, r.n + freqs.length);
}

// a wavelength's colour, roughly as the eye sees it (Bruton's piecewise fit), sRGB 0–255
function wavelengthColour(lambda) {
  const l = lambda * 1e9;
  let r = 0, g = 0, b = 0;
  if (l < 440) { r = -(l - 440) / 60; b = 1; } else if (l < 490) { g = (l - 440) / 50; b = 1; } else if (l < 510) { g = 1; b = -(l - 510) / 20; }
  else if (l < 580) { r = (l - 510) / 70; g = 1; } else if (l < 645) { r = 1; g = -(l - 645) / 65; } else r = 1;
  const fade = l < 420 ? 0.3 + (0.7 * (l - 380)) / 40 : l > 700 ? 0.3 + (0.7 * (780 - l)) / 80 : 1;
  return [r, g, b].map((c) => Math.round(255 * (c * fade) ** 0.8));
}
// the light's colour: a lamp's or a laser's own, the white LED's white
const colourOf = (P, pp) => (P.light === 'white' ? [255, 248, 236] : wavelengthColour(pp.lambda0));
const rgb = ([r, g, b], a = 1) => `rgba(${r},${g},${b},${a})`;
const nm = (m) => `${(m * 1e9).toFixed(0)} nm`;
const um = (m) => (Math.abs(m) < 1e-6 ? nm(m) : `${(m * 1e6).toFixed(1)} µm`);

// the mirror as it plays, from the engine's messages: its travel and the air's drift, and the light
function tracker(api) {
  const trail = [], KEEP = 270, now = { x: 0, w: 0, I: 0.5, contrast: 1 };
  api.on('pedal', (messages) => {
    for (const m of messages) {
      if (m.type !== 1) continue;
      for (let j = 0; j < 9; j++) trail.push([m.values[3 * j] * 1e-9, m.values[3 * j + 1] * 1e-9, m.values[3 * j + 2]]);
      [now.x, now.w, now.I] = trail.at(-1);
      now.contrast = m.values[27];
    }
    if (trail.length > KEEP) trail.splice(0, trail.length - KEEP);
  });
  return { trail, now };
}

// The fringes: what a screen in the detector's place shows, the light spread a little so the paths
// differ by OPD cos θ off the axis: rings, which swell out of the middle or shrink into it as the
// mirror moves. The detector is the small circle in the middle.
const ringsView = {
  title: 'The fringes',
  caption: 'what a screen would show in the detector\'s place, with the beam spread a little: off the axis the light crosses the arms at an angle, so the paths differ a little less there, and the fringes are rings. As the mirror moves out, rings swell out of the middle; as it moves in, they shrink into it, one for every half wavelength. The detector is the small circle at the centre: it sees whatever ring is passing. With the arms equal there are no rings, the whole field brightening and darkening together; with the sodium lamp out of step or the white LED away from zero path, the rings fade.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const { now } = tracker(api);
    const RAD = 150;
    let P, pp, colour, angles;
    const update = () => {
      P = api.P; pp = parts(P); colour = colourOf(P, pp);
      // enough of the field for about six rings at rest, and no more than 0.6 rad
      const opd = Math.max(Math.abs(pp.rest), 1e-9), tmax = Math.min(0.6, Math.sqrt((2 * 6 * pp.lambda0) / opd));
      angles = Array.from({ length: RAD }, (_, i) => (tmax * (i + 0.5)) / RAD);
      const c = contrastAt(P, [pp.rest])[0];
      legend.innerHTML = `<span><i style="background:${rgb(colour)}"></i>${SOURCES.find(([id]) => id === P.light)[1]}</span>`
        + `<span>paths differ by ${um(pp.rest)} at rest</span><span>contrast ${c.toFixed(2)}</span>`;
    };
    const draw = () => {
      if (!angles) return;
      const { g, w, h } = fit(canvas);
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, R = Math.hypot(w, h) / 2;
      const I = rings(P, now.x + now.w, angles);
      const step = R / RAD;
      for (let i = RAD - 1; i >= 0; i--) {
        g.fillStyle = rgb(colour, I[i]);
        g.beginPath(); g.arc(cx, cy, (i + 1) * step, 0, 2 * Math.PI); g.fill();
      }
      g.strokeStyle = css('--accent'); g.lineWidth = 1.5;
      g.beginPath(); g.arc(cx, cy, 6, 0, 2 * Math.PI); g.stroke();
      g.fillStyle = css('--ink-2'); g.font = '11px system-ui, sans-serif'; g.textAlign = 'left';
      g.fillText('detector', cx + 10, cy - 8);
    };
    api.on('params', update);
    animate(canvas, draw);
    update();
  },
};

// The fringe: the detector's light against the mirror's travel, around where it rests, and where
// the light is as you play: the bass moves the mirror along the bottom, the detector reads the
// curve, and every crest or trough it crosses folds the wave back.
const transferView = {
  title: 'The fringe',
  caption: 'the light on the detector (up) against how far the mirror has moved from rest (across): a fringe for every half wavelength of travel, its depth the contrast (dashed). The dots are the light as you play: the bass swings the mirror back and forth along the bottom, and the detector\'s output follows the curve up and down, so each crest or trough the swing crosses folds the wave back on itself. Resting on a steep side (Fringe 90°), a small swing comes out as it went in; resting on a crest (0°), the light falls whichever way the mirror goes, and the note comes out an octave up.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const { trail } = tracker(api);
    const N = 400;
    let P, pp, span, xs, curve, env, colour;
    const update = () => {
      P = api.P; pp = parts(P); colour = colourOf(P, pp);
      span = Math.max(1.2 * pp.stroke, 0.6 * pp.lambda0); // a volt's stroke, or a fringe, either way
      xs = Array.from({ length: N }, (_, i) => -span + (2 * span * i) / (N - 1));
      const opds = xs.map((x) => pp.rest + 2 * x);
      curve = intensity(P, opds);
      env = contrastAt(P, opds);
      legend.innerHTML = `<span><i style="background:${rgb(colour)}"></i>a fringe every ${nm(pp.lambda0 / 2)} of travel</span>`
        + `<span>stroke ${(pp.stroke * 1e9).toFixed(0)} nm/V</span><span>resting at ${(+P.fringe).toFixed(0)}°</span>`;
    };
    const draw = () => {
      if (!curve) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const box = { l: 34, r: w - 10, t: 12, b: h - 24 };
      const X = (x) => box.l + ((box.r - box.l) * (x + span)) / (2 * span), Y = (I) => box.b - (box.b - box.t) * I;
      g.strokeStyle = css('--grid'); g.lineWidth = 1; g.strokeRect(box.l, box.t, box.r - box.l, box.b - box.t);
      g.beginPath(); g.moveTo(X(0), box.t); g.lineTo(X(0), box.b); g.stroke();
      g.fillStyle = css('--ink-2'); g.font = '11px system-ui, sans-serif';
      g.textAlign = 'right'; g.fillText('1', box.l - 4, box.t + 8); g.fillText('0', box.l - 4, box.b);
      g.textAlign = 'center';
      g.fillText(`−${nm(span)}`, box.l + 24, box.b + 14); g.fillText('0', X(0), box.b + 14); g.fillText(`+${nm(span)}`, box.r - 24, box.b + 14);
      g.textAlign = 'left'; g.fillText('light on the detector', box.l + 6, box.t + 14);
      // the contrast's envelope
      g.strokeStyle = css('--ink-2'); g.setLineDash([4, 4]);
      for (const s of [1, -1]) { g.beginPath(); xs.forEach((x, i) => { const y = Y(0.5 + (s * env[i]) / 2); i ? g.lineTo(X(x), y) : g.moveTo(X(x), y); }); g.stroke(); }
      g.setLineDash([]);
      g.strokeStyle = rgb(colour); g.lineWidth = 2.5; g.beginPath();
      xs.forEach((x, i) => (i ? g.lineTo(X(x), Y(curve[i])) : g.moveTo(X(x), Y(curve[i]))));
      g.stroke(); g.lineWidth = 1;
      g.fillStyle = css('--accent');
      trail.forEach(([x, wd, I], j) => { const xx = x + wd; if (Math.abs(xx) > span) return; g.globalAlpha = 0.12 + (0.88 * j) / trail.length; g.fillRect(X(xx) - 1.5, Y(I) - 1.5, 3, 3); });
      g.globalAlpha = 1;
    };
    api.on('params', update);
    animate(canvas, draw);
    update();
  },
};

// The mount: how far the mirror travels per volt against frequency, its resonance and, for the
// loudspeaker, its fall above it.
const F = Float64Array.from({ length: 200 }, (_, i) => 10 * 2000 ** (i / 199));
const mountView = {
  title: 'The mount',
  caption: 'how far the mirror moves for a volt at each frequency. A piezo stack is stiff, its resonance far above the bass, so the stroke is the same for every note. A loudspeaker\'s cone rides a soft suspension: it follows below its resonance, at 80 Hz, and above it its mass holds it back, a quarter of the stroke for each octave, so high notes swing the mirror through fewer fringes. The green line is the note you are playing.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let H, pp;
    const update = () => {
      pp = parts(api.P);
      H = mountResponse(api.P, Array.from(F));
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>resonance ${pp.f0 >= 1000 ? `${(pp.f0 / 1000).toFixed(0)} kHz` : `${pp.f0.toFixed(0)} Hz`}, Q ${pp.Q}</span><span>${(pp.stroke * 1e9).toFixed(0)} nm/V below it</span>`;
    };
    const draw = () => {
      if (!H) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const box = { l: 46, r: w - 10, t: 12, b: h - 24 };
      const top = Math.max(...H) * 1.5, bot = top / 1000;
      const X = (f) => box.l + ((box.r - box.l) * Math.log(f / 10)) / Math.log(2000), Y = (v) => box.b - ((box.b - box.t) * Math.log(Math.max(v, bot) / bot)) / Math.log(top / bot);
      g.strokeStyle = css('--grid'); g.lineWidth = 1; g.strokeRect(box.l, box.t, box.r - box.l, box.b - box.t);
      g.fillStyle = css('--ink-2'); g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
      for (const f of [100, 1000, 10000]) { g.beginPath(); g.moveTo(X(f), box.t); g.lineTo(X(f), box.b); g.stroke(); g.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, X(f), box.b + 14); }
      g.textAlign = 'right';
      for (const v of [top / 1.5, top / 15, top / 150]) g.fillText(nm(v).replace(' nm', ''), box.l - 4, Y(v) + 4);
      g.save(); g.translate(10, (box.t + box.b) / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText('nm/V', 0, 0); g.restore();
      g.strokeStyle = css('--accent'); g.lineWidth = 2.5; g.beginPath();
      H.forEach((v, i) => (i ? g.lineTo(X(F[i]), Y(v)) : g.moveTo(X(F[i]), Y(v))));
      g.stroke();
      markNote(g, X, box, api.note);
    };
    api.on('params', () => { update(); draw(); });
    animate(canvas, draw);
    update();
  },
};

const SCOPE = 'the bass going in (dashed) and the detector\'s output (solid), each scaled to fit. At a gentle stroke on a fringe\'s side, the note comes out as it went in; turned up, each peak folds over where the swing crosses a crest or trough, more folds the harder you play. Resting on a crest, the output rises twice for each cycle of the note: an octave up.';
const SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts. A sine moving the mirror makes harmonics whose sizes are Bessel functions of how far it swings (the light is phase-modulated, as an FM synthesiser\'s carrier is): resting mid-fringe, odd harmonics only; on a crest, even ones only. The green line is the note you are playing, and the ticks along the top its harmonics.';

createPedal({ PEDAL, worklet: new URL('./michelson-worklet.js', import.meta.url), views: [ringsView, transferView, mountView, scopeView({ caption: SCOPE }), spectrumView({ caption: SPECTRUM })] });
