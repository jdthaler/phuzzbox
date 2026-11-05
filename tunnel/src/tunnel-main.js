// tunnel-main.js — the Tunnel Diode's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, animate } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './tunnel-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ model, for the views
const N = 240;      // points over two periods of the note, for the trace
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
  model.tunnel_parts(s.at);
  const [Ip, Vp, Iv, Vv, Vfp, I0, Jx, C4, Vm, gmin, up, down, osc] = s.f64(13);
  return { Ip, Vp, Iv, Vv, Vfp, I0, Jx, C4, Vm, gmin, up, down, osc: osc === 1 };
}
const curve = (P, V) => call(P, 'tunnel_curve', V, [V.length])(V.length, V.length);
const states = (P, vs) => { const r = call(P, 'tunnel_states', vs, [vs.length])(2 * vs.length, vs.length); return vs.map((_, i) => [r[2 * i], r[2 * i + 1]]); };
function tone(P, f) {
  const r = call(P, 'tunnel_tone', [f, TONE], [N]);
  return { vs: r(N, 2), V: r(N, 2 + N), i: r(N, 2 + 2 * N) };
}
const mv = (v) => `${(1e3 * v).toFixed(0)} mV`.replace('-', '−');
const ma = (i) => (Math.abs(i) < 1e-9 ? '0 mA' : `${(1e3 * i).toFixed(Math.abs(i) < 1e-4 ? 2 : 1)} mA`.replace('-', '−'));
const line = (g, xs, ys) => { g.beginPath(); xs.forEach((x, i) => (i ? g.lineTo(x, ys[i]) : g.moveTo(x, ys[i]))); g.stroke(); };

const trail = [], KEEP = 400; // (Vs, V, i) as you play, for both views
function listen(api) {
  api.on('pedal', (messages) => {
    for (const m of messages) {
      if (m.type !== 1) continue;
      for (let j = 0; j < 10; j++) trail.push([m.values[3 * j], m.values[3 * j + 1], m.values[3 * j + 2]]);
    }
    if (trail.length > KEEP) trail.splice(0, trail.length - KEEP);
  });
}

