// bandgap-main.js — the Bandgap's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, freqAxes, animate, markNote, markPartials, atFreq } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './bandgap-pedal.js';
import { DIODES } from './bandgap-params.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ model, for the views
const N = 240, FREQS = Float64Array.from({ length: N }, (_, i) => 10 * 2000 ** (i / (N - 1)));
const FAMILIES = 6;
// each family's colour on The diodes: the LEDs their own light's
const COLOURS = ['#a8a29e', '#cbd5e1', '#e7e5e4', '#ef4444', '#22c55e', '#3b82f6'];

const call = (P, fn, extra = [], n = 0) => {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  if (extra.length) s.f64(extra.length, 8 * v.length).set(extra);
  fn(s.at);
  return { s, at: (k, off) => Array.from(s.f64(k, 8 * off)) , n: v.length };
};
function parts(P) {
  const { s } = call(P, (at) => model.bandgap_parts(at));
  const [rail, SR, GBW, Vs, Rf, Rg, Cg, Rt, Cd, gain, Rft, Ct] = s.f64(12);
  return { rail, SR, GBW, Vs, Rf, Rg, Cg, Rt, Cd, gain, Rft, Ct };
}
function iv(P, k, volts) {
  const r = call(P, (at) => model.bandgap_iv(at, k, volts.length), volts);
  return r.at(volts.length, r.n + volts.length);
}
function families(P, current) {
  const { s } = call(P, (at) => model.bandgap_families(at), [current]);
  const r = Array.from(s.f64(FAMILIES * 5));
  return Array.from({ length: FAMILIES }, (_, k) => ({ up: r[5 * k], down: r[5 * k + 1], v1: r[5 * k + 2], eg: r[5 * k + 3], lambda: r[5 * k + 4] }));
}
function response(P) {
  const r = call(P, (at) => model.bandgap_response(at, N), FREQS);
  return r.at(N, r.n + N);
}
const familyOf = (P) => DIODES.findIndex(([id]) => id === P.diodes);
const mV = (v) => (Math.abs(v) < 1 ? `${(1000 * v).toFixed(0)} mV` : `${v.toFixed(2)} V`).replace('-', '−');
const mA = (i) => (Math.abs(i) < 1e-3 ? `${(1e6 * i).toFixed(0)} µA` : `${(1e3 * i).toFixed(2)} mA`).replace('-', '−');

