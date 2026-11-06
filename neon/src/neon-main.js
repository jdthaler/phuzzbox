// neon-main.js — the Neon Tremolo's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, animate } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './neon-pedal.js';

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
  const { s } = call(P, (at) => model.neon_parts(at));
  const r = Array.from(s.f64(28));
  return { Vb: r[0], Vm: r[1], Ve: r[2], pdMin: r[3], period: r[4], charge: r[5], flash: r[6], never: r[7] > 0.5, steady: r[8] > 0.5, Vs: r[9], R: r[10], C: r[11], gamma: r[14], pd: r[15], ballast: r[21], hold: r[22], Vmin: r[27] };
}
const PD = Float64Array.from({ length: 200 }, (_, i) => 0.1 * 1000 ** (i / 199));
function paschen(P) {
  const r = call(P, (at) => model.neon_paschen(at, PD.length), Array.from(PD)), n = PD.length;
  return { ne: r.at(n, r.n + n), he: r.at(n, r.n + 2 * n), ar: r.at(n, r.n + 3 * n) };
}
const NAMES = { ne: 'neon', he: 'helium', ar: 'argon' };
const GLOW = '#ff7a2f';

// the lamp as it plays, from the engine's messages: the capacitor's voltage, the lamp's peak
// current, the cell's resistance and the gain, 240 times a second
function tracker(api) {
  const trail = [], KEEP = 600, now = { v: 0, i: 0, R: 1000, g: 0 };
  api.on('pedal', (messages) => {
    for (const m of messages) {
      if (m.type !== 1) continue;
      for (let j = 0; j < 5; j++) trail.push(Array.from(m.values.slice(4 * j, 4 * j + 4)));
      [now.v, now.i, now.R, now.g] = trail.at(-1);
    }
    if (trail.length > KEEP) trail.splice(0, trail.length - KEEP);
  });
  return { trail, now, KEEP };
}
const status = (pp) => (pp.never ? `the supply is below the strike: dark`
  : pp.steady ? `R lets ${(1e6 * (pp.Vs - pp.Vm) / (pp.R + pp.ballast)).toFixed(0)} µA hold the glow: lit steady`
    : `${(1 / pp.period).toFixed(pp.period > 1 ? 2 : 1)} flashes a second, each ${(1e3 * pp.flash).toFixed(1)} ms`);

