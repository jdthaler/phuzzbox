// transformer-main.js — the Output Transformer's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, animate } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './transformer-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ model, for the views
const TONE = 0.3; // the note's peak at the input for the views (V): a firmly played passive bass
const STRINGS = [['E', 41.2], ['A', 55], ['D', 73.4], ['G', 98]];

function parts(P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  model.transformer_parts(s.at);
  const [Ms, a, alpha, k, c, N, l, RL, A, Rs, rp, divider, Bs, L0] = s.f64(14);
  return { Ms, a, alpha, k, c, N, l, RL, A, Rs, rp, divider, Bs, L0 };
}
function majorLoop(P, Hmax, n = 400) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  s.f64(1, 8 * v.length).set([Hmax]);
  model.transformer_loop(s.at, n);
  const r = s.f64(2 * n, 8 * (v.length + 1));
  return Array.from({ length: n }, (_, i) => [r[2 * i], r[2 * i + 1]]);
}
const tesla = (b) => `${b.toFixed(Math.abs(b) < 0.1 ? 3 : 2)} T`.replace('-', '−');
const field = (h) => (Math.abs(h) >= 1000 ? `${(h / 1000).toFixed(Math.abs(h) >= 10000 ? 0 : 1)}k` : `${+h.toPrecision(2)}`).replace('-', '−');
const line = (g, xs, ys) => { g.beginPath(); xs.forEach((x, i) => (i ? g.lineTo(x, ys[i]) : g.moveTo(x, ys[i]))); g.stroke(); };
// round a span to 1, 2 or 5 × 10^n
const nice = (x) => { const e = 10 ** Math.floor(Math.log10(x)), m = x / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * e; };

const trail = [], KEEP = 600; // (H, B) as you play: about a fifth of a second
function listen(api) {
  api.on('pedal', (messages) => {
    for (const m of messages) {
      if (m.type !== 1) continue;
      for (let j = 0; j < 10; j++) trail.push([m.values[2 * j], m.values[2 * j + 1]]);
    }
    if (trail.length > KEEP) trail.splice(0, trail.length - KEEP);
  });
}

