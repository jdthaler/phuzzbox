// radio-main.js — the Crystal Radio's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, animate } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './radio-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ model, for the views
const N = 240;      // points over two periods of the note, for the detector's trace
const TONE = 0.3;   // the note's peak at the input for the views (V): a firmly played passive bass

// the C++ model through its exports: P, then `extra`, then what the function writes after them
function call(P, fn, extra, args) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  if (extra.length) s.f64(extra.length, 8 * v.length).set(extra);
  model[fn](s.at, ...args);
  return (k, off) => Array.from(s.f64(k, 8 * (v.length + off)));
}
function parts(P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  model.radio_parts(s.at);
  const [is, nvt, A0, V0, slope, gain, gamma, delta, B, spacing, Ac] = s.f64(11);
  return { is, nvt, A0, V0, slope, gain, gamma, delta, B, spacing, Ac };
}
const settle = (P, A) => call(P, 'radio_settle', A, [A.length])(A.length, A.length);
const tank = (P, f) => { const r = call(P, 'radio_tank', f, [f.length])(2 * f.length, f.length); return f.map((_, i) => Math.hypot(r[2 * i], r[2 * i + 1])); };
function tone(P, f) {
  const r = call(P, 'radio_tone', [f, TONE], [N]);
  return { env: r(N, 2), A: r(N, 2 + N), V: r(N, 2 + 2 * N) };
}
const volts = (v) => { const a = Math.abs(v); return (a >= 1 ? `${v.toFixed(2)} V` : a >= 1e-3 ? `${(1e3 * v).toFixed(a >= 0.1 ? 0 : 1)} mV` : a >= 1e-6 ? `${(1e6 * v).toFixed(a >= 1e-4 ? 0 : 1)} µV` : `${(1e9 * v).toFixed(1)} nV`).replace('-', '−'); };
const db = (a) => `${(20 * Math.log10(a)).toFixed(1)} dB`.replace('-', '−');
const khz = (f) => `${(f / 1000).toFixed(Math.abs(f) < 1e4 ? 1 : 0)} kHz`.replace('-', '−');