// The diode: its current against its voltage, the N that tunnelling makes, and the load line.
const diodeView = {
  title: 'The diode',
  caption: 'the tunnel diode\'s current against its voltage (solid): up to the peak, 1 mA at 55 mV, electrons tunnel straight through the thin junction; past it the bands stop lining up and the current falls, a negative resistance, to the valley, 0.1 mA at 350 mV; beyond, it is an ordinary diode. The straight line is the load line, the current the source can push through the load at each voltage of the diode, I = (Vs − V)/R, drawn at the bias: where it crosses the curve the circuit can rest. A switch\'s load line crosses three times: the middle crossing, on the falling part, is unstable, and the diode sits at one of the outer two until the bass tilts the line past the peak or the valley and it jumps. The dots are where the diode is as you play.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const VX = Array.from({ length: 351 }, (_, k) => -0.1 + (0.7 * k) / 350);
    let P, pp, I;
    const update = () => {
      P = api.P; pp = parts(P); I = curve(P, VX);
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>peak ${ma(pp.Ip)} at ${mv(pp.Vp)}</span><span>valley ${ma(pp.Iv)} at ${mv(pp.Vv)}</span><span>steepest ${(1 / pp.gmin).toFixed(0).replace('-', '−')} Ω</span><span>${pp.osc ? 'oscillator' : pp.up > 0 ? `jumps up at Vs = ${mv(pp.up)}, down at ${mv(pp.down)}` : 'no memory: the load is under 152 Ω'}</span>`;
    };
    const draw = () => {
      if (!I) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      g.font = '11px system-ui, sans-serif';
      const B = { l: 52, r: w - 10, t: 8, b: h - 24 }, imin = -0.3e-3, imax = 1.3e-3;
      const x = (v) => B.l + ((B.r - B.l) * (v + 0.1)) / 0.7, y = (i) => B.b - ((B.b - B.t) * (i - imin)) / (imax - imin);
      g.strokeStyle = css('--grid'); g.lineWidth = 1; g.strokeRect(B.l, B.t, B.r - B.l, B.b - B.t);
      g.fillStyle = css('--ink-2'); g.textAlign = 'center';
      for (let v = -0.1; v <= 0.6001; v += 0.1) { g.beginPath(); g.moveTo(x(v), B.t); g.lineTo(x(v), B.b); g.stroke(); if (w > 380 || Math.round(v * 10) % 2 === 0) g.fillText(mv(v).replace(' mV', ''), x(v), B.b + 14); }
      g.textAlign = 'right';
      for (const i of [0, 0.4e-3, 0.8e-3, 1.2e-3]) { g.beginPath(); g.moveTo(B.l, y(i)); g.lineTo(B.r, y(i)); g.stroke(); g.fillText(ma(i), B.l - 4, y(i) + 4); }
      g.fillText('mV', B.r - 4, B.t + 12);
      g.save(); g.beginPath(); g.rect(B.l, B.t, B.r - B.l, B.b - B.t); g.clip();
      g.strokeStyle = css('--accent'); g.lineWidth = 2; line(g, VX.map(x), I.map(y)); g.lineWidth = 1;
      // the load line at the bias, and where the bass has it now
      const vsNow = trail.length ? trail[trail.length - 1][0] : P.bias;
      g.strokeStyle = css('--ink-2'); g.setLineDash([5, 4]); line(g, [x(-0.1), x(0.6)], [y((P.bias + 0.1) / P.load), y((P.bias - 0.6) / P.load)]); g.setLineDash([]);
      if (!pp.osc) { g.strokeStyle = css('--ink'); line(g, [x(-0.1), x(0.6)], [y((vsNow + 0.1) / P.load), y((vsNow - 0.6) / P.load)]); }
      trail.forEach(([, v, i], j) => { g.fillStyle = css('--good'); g.globalAlpha = 0.15 + (0.85 * j) / trail.length; g.fillRect(x(v) - 1.5, y(i) - 1.5, 3, 3); });
      g.globalAlpha = 1;
      g.restore();
    };
    api.on('params', () => { update(); draw(); });
    animate(canvas, draw);
    update();
  },
};

// The switch: the diode's voltage against the source's, its two branches and the jumps between
// them; and two periods of a note through it.
const switchView = {
  title: 'The switch',
  caption: 'on the left, the diode\'s voltage against the source\'s, Vs = Bias + Drive × your bass: the low branch (under 55 mV) and the high one (over 350 mV) where the circuit can rest (solid), and the jumps between them (dashed). Going up, the diode stays low until Vs reaches the top of the low branch, then jumps; coming down it stays high until the high branch ends: the loop between is the switch\'s memory, wider the larger the load. The dots are the diode as you play. In the oscillator nothing rests, so no branch is drawn: the dots run between the two levels by themselves. On the right, two periods of the note you play (the A at 110 Hz until you play), 0.3 V in: the source (dashed) and the diode (solid).',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let P, pp, VS, ST, tr, lo, hi;
    const update = () => {
      P = api.P; pp = parts(P);
      const reach = Math.max(0.3, P.drive * TONE * 1.3);
      lo = Math.min(P.bias - reach, pp.down > 0 ? pp.down - 0.1 : 0); hi = Math.max(P.bias + reach, pp.up + 0.1);
      VS = Array.from({ length: 301 }, (_, k) => lo + ((hi - lo) * k) / 300);
      ST = states(P, VS);
      tr = tone(P, api.note?.f ?? 110);
      const swing = Math.max(...tr.V) - Math.min(...tr.V);
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>${pp.osc ? 'the oscillator: nothing rests' : pp.up > 0 ? `memory ${mv(pp.up - pp.down)} wide` : 'no memory'}</span><span>the note swings the diode ${mv(swing)}</span>`;
    };
    const draw = () => {
      if (!ST) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const wide = w > 560;
      const L = wide ? { l: 46, t: 8, r: w * 0.5 - 8, b: h - 24 } : { l: 46, t: 8, r: w - 10, b: Math.round(h * 0.55) - 22 };
      const T = wide ? { l: w * 0.5 + 34, t: 8, r: w - 10, b: h - 24 } : { l: 46, t: Math.round(h * 0.55) + 6, r: w - 10, b: h - 20 };
      g.font = '11px system-ui, sans-serif';
      const vmin = -0.15, vmax = 0.65;
      const lx = (v) => L.l + ((L.r - L.l) * (v - lo)) / (hi - lo), ly = (v) => L.b - ((L.b - L.t) * (v - vmin)) / (vmax - vmin);
      g.strokeStyle = css('--grid'); g.lineWidth = 1; g.strokeRect(L.l, L.t, L.r - L.l, L.b - L.t);
      g.fillStyle = css('--ink-2'); g.textAlign = 'right';
      for (const v of [0, 0.2, 0.4, 0.6]) { g.beginPath(); g.moveTo(L.l, ly(v)); g.lineTo(L.r, ly(v)); g.stroke(); g.fillText(mv(v).replace(' mV', ''), L.l - 4, ly(v) + 4); }
      g.textAlign = 'center';
      const stepV = (hi - lo) > 3 ? 1 : (hi - lo) > 1.2 ? 0.5 : 0.2;
      for (let v = Math.ceil(lo / stepV) * stepV; v <= hi; v += stepV) { g.beginPath(); g.moveTo(lx(v), L.t); g.lineTo(lx(v), L.b); g.stroke(); g.fillText(`${v.toFixed(1)}`.replace('-', '−'), lx(v), L.b + 14); }
      g.textAlign = 'right'; g.fillText('Vs (V) →', L.r - 4, L.b - 6); g.textAlign = 'left'; g.fillText('V (mV) ↑', L.l + 4, L.t + 12);
      g.save(); g.beginPath(); g.rect(L.l, L.t, L.r - L.l, L.b - L.t); g.clip();
      g.strokeStyle = css('--accent'); g.lineWidth = 2;
      for (const b of pp.osc ? [] : [0, 1]) {
        g.beginPath(); let on = false;
        VS.forEach((v, k) => { const s = ST[k][b]; if (!Number.isFinite(s)) { on = false; return; } on ? g.lineTo(lx(v), ly(s)) : g.moveTo(lx(v), ly(s)); on = true; });
        g.stroke();
      }
      g.lineWidth = 1;
      if (pp.up > 0 && !pp.osc) {
        const at = (vs, b) => states(P, [vs])[0][b];
        g.strokeStyle = css('--ink-2'); g.setLineDash([5, 4]);
        line(g, [lx(pp.up), lx(pp.up)], [ly(at(pp.up - 1e-6, 0)), ly(at(pp.up, 1))]);
        line(g, [lx(pp.down), lx(pp.down)], [ly(at(pp.down + 1e-6, 1)), ly(at(pp.down, 0))]);
        g.setLineDash([]);
      }
      trail.forEach(([vs, v], j) => { g.fillStyle = css('--good'); g.globalAlpha = 0.15 + (0.85 * j) / trail.length; g.fillRect(lx(vs) - 1.5, ly(v) - 1.5, 3, 3); });
      g.globalAlpha = 1;
      g.restore();
      // right: two periods of the note
      const tx = (i) => T.l + ((T.r - T.l) * i) / (N - 1);
      const slo = Math.min(...tr.vs), shi = Math.max(...tr.vs), sy = (v) => T.b - ((T.b - T.t) * (v - slo + 0.05 * (shi - slo || 1))) / ((shi - slo || 1) * 1.1);
      const ty = (v) => T.b - ((T.b - T.t) * (v - vmin)) / (vmax - vmin);
      g.strokeStyle = css('--grid'); g.strokeRect(T.l, T.t, T.r - T.l, T.b - T.t);
      g.strokeStyle = css('--ink-2'); g.setLineDash([5, 4]); line(g, tr.vs.map((_, i) => tx(i)), tr.vs.map(sy)); g.setLineDash([]);
      g.strokeStyle = css('--accent'); g.lineWidth = 2; line(g, tr.V.map((_, i) => tx(i)), tr.V.map(ty)); g.lineWidth = 1;
      g.fillStyle = css('--ink-2'); g.textAlign = 'right';
      for (const v of [0, 0.4]) g.fillText(mv(v).replace(' mV', ''), T.l - 4, ty(v) + 4);
      g.textAlign = 'center'; g.fillText(`two periods of ${(api.note?.f ?? 110).toFixed(1)} Hz`, (T.l + T.r) / 2, T.b + 14);
    };
    api.on('params', () => { update(); draw(); });
    let lastF = 0;
    animate(canvas, () => { const f = api.note?.f ?? 0; if (Math.abs(f - lastF) > 0.5) { lastF = f; update(); } draw(); });
    update();
  },
};

const SCOPE = 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. The switch turns each note into a square wave of much the same height whatever you play, 0.65 V from trough to crest for a 0.3 V note (the jump between its branches, and the little of the note each branch passes), until the note dies below what it takes to flip it and the switch stops; the oscillator buzzes at its own pitch, set by the inductor, while your bass moves its bias.';
const SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts (0 dBV is a sine of 1 V peak). The switch\'s square wave has every odd harmonic of the note, each 1/n of the fundamental, and even ones when the memory makes it lopsided; the oscillator puts its own pitch and its harmonics wherever the inductor sets them. The green line is the note you are playing, and the ticks along the top its harmonics.';

listen.done = false;
createPedal({ PEDAL, worklet: new URL('./tunnel-worklet.js', import.meta.url), views: [
  { ...diodeView, mount(h, api) { if (!listen.done) { listen(api); listen.done = true; } diodeView.mount(h, api); } },
  { ...switchView, mount(h, api) { if (!listen.done) { listen(api); listen.done = true; } switchView.mount(h, api); } },
  scopeView({ caption: SCOPE }), spectrumView({ caption: SPECTRUM })] });