// The lamp: the bulb, its cathode glowing over as much of it as the current needs, and the last
// two and a half seconds of the capacitor's voltage between the striking and extinguishing lines,
// and of the bass's gain.
const lampView = {
  title: 'The lamp',
  caption: 'the neon lamp, its cathode covered in glow in proportion to its current (the normal glow keeps a fixed current density and spreads), with the last second\'s peak current and the cell\'s resistance, and the last two and a half seconds: the capacitor\'s voltage (white) charging through R toward the supply until it reaches the striking voltage, then dumping through the lamp in a few milliseconds to where the glow goes out; and the gain the cell leaves the bass (orange), which drops at each flash and swells back as the cell\'s electrons recombine.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const { trail, now, KEEP } = tracker(api);
    let pp, lit = 0;
    const update = () => {
      pp = parts(api.P);
      legend.innerHTML = `<span><i style="background:${css('--ink')}"></i>strikes ${Number.isFinite(pp.Vb) ? pp.Vb.toFixed(0) : '∞'} V, burns ${pp.Vm.toFixed(0)} V</span><span><i style="background:${GLOW}"></i>${status(pp)}</span>`;
    };
    const draw = () => {
      if (!pp) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      g.font = '11px system-ui, sans-serif';
      // the bulb: two electrodes, the cathode's glow over a share of it
      const bw = Math.min(64, w * 0.2), cx = 4 + bw / 2, cy = h * 0.42, r = bw * 0.4;
      const full = (pp.Vb - pp.Vm) / pp.ballast, share = Math.min(1, now.i / 1e3 / Math.max(full, 1e-6));
      lit = Math.max(share, lit * 0.8);
      if (lit > 0.01) {
        const halo = g.createRadialGradient(cx, cy, 0, cx, cy, r * 1.7);
        halo.addColorStop(0, `rgba(255,122,47,${0.7 * lit})`); halo.addColorStop(1, 'rgba(255,122,47,0)');
        g.fillStyle = halo; g.beginPath(); g.arc(cx, cy, r * 1.7, 0, 2 * Math.PI); g.fill();
      }
      g.strokeStyle = css('--ink-2'); g.lineWidth = 1.5;
      g.beginPath(); g.arc(cx, cy, r, 0, 2 * Math.PI); g.stroke();
      const ex = r * 0.25, eh = r * 0.6;
      g.lineWidth = 3;
      g.strokeStyle = css('--ink-2'); g.beginPath(); g.moveTo(cx + ex, cy - eh); g.lineTo(cx + ex, cy + eh); g.stroke();
      g.beginPath(); g.moveTo(cx - ex, cy - eh); g.lineTo(cx - ex, cy + eh); g.stroke();
      if (lit > 0.01) { g.strokeStyle = GLOW; g.lineWidth = 6; g.beginPath(); g.moveTo(cx - ex - 3, cy + eh); g.lineTo(cx - ex - 3, cy + eh - 2 * eh * lit); g.stroke(); }
      g.lineWidth = 1;
      g.fillStyle = css('--ink'); g.textAlign = 'center';
      let pk = 0; for (let k = Math.max(0, trail.length - 240); k < trail.length; k++) pk = Math.max(pk, trail[k][1]);
      g.fillText(`${pk.toFixed(1)} mA`, cx, cy + r + 18);
      g.fillStyle = css('--ink-2'); g.fillText(`${now.R >= 1000 ? (now.R / 1000).toFixed(2) + ' MΩ' : now.R.toFixed(0) + ' kΩ'}`, cx, cy + r + 32);
      // the traces: the capacitor above, the gain below
      const box = { l: bw + 40, r: w - 44, t: 12, b: h - 18 };
      if (box.r - box.l < 60) return;
      const mid = box.t + 0.62 * (box.b - box.t);
      g.strokeStyle = css('--grid'); g.strokeRect(box.l, box.t, box.r - box.l, mid - box.t); g.strokeRect(box.l, mid + 6, box.r - box.l, box.b - mid - 6);
      const vTop = Math.max(Number.isFinite(pp.Vb) ? pp.Vb : 0, Math.min(pp.Vs, 1.6 * pp.Vm)) + 10, vBot = Math.max(0, pp.Vm - 25);
      const YV = (v) => mid - ((mid - box.t) * (Math.min(Math.max(v, vBot), vTop) - vBot)) / (vTop - vBot);
      const YG = (d) => mid + 6 + ((box.b - mid - 6) * Math.min(24, -d)) / 24;
      const X = (i) => box.l + ((box.r - box.l) * i) / (KEEP - 1);
      g.setLineDash([4, 4]); g.strokeStyle = css('--ink-2');
      for (const [v, t] of [[pp.Vb, 'Vb'], [pp.Ve, 'Ve'], [pp.Vs, 'Vs']]) {
        if (!Number.isFinite(v) || v > vTop || v < vBot) continue;
        g.beginPath(); g.moveTo(box.l, YV(v)); g.lineTo(box.r, YV(v)); g.stroke();
        g.fillStyle = css('--ink-2'); g.textAlign = 'left'; g.fillText(`${t} ${v.toFixed(0)}`, box.r + 3, YV(v) + 4);
      }
      g.setLineDash([]);
      const off = KEEP - trail.length, line = (k, Y, colour) => {
        g.strokeStyle = colour; g.lineWidth = 2; g.beginPath();
        trail.forEach((p, i) => (i ? g.lineTo(X(i + off), Y(p[k])) : g.moveTo(X(i + off), Y(p[k]))));
        g.stroke(); g.lineWidth = 1;
      };
      line(0, YV, css('--ink'));
      line(3, YG, GLOW);
      g.fillStyle = css('--ink-2'); g.textAlign = 'right';
      g.fillText(`${vTop.toFixed(0)} V`, box.l - 4, box.t + 9); g.fillText(`${vBot.toFixed(0)} V`, box.l - 4, mid - 2);
      g.fillText('0 dB', box.l - 4, mid + 18); g.fillText('−24', box.l - 4, box.b);
    };
    api.on('params', update);
    animate(canvas, draw);
    update();
  },
};