// The core: its flux density against its field, the major loop and where the core is as you play.
const coreView = {
  title: 'The core',
  caption: 'the core\'s flux density B against the field H that the magnetising current makes, H = N i/l. The loop (solid) is the core driven to the edge of the view and back, from Jiles and Atherton\'s equation: up one side and down the other, never the same way twice, because the walls between the iron\'s magnetic domains stick on defects and jump past them, losing energy, the loop\'s area, every cycle. Its width at B = 0 is the coercive field; its flat top and bottom are saturation, µ0 Ms (dashed), where every domain already points along the field and more current buys almost no more flux. The dots are the core as you play: a note traces its own smaller loop, and the low notes, which need the most flux, reach toward the flat parts first.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let P, pp, loop, Hmax = 0;
    const update = (force) => {
      P = api.P; pp = parts(P);
      // the view spans the core's field as you play, at least five pinning fields k
      const reach = nice(Math.max(5 * pp.k, 1.2 * Math.max(0, ...trail.map(([h]) => Math.abs(h)))));
      if (!force && reach === Hmax) return;
      Hmax = reach; loop = majorLoop(P, Hmax);
      let hc = 0;
      for (let i = 1; i < loop.length; i++) if (loop[i - 1][1] > 0 && loop[i][1] <= 0) { hc = -loop[i][0]; break; }
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>loop to ±${field(Hmax)} A/m</span><span>Hc ${field(hc)} A/m</span><span>µ0 Ms ${tesla(pp.Bs)}</span>`;
    };
    const draw = () => {
      if (!loop) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      g.font = '11px system-ui, sans-serif';
      const B = { l: 46, r: w - 10, t: 8, b: h - 24 }, bmax = 1.35 * pp.Bs;
      const x = (H) => B.l + ((B.r - B.l) * (H + Hmax)) / (2 * Hmax), y = (b) => B.b - ((B.b - B.t) * (b + bmax)) / (2 * bmax);
      g.strokeStyle = css('--grid'); g.lineWidth = 1; g.strokeRect(B.l, B.t, B.r - B.l, B.b - B.t);
      g.fillStyle = css('--ink-2'); g.textAlign = 'center';
      for (const H of [-Hmax, -Hmax / 2, 0, Hmax / 2, Hmax]) { g.beginPath(); g.moveTo(x(H), B.t); g.lineTo(x(H), B.b); g.stroke(); if (w > 380 || H === 0 || Math.abs(H) === Hmax) g.fillText(field(H), x(H), B.b + 14); }
      const bs = nice(pp.Bs / 2.5);
      g.textAlign = 'right';
      for (let b = -Math.floor(bmax / bs) * bs; b <= bmax; b += bs) { g.beginPath(); g.moveTo(B.l, y(b)); g.lineTo(B.r, y(b)); g.stroke(); g.fillText(`${+b.toFixed(2)}`.replace('-', '−'), B.l - 4, y(b) + 4); }
      g.fillText('H (A/m) →', B.r - 4, B.b - 6); g.textAlign = 'left'; g.fillText('B (T) ↑', B.l + 4, B.t + 12);
      g.save(); g.beginPath(); g.rect(B.l, B.t, B.r - B.l, B.b - B.t); g.clip();
      g.strokeStyle = css('--ink-2'); g.setLineDash([5, 4]);
      for (const s of [1, -1]) line(g, [B.l, B.r], [y(s * pp.Bs), y(s * pp.Bs)]);
      g.setLineDash([]);
      g.strokeStyle = css('--accent'); g.lineWidth = 2; line(g, loop.map(([H]) => x(H)), loop.map(([, b]) => y(b))); g.lineWidth = 1;
      trail.forEach(([H, b], j) => { g.fillStyle = css('--good'); g.globalAlpha = 0.15 + (0.85 * j) / trail.length; g.fillRect(x(H) - 1.5, y(b) - 1.5, 3, 3); });
      g.globalAlpha = 1;
      g.restore();
    };
    api.on('params', () => { update(true); draw(); });
    let n = 0;
    animate(canvas, () => { if (++n % 15 === 0) update(false); draw(); });
    update(true);
  },
};

// The flux each note needs: Faraday's law, B = V/(2π f N A), against the frequency.
const fluxView = {
  title: 'The flux',
  caption: 'how much flux a note needs: the voltage across the primary is N A dB/dt, Faraday\'s law, so a sine of peak V needs a flux density swinging B = V/(2π f N A), the transformer equation V = 4.44 f N A B in its peak form. The line is a 0.3 V note at each frequency, through the source as the knobs set it, if the core took no current; the dashed line is saturation, µ0 Ms. The flux needed halves with each octave up, so the low notes reach saturation first: the bass is what big output transformers are big for. The marks are the open strings, and the dot is the flux the core reached on the note you play, at the note\'s pitch.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let P, pp, V;
    const need = (f) => V / (2 * Math.PI * f * pp.N * pp.A);
    const update = () => {
      P = api.P; pp = parts(P); V = P.drive * pp.divider * TONE;
      const knee = V / (2 * Math.PI * pp.N * pp.A * pp.Bs);
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>0.3 V in: ${V.toFixed(0)} V</span><span>low E ${tesla(need(41.2))}</span><span>saturates under ${knee >= 1 ? `${knee.toFixed(0)} Hz` : '1 Hz'}</span>`;
    };
    const draw = () => {
      if (!pp) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      g.font = '11px system-ui, sans-serif';
      const B = { l: 46, r: w - 10, t: 8, b: h - 24 }, f0 = 30, f1 = 1000, b0 = 0.01, b1 = 10;
      const x = (f) => B.l + ((B.r - B.l) * Math.log(f / f0)) / Math.log(f1 / f0), y = (b) => B.b - ((B.b - B.t) * Math.log(b / b0)) / Math.log(b1 / b0);
      g.strokeStyle = css('--grid'); g.lineWidth = 1; g.strokeRect(B.l, B.t, B.r - B.l, B.b - B.t);
      g.fillStyle = css('--ink-2'); g.textAlign = 'center';
      for (const f of [30, 50, 100, 200, 500, 1000]) { g.beginPath(); g.moveTo(x(f), B.t); g.lineTo(x(f), B.b); g.stroke(); g.fillText(f >= 1000 ? '1k' : `${f}`, x(f), B.b + 14); }
      g.textAlign = 'right';
      for (const b of [0.01, 0.1, 1, 10]) { g.beginPath(); g.moveTo(B.l, y(b)); g.lineTo(B.r, y(b)); g.stroke(); g.fillText(`${b}`, B.l - 4, y(b) + 4); }
      g.fillText('Hz →', B.r - 4, B.b - 6); g.textAlign = 'left'; g.fillText('B (T) ↑', B.l + 4, B.t + 12);
      g.save(); g.beginPath(); g.rect(B.l, B.t, B.r - B.l, B.b - B.t); g.clip();
      g.strokeStyle = css('--ink-2'); g.setLineDash([5, 4]); line(g, [B.l, B.r], [y(pp.Bs), y(pp.Bs)]); g.setLineDash([]);
      g.strokeStyle = css('--accent'); g.lineWidth = 2; line(g, [x(f0), x(f1)], [y(need(f0)), y(need(f1))]); g.lineWidth = 1;
      g.fillStyle = css('--ink'); g.textAlign = 'center';
      for (const [name, f] of STRINGS) { g.beginPath(); g.arc(x(f), y(need(f)), 3, 0, 2 * Math.PI); g.fill(); g.fillText(name, x(f), y(need(f)) - 7); }
      const f = api.note?.f;
      if (f && trail.length) {
        const peak = Math.max(...trail.map(([, b]) => Math.abs(b)));
        if (peak > b0) { g.fillStyle = css('--good'); g.beginPath(); g.arc(x(Math.min(f1, Math.max(f0, f))), y(peak), 4.5, 0, 2 * Math.PI); g.fill(); }
      }
      g.restore();
    };
    api.on('params', () => { update(); draw(); });
    animate(canvas, draw);
    update();
  },
};

const SCOPE = 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. With the core well inside its loop the two match but for a little rounding and a bass that leans; when a low note saturates the core the output collapses once each half cycle, where the flux runs out, and comes back as the note turns round.';
const SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts (0 dBV is a sine of 1 V peak). The core\'s loop is the same either way up, so it makes odd harmonics, the third above all, and the low notes, which need the most flux, gain the most. The green line is the note you are playing, and the ticks along the top its harmonics.';

listen.done = false;
createPedal({ PEDAL, worklet: new URL('./transformer-worklet.js', import.meta.url), views: [
  { ...coreView, mount(h, api) { if (!listen.done) { listen(api); listen.done = true; } coreView.mount(h, api); } },
  { ...fluxView, mount(h, api) { if (!listen.done) { listen(api); listen.done = true; } fluxView.mount(h, api); } },
  scopeView({ caption: SCOPE }), spectrumView({ caption: SPECTRUM })] });