// The detector: its steady voltage against the carrier's amplitude, on logarithmic scales, where
// the square law is a line of slope 2 and a peak detector one of slope 1; and over two periods of
// the note, the earphone's voltage against what it would be if it kept up with the carrier.
const detectorView = {
  title: 'The detector',
  caption: 'on the left, the earphone\'s steady voltage V against the carrier\'s amplitude A at the diode, both on logarithmic scales (solid), with the square law, V ∝ A² (dashed, slope 2), and the peak detector\'s V = A (dotted, slope 1). The ring is where the station rests, the dots where the carrier is as you play: a weak station sits on the square law, so the bass comes out squared and gains its second harmonic; a strong one on V ≈ A, so it comes out straight. On the right, two periods of the note you play (the A at 110 Hz until you play), 0.3 V into the transmitter: the voltage the earphone would have if it kept up with the carrier (dashed) and what it has (solid). When the capacitor can\'t discharge through the load as fast as the carrier falls, the solid line leaves the dashed one in a straight slope: diagonal clipping.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const trail = [], KEEP = 300;
    let P, pp, curve, AX, tr, follow;
    const update = () => {
      P = api.P; pp = parts(P);
      AX = Array.from({ length: 121 }, (_, i) => 1e-3 * 10 ** (i / 30)); // 1 mV to 10 V
      curve = settle(P, AX);
      const f = api.note?.f ?? 110;
      tr = tone(P, f);
      follow = settle(P, tr.A);
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>${P.diode === 'si' ? 'silicon' : P.diode === 'schottky' ? 'Schottky' : 'germanium'}, nVT = ${(1e3 * pp.nvt).toFixed(1)} mV</span><span>A = ${volts(pp.A0)} gives V = ${volts(pp.V0)}</span><span>made up ${(20 * Math.log10(pp.gain)).toFixed(1)} dB after</span>`;
    };
    const draw = () => {
      if (!curve) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const wide = w > 560;
      const L = wide ? { l: 52, t: 8, r: w * 0.5 - 8, b: h - 24 } : { l: 52, t: 8, r: w - 10, b: Math.round(h * 0.55) - 22 };
      const T = wide ? { l: w * 0.5 + 34, t: 8, r: w - 10, b: h - 24 } : { l: 52, t: Math.round(h * 0.55) + 6, r: w - 10, b: h - 20 };
      g.font = '11px system-ui, sans-serif';
      // left: log V against log A
      const vmin = Math.max(1e-10, Math.min(...curve.filter((v) => v > 0)) * 0.5), vmax = 20;
      const lx = (a) => L.l + ((L.r - L.l) * Math.log10(a / 1e-3)) / 4, ly = (v) => L.b - ((L.b - L.t) * Math.log10(Math.max(v, vmin) / vmin)) / Math.log10(vmax / vmin);
      g.strokeStyle = css('--grid'); g.lineWidth = 1; g.strokeRect(L.l, L.t, L.r - L.l, L.b - L.t);
      g.fillStyle = css('--ink-2'); g.textAlign = 'center';
      for (const [a, t] of [[1e-3, '1 mV'], [1e-2, '10 mV'], [0.1, '0.1 V'], [1, '1 V'], [10, '10 V']]) { g.fillText(t, Math.min(L.r - 14, Math.max(L.l + 14, lx(a))), L.b + 14); g.beginPath(); g.moveTo(lx(a), L.t); g.lineTo(lx(a), L.b); g.stroke(); }
      g.textAlign = 'right';
      for (let e = Math.ceil(Math.log10(vmin)); e <= 1; e += 2) { const v = 10 ** e; g.fillText(volts(v).replace('.0 ', ' '), L.l - 4, ly(v) + 4); g.beginPath(); g.moveTo(L.l, ly(v)); g.lineTo(L.r, ly(v)); g.stroke(); }
      g.save(); g.beginPath(); g.rect(L.l, L.t, L.r - L.l, L.b - L.t); g.clip();
      const k2 = curve[0] / AX[0] ** 2; // the square law through the curve's weak end
      g.strokeStyle = css('--ink-2'); g.setLineDash([5, 4]); g.beginPath(); g.moveTo(lx(1e-3), ly(k2 * 1e-6)); g.lineTo(lx(10), ly(k2 * 100)); g.stroke();
      g.setLineDash([1.5, 3]); g.beginPath(); g.moveTo(lx(1e-3), ly(1e-3)); g.lineTo(lx(10), ly(10)); g.stroke(); g.setLineDash([]);
      g.strokeStyle = css('--accent'); g.lineWidth = 2; g.beginPath();
      AX.forEach((a, i) => (i ? g.lineTo(lx(a), ly(curve[i])) : g.moveTo(lx(a), ly(curve[i])))); g.stroke(); g.lineWidth = 1;
      trail.forEach(([a, v], j) => { if (!(a > 0 && v > 0)) return; g.fillStyle = css('--good'); g.globalAlpha = 0.15 + (0.85 * j) / trail.length; g.fillRect(lx(a) - 1.5, ly(v) - 1.5, 3, 3); });
      g.globalAlpha = 1;
      g.strokeStyle = css('--ink'); g.beginPath(); g.arc(lx(pp.A0), ly(pp.V0), 5, 0, 2 * Math.PI); g.stroke();
      g.restore();
      g.fillStyle = css('--ink-2'); g.textAlign = 'left'; g.fillText('V ↑', L.l + 4, L.t + 12); g.textAlign = 'right'; g.fillText('A →', L.r - 4, L.b - 6);
      // right: two periods of the note
      const all = [...tr.V, ...follow], lo = Math.min(...all), hi = Math.max(...all), pad = 0.08 * (hi - lo || hi || 1);
      const tx = (i) => T.l + ((T.r - T.l) * i) / (N - 1), ty = (v) => T.b - ((T.b - T.t) * (v - lo + pad)) / (hi - lo + 2 * pad);
      g.strokeStyle = css('--grid'); g.strokeRect(T.l, T.t, T.r - T.l, T.b - T.t);
      g.strokeStyle = css('--ink-2'); g.setLineDash([5, 4]); g.beginPath(); follow.forEach((v, i) => (i ? g.lineTo(tx(i), ty(v)) : g.moveTo(tx(i), ty(v)))); g.stroke(); g.setLineDash([]);
      g.strokeStyle = css('--accent'); g.lineWidth = 2; g.beginPath(); tr.V.forEach((v, i) => (i ? g.lineTo(tx(i), ty(v)) : g.moveTo(tx(i), ty(v)))); g.stroke(); g.lineWidth = 1;
      g.fillStyle = css('--ink-2'); g.textAlign = 'right';
      g.fillText(volts(hi), T.l - 4, ty(hi) + 4); g.fillText(volts(lo), T.l - 4, ty(lo) + 4);
      g.textAlign = 'center'; g.fillText(`two periods of ${(api.note?.f ?? 110).toFixed(1)} Hz`, (T.l + T.r) / 2, T.b + 14);
    };
    api.on('params', () => { update(); draw(); });
    api.on('pedal', (messages) => {
      for (const m of messages) {
        if (m.type !== 1) continue;
        for (let j = 0; j < 14; j++) trail.push([m.values[2 * j], m.values[2 * j + 1]]);
      }
      if (trail.length > KEEP) trail.splice(0, trail.length - KEEP);
    });
    let lastF = 0;
    animate(canvas, () => { const f = api.note?.f ?? 0; if (Math.abs(f - lastF) > 0.5) { lastF = f; update(); } draw(); });
    update();
  },
};

// The dial: the tuned circuit's response about the station, the station's carrier and the note's
// sidebands on it, and the next station 10 kHz up; above, the dial.
const dialView = {
  title: 'The dial',
  caption: 'above, the dial across the AM band, 540 to 1700 kHz, with the station (the tick) and where the set is tuned (the pointer). Below, the tuned circuit\'s response about the station, in dB (the curve), 3 dB down at f0/2Q either side of its peak (the shaded band); the station\'s carrier (the white line) and the next station\'s, 10 kHz up (grey). Your bass rides on the station\'s carrier as sidebands, each note f from it at ±f, so the band is the bass\'s bandwidth: sidebands further out than f0/2Q are cut, and so is the treble. Tune off the station and its carrier slides down the curve\'s side; let the next station through and the detector hears the two carriers beating, a 10 kHz whistle.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const SPAN = 30e3, M = 241;
    let P, pp, F, H;
    const update = () => {
      P = api.P; pp = parts(P);
      F = Array.from({ length: M }, (_, i) => -SPAN + (2 * SPAN * i) / (M - 1));
      H = tank(P, F);
      const half = pp.gamma / (2 * Math.PI), next = tank(P, [pp.spacing])[0] * 10 ** (P.neighbour / 20);
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>tuned to ${khz(P.station + P.tuning)}</span><span>3 dB down at ±${khz(half)}</span><span>the station ${db(tank(P, [0])[0])}, the next ${db(next)}</span>`;
    };
    const draw = () => {
      if (!H) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      g.font = '11px system-ui, sans-serif';
      // the dial
      const D = { l: 24, r: w - 24, y: 30 };
      const dx = (f) => D.l + ((D.r - D.l) * Math.log(f / 540e3)) / Math.log(1700 / 540);
      g.strokeStyle = css('--ink-2'); g.lineWidth = 1; g.beginPath(); g.moveTo(D.l, D.y); g.lineTo(D.r, D.y); g.stroke();
      g.fillStyle = css('--ink-2'); g.textAlign = 'center';
      for (let f = 540e3; f <= 1700e3; f += 10e3) { const big = f % 100e3 === 0 || f === 540e3; g.beginPath(); g.moveTo(dx(f), D.y); g.lineTo(dx(f), D.y - (big ? 8 : 3)); g.stroke(); }
      for (const f of [540e3, 700e3, 900e3, 1100e3, 1300e3, 1700e3]) if (w > 400 || f === 540e3 || f === 1700e3 || f === 1100e3) g.fillText(`${f / 1e3}`, dx(f), D.y - 12);
      g.strokeStyle = css('--accent'); g.lineWidth = 2; g.beginPath(); g.moveTo(dx(P.station), D.y + 2); g.lineTo(dx(P.station), D.y + 8); g.stroke();
      g.fillStyle = css('--accent'); const px = dx(Math.min(1700e3, Math.max(540e3, P.station + P.tuning)));
      g.beginPath(); g.moveTo(px, D.y - 2); g.lineTo(px - 5, D.y + 10); g.lineTo(px + 5, D.y + 10); g.closePath(); g.fill();
      g.lineWidth = 1;
      // the response
      const B = { l: 46, r: w - 10, t: 58, b: h - 22 }, dbMin = -60, dbMax = 3;
      const x = (f) => B.l + ((B.r - B.l) * (f + SPAN)) / (2 * SPAN), y = (db) => B.t + ((B.b - B.t) * (dbMax - Math.max(dbMin, db))) / (dbMax - dbMin);
      g.strokeStyle = css('--grid'); g.strokeRect(B.l, B.t, B.r - B.l, B.b - B.t);
      g.fillStyle = css('--ink-2'); g.textAlign = 'right';
      for (let db = 0; db >= dbMin; db -= 12) { g.beginPath(); g.moveTo(B.l, y(db)); g.lineTo(B.r, y(db)); g.stroke(); g.fillText(`${db} dB`.replace('-', '−'), B.l - 4, y(db) + 4); }
      g.textAlign = 'center';
      for (let f = -SPAN; f <= SPAN; f += 10e3) {
        g.beginPath(); g.moveTo(x(f), B.t); g.lineTo(x(f), B.b); g.stroke();
        if (f % 20e3 === 0 || w > 420) g.fillText(f ? `${f > 0 ? '+' : '−'}${Math.abs(f) / 1e3}` : `${(P.station / 1e3).toFixed(0)}`, x(f), B.b + 14);
      }
      g.textAlign = 'right'; g.fillText('kHz', B.r - 2, B.t + 12);
      // the band the tuned circuit passes, 3 dB down at its edges
      const half = pp.gamma / (2 * Math.PI), mid = P.tuning;
      g.fillStyle = css('--accent'); g.globalAlpha = 0.12;
      g.fillRect(x(Math.max(-SPAN, mid - half)), B.t, x(Math.min(SPAN, mid + half)) - x(Math.max(-SPAN, mid - half)), B.b - B.t);
      g.globalAlpha = 1;
      g.strokeStyle = css('--accent'); g.lineWidth = 2; g.beginPath();
      F.forEach((f, i) => { const v = y(20 * Math.log10(H[i])); i ? g.lineTo(x(f), v) : g.moveTo(x(f), v); }); g.stroke(); g.lineWidth = 1;
      const stick = (f, a, colour, width = 2.5) => {
        if (Math.abs(f) > SPAN || !(a > 0)) return;
        g.strokeStyle = colour; g.lineWidth = width; g.beginPath(); g.moveTo(x(f), B.b); g.lineTo(x(f), y(20 * Math.log10(a))); g.stroke(); g.lineWidth = 1;
      };
      const at = (f) => tank(P, [f])[0];
      stick(0, at(0), css('--ink'), 3);
      stick(pp.spacing, (pp.B / pp.Ac) * at(pp.spacing), css('--ink-2'), 3);
    };
    api.on('params', () => { update(); draw(); });
    animate(canvas, draw);
    update();
  },
};

const SCOPE = 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. A strong station gives the bass back almost as it went in; a weak one, or a silicon detector, squares it, so the wave comes out with its top half fatter than its bottom; overmodulated, its troughs are flattened where the carrier went to nothing; with diagonal clipping, its falls become straight slopes.';
const SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts (0 dBV is a sine of 1 V peak). The square law adds each note\'s second harmonic, and the sums and differences of the notes you play together; a sharp tuned circuit cuts the treble above f0/2Q; the next station adds a line at 10 kHz, the whistle. The green line is the note you are playing, and the ticks along the top its harmonics.';

createPedal({ PEDAL, worklet: new URL('./radio-worklet.js', import.meta.url), views: [detectorView, dialView, scopeView({ caption: SCOPE }), spectrumView({ caption: SPECTRUM })] });