// Paschen's curve: the voltage that strikes a gas against pressure times gap, for the three gases at
// the cathode's γ, the lamp marked on its own, with the supply and the burning voltage.
const paschenView = {
  title: 'Paschen\'s curve',
  caption: 'the voltage it takes to strike a discharge in the gas against its pressure times the gap, pd (Paschen\'s law), for the lamp\'s gas (bright) and the other two (faint), at the cathode\'s γ. Too little gas and an electron crosses the gap without enough collisions to make an avalanche; too much and it never gathers the energy to ionise between them; in between lies the minimum, where the lit lamp burns. The dot is the lamp: it strikes where its pd meets the curve, if the supply (dashed) reaches that high, and once lit burns from its cathode fall (dotted), 3/e of the minimum. The gap between the two is what each flash dumps; where the curve dips below the dotted line the lamp cannot flash.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let pp, curves;
    const update = () => {
      pp = parts(api.P); curves = paschen(api.P);
      legend.innerHTML = `<span><i style="background:${GLOW}"></i>${NAMES[api.P.gas]}, γ ${pp.gamma.toFixed(3)}: minimum ${pp.Vmin.toFixed(0)} V at ${pp.pdMin.toFixed(2)} Torr·cm</span><span><i style="background:${css('--accent-2')}"></i>supply ${pp.Vs.toFixed(0)} V</span>`;
    };
    const draw = () => {
      if (!pp) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      g.font = '11px system-ui, sans-serif';
      const box = { l: 44, r: w - 12, t: 12, b: h - 24 }, vlo = 20, vhi = 1000;
      const X = (pd) => box.l + ((box.r - box.l) * Math.log(pd / PD[0])) / Math.log(PD.at(-1) / PD[0]);
      const Y = (v) => box.b - ((box.b - box.t) * Math.log(Math.min(Math.max(v, vlo), vhi) / vlo)) / Math.log(vhi / vlo);
      g.strokeStyle = css('--grid'); g.lineWidth = 1; g.strokeRect(box.l, box.t, box.r - box.l, box.b - box.t);
      g.fillStyle = css('--ink-2'); g.textAlign = 'center';
      for (const pd of [0.1, 1, 10, 100]) { g.beginPath(); g.moveTo(X(pd), box.t); g.lineTo(X(pd), box.b); g.stroke(); g.fillText(`${pd}`, Math.min(X(pd), box.r - 10), box.b + 14); }
      g.textAlign = 'right'; g.fillText('pd, Torr·cm', box.r - 4, box.b - 6);
      g.textAlign = 'right';
      for (const v of [30, 100, 300, 1000]) { g.beginPath(); g.moveTo(box.l, Y(v)); g.lineTo(box.r, Y(v)); g.stroke(); g.fillText(`${v} V`, box.l - 4, Y(v) + 4); }
      const curve = (vals, colour, width) => {
        g.strokeStyle = colour; g.lineWidth = width; g.beginPath();
        let on = false;
        vals.forEach((v, i) => { if (!Number.isFinite(v) || v > vhi) { on = false; return; } on ? g.lineTo(X(PD[i]), Y(v)) : g.moveTo(X(PD[i]), Y(v)); on = true; });
        g.stroke(); g.lineWidth = 1;
      };
      for (const k of Object.keys(curves)) if (k !== api.P.gas) curve(curves[k], 'rgba(200,190,180,0.35)', 1.5);
      curve(curves[api.P.gas], GLOW, 2.5);
      g.textAlign = 'left'; g.fillStyle = css('--ink-2');
      for (const k of Object.keys(curves)) {
        if (k === api.P.gas) continue;
        const i = curves[k].findIndex((v) => Number.isFinite(v) && v < vhi * 0.7);
        if (i >= 0) g.fillText(NAMES[k], X(PD[Math.min(i + 6, PD.length - 1)]) + 4, Y(curves[k][Math.min(i + 6, PD.length - 1)]));
      }
      g.setLineDash([6, 4]); g.strokeStyle = css('--accent-2');
      g.beginPath(); g.moveTo(box.l, Y(pp.Vs)); g.lineTo(box.r, Y(pp.Vs)); g.stroke();
      g.setLineDash([2, 3]); g.strokeStyle = GLOW;
      g.beginPath(); g.moveTo(box.l, Y(pp.Vm)); g.lineTo(box.r, Y(pp.Vm)); g.stroke(); g.setLineDash([]);
      const vb = Number.isFinite(pp.Vb) ? pp.Vb : vhi;
      g.fillStyle = GLOW; g.beginPath(); g.arc(X(pp.pd), Y(vb), 5, 0, 2 * Math.PI); g.fill();
      g.strokeStyle = GLOW; g.beginPath(); g.moveTo(X(pp.pd), Y(vb)); g.lineTo(X(pp.pd), Y(pp.Vm)); g.stroke();
      g.fillStyle = css('--ink'); g.textAlign = X(pp.pd) > (box.l + box.r) / 2 ? 'right' : 'left';
      const dx = g.textAlign === 'right' ? -9 : 9;
      g.fillText(Number.isFinite(pp.Vb) ? `strikes ${pp.Vb.toFixed(0)} V` : 'never strikes', X(pp.pd) + dx, Y(vb) - 4);
    };
    api.on('params', update);
    animate(canvas, draw);
    update();
  },
};

const SCOPE = 'the bass going in (dashed) and coming out (solid), each scaled to fit. Each flash pulls the output down at once, and it swells back over a few tens of milliseconds as the cell lets go; the wave inside keeps its shape, because the cell is only a resistor.';
const SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts. A tremolo multiplies the bass by its gain, so each harmonic grows faint sidebands at the flash rate either side of it, too close to see apart at a few flashes a second; at a fast flicker they spread into skirts. The green line is the note you are playing, and the ticks along the top its harmonics.';

createPedal({ PEDAL, worklet: new URL('./neon-worklet.js', import.meta.url), views: [lampView, paschenView, scopeView({ caption: SCOPE }), spectrumView({ caption: SPECTRUM })] });