// The diodes: every family's current against voltage, the chosen pair bright, the line the op-amp
// drives them along through Rt, and the operating point as you play; the LEDs lit by their current.
const diodesView = {
  title: 'The diodes',
  caption: 'the current through the pair of diodes against the voltage across them, for each kind (faint) and the ones fitted (bright), both ways. Each bends sharply upward at its knee, near its bandgap: germanium and Schottky at a few tenths of a volt, silicon at 0.6, and the LEDs at the energy of their light, E = hc/λ, less a little. The dashed line is what the op-amp can push through the Filter\'s resistance from its rail, and the dots where the circuit is as you play: a dot that reaches the knee is clipping. With LEDs, the two at the top light up as much as they pass current, which is the clipping you hear.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const trail = [], KEEP = 280;
    let P, pp, curves, fam, vmax, imax, glow = 0;
    const update = () => {
      P = api.P; pp = parts(P); fam = families(P, 1e-3);
      const per = { one: 1, two: 2, asym: 2 }[P.perSide];
      vmax = Math.min(Math.max(pp.rail, 0.8) * 1.05, Math.max(...fam.map((f) => f.v1)) * per * 1.25 + 0.3);
      vmax = Math.max(vmax, 0.8);
      imax = Math.max(1.15 * (pp.rail / pp.Rt), 20e-6);
      const vs = Array.from({ length: 241 }, (_, i) => -vmax + (2 * vmax * i) / 240);
      curves = { vs, i: Array.from({ length: FAMILIES }, (_, k) => iv(P, k, vs)) };
      const k = familyOf(P), f = fam[k];
      const light = f?.lambda ? `<span style="color:${COLOURS[k]}">● ${(1e9 * f.lambda).toFixed(0)} nm: hc/λ = ${f.eg.toFixed(2)} eV</span>` : '';
      legend.innerHTML = (f ? `<span><i style="background:${COLOURS[k]}"></i>${DIODES[k][1]}: ${mV(f.up)} at 1 mA, ${f.lambda ? 'bandgap' : k === 1 ? 'barrier' : 'bandgap'} ${f.eg.toFixed(2)} eV</span>${light}` : '<span>no diodes: the op-amp clips at its rails</span>')
        + `<span>rails ±${pp.rail.toFixed(1)} V, through ${(pp.Rt / 1000).toFixed(0)} kΩ</span>`;
    };
    const draw = () => {
      if (!curves) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const box = { l: 46, r: w - 10, t: 34, b: h - 22 };
      const X = (v) => box.l + ((box.r - box.l) * (v + vmax)) / (2 * vmax);
      const Y = (i) => (box.t + box.b) / 2 - ((box.b - box.t) / 2) * Math.max(-1.05, Math.min(1.05, i / imax));
      g.font = '11px system-ui, sans-serif'; g.lineWidth = 1;
      // the grid and axes
      g.strokeStyle = css('--grid'); g.fillStyle = css('--ink-2');
      g.strokeRect(box.l, box.t, box.r - box.l, box.b - box.t);
      g.beginPath(); g.moveTo(X(0), box.t); g.lineTo(X(0), box.b); g.moveTo(box.l, Y(0)); g.lineTo(box.r, Y(0)); g.stroke();
      g.textAlign = 'center';
      const vstep = vmax > 2.5 ? 1 : vmax > 1.2 ? 0.5 : 0.2;
      for (let v = -Math.floor(vmax / vstep) * vstep; v <= vmax + 1e-9; v += vstep) g.fillText(`${(+v.toFixed(1)).toString().replace('-', '−')}`, X(v), box.b + 13);
      g.textAlign = 'right';
      g.fillText(mA(imax).replace(/ (mA|µA)/, ''), box.l - 4, box.t + 8); g.fillText('0', box.l - 4, Y(0) + 4); g.fillText(`−${mA(imax).replace(/ (mA|µA)/, '')}`, box.l - 4, box.b);
      g.save(); g.translate(10, (box.t + box.b) / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText(imax < 1e-3 ? 'I (µA)' : 'I (mA)', 0, 0); g.restore();
      g.textAlign = 'left'; g.fillText('V across the diodes', box.l + 4, box.b - 4);
      // every family, the fitted one last and bright
      const k = familyOf(P);
      for (let j = 0; j < FAMILIES; j++) {
        if (j === k) continue;
        g.strokeStyle = COLOURS[j]; g.globalAlpha = 0.28; g.beginPath();
        curves.i[j].forEach((i, n) => (n ? g.lineTo(X(curves.vs[n]), Y(i)) : g.moveTo(X(curves.vs[n]), Y(i))));
        g.stroke();
      }
      g.globalAlpha = 1;
      if (k < FAMILIES) {
        g.strokeStyle = COLOURS[k]; g.lineWidth = 2.5; g.beginPath();
        curves.i[k].forEach((i, n) => (n ? g.lineTo(X(curves.vs[n]), Y(i)) : g.moveTo(X(curves.vs[n]), Y(i))));
        g.stroke(); g.lineWidth = 1;
      }
      // the line the op-amp drives them along from each rail: I = (±rail − V)/Rt
      g.strokeStyle = css('--accent-2'); g.setLineDash([5, 4]);
      for (const s of [1, -1]) { g.beginPath(); g.moveTo(X(s * pp.rail - s * imax * pp.Rt), Y(s * imax)); g.lineTo(X(s * pp.rail), Y(0)); g.stroke(); }
      g.setLineDash([]);
      // where the circuit is as you play
      g.fillStyle = css('--accent');
      trail.forEach(([v, i], j) => { g.globalAlpha = 0.12 + (0.88 * j) / trail.length; g.fillRect(X(v) - 1.5, Y(i) - 1.5, 3, 3); });
      g.globalAlpha = 1;
      // the LEDs, lit by their current: photons at η I / q, drawn as a glow
      const f = fam[k];
      if (f?.lambda) {
        const last = trail.slice(-6), iu = Math.max(0, ...last.map(([, i]) => i)), id = Math.max(0, ...last.map(([, i]) => -i));
        glow = Math.max(glow * 0.85, 0);
        [[iu, box.r - 52, '▲ up'], [id, box.r - 22, '▼ down']].forEach(([i, cx, label]) => {
          const b = Math.min(1, i / (0.6 * imax));
          const r = 7;
          g.save();
          g.shadowColor = COLOURS[k]; g.shadowBlur = 22 * b;
          g.fillStyle = COLOURS[k]; g.globalAlpha = 0.18 + 0.82 * b;
          g.beginPath(); g.arc(cx, 16, r, Math.PI, 0); g.lineTo(cx + r, 24); g.lineTo(cx - r, 24); g.closePath(); g.fill();
          g.restore();
          g.fillStyle = css('--ink-2'); g.textAlign = 'center'; g.font = '9px system-ui, sans-serif'; g.fillText(label, cx, 33);
        });
      }
    };
    api.on('params', () => { update(); draw(); });
    api.on('pedal', (messages) => {
      for (const m of messages) {
        if (m.type !== 1) continue;
        for (let j = 0; j < 7; j++) trail.push([m.values[4 * j], m.values[4 * j + 1]]);
      }
      if (trail.length > KEEP) trail.splice(0, trail.length - KEEP);
    });
    animate(canvas, draw);
    update();
  },
};

// The response: the small-signal gain from the input to the output against frequency, below the
// knee, where the circuit is linear: the low cut, the gain the Drive sets, the op-amp's bandwidth
// over that gain, and the Filter.
const responseView = {
  title: 'The response',
  caption: 'the gain to the output for a signal too small to reach the diodes\' knee, in dB, Level included: flat at 1 + R_drive/1 kΩ through the middle, falling to unity below the low cut 1/(2π · 1 kΩ · C), and at the top where the Filter\'s low-pass, the 100 pF across the Drive pot and the op-amp\'s gain–bandwidth product over the gain take it off. A real note is mostly past the knee, so this is the gain before the clipping. The green dots are the note you play.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let H, pp;
    const db = (x) => 20 * Math.log10(x);
    const update = () => {
      H = response(api.P); pp = parts(api.P);
      const G = 1 + pp.Rf / pp.Rg, flc = 1 / (2 * Math.PI * pp.Rg * pp.Cg), ffl = 1 / (2 * Math.PI * pp.Rft * pp.Ct);
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>gain ×${G.toFixed(1)}, ${db(G).toFixed(1)} dB before the Level</span><span>low cut ${flc < 100 ? flc.toFixed(1) : flc.toFixed(0)} Hz</span><span>Filter ${ffl >= 1000 ? `${(ffl / 1000).toFixed(1)} kHz` : `${ffl.toFixed(0)} Hz`}</span><span>op-amp ${(pp.GBW / G / 1000).toFixed(0)} kHz at this gain</span>`;
    };
    const draw = () => {
      if (!H) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const top = Math.max(...H.map(db)), dbMax = Math.ceil((top + 6) / 6) * 6;
      const { x, y, box } = freqAxes(g, w, h, { fmin: 10, fmax: 20000, dbMin: dbMax - 54, dbMax, step: 6 });
      g.strokeStyle = css('--accent'); g.lineWidth = 2.5; g.beginPath();
      H.forEach((v, i) => { const Y = Math.max(box.t, Math.min(box.b, y(db(v)))); i ? g.lineTo(x(FREQS[i]), Y) : g.moveTo(x(FREQS[i]), Y); });
      g.stroke();
      markNote(g, x, box, api.note);
      markPartials(g, x, y, box, api, (f) => db(atFreq(FREQS, H, f)));
    };
    api.on('params', () => { update(); draw(); });
    animate(canvas, draw);
    update();
  },
};

const SCOPE = 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. The bass comes out flattened at the diodes\' knee, rounded with germanium and silicon\'s soft knees, flatter with Schottkys; with the op-amp near its rails and no diodes, squared off hard. At full Drive with the LM308, a square\'s edges lean: the op-amp is slewing as fast as it can.';
const SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts (0 dBV is a sine of 1 V peak): clipping puts harmonics all the way up, the odd ones only while the two halves clip alike, the even ones too with One up, two down. The Filter takes the top off them. The green line is the note you are playing, and the ticks along the top its harmonics.';

createPedal({ PEDAL, worklet: new URL('./bandgap-worklet.js', import.meta.url), views: [diodesView, responseView, scopeView({ caption: SCOPE }), spectrumView({ caption: SPECTRUM })] });
