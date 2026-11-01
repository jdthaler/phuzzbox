// rotary-main.js — the Rotary Speaker's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, animate } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './rotary-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ patterns, for the views

// the engine's state, from its messages, and where the rotors are between them
const live = { at: 0, v: null };
const angles = () => {
  if (!live.v) return null;
  const dt = Math.min(0.1, (performance.now() - live.at) / 1000);
  return { horn: live.v[0] + 2 * Math.PI * live.v[2] * dt, drum: live.v[1] + 2 * Math.PI * live.v[3] * dt };
};
const listen = (api) => api.on('pedal', (messages) => { for (const m of messages) if (m.type === 1) { live.v = m.values; live.at = performance.now(); } });

// The cabinet from above: the drum and its opening, the horn and its blocked twin, the microphones.
const cabinetView = {
  title: 'The cabinet',
  caption: 'the rotors from above, as they turn: the drum (its opening the bright arc) and the horn (its mouth the bright end; the other end is blocked, a counterweight), with the two microphones at their spread (drawn nearer than they are when they are far). Each line from the horn to a microphone is the path its sound takes, red while the horn comes toward that microphone and its pitch is raised, blue while it goes away.',
  perform: true,
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    listen(api);
    let shown = 0;
    animate(canvas, () => {
      const { g, w, h } = fit(canvas), P = api.P;
      g.clearRect(0, 0, w, h);
      const a = angles() ?? { horn: 0, drum: 0 };
      // the cabinet to scale, filling most of the height; the microphones at the edge, their
      // distance printed (at 1 m they would be off the canvas)
      const cx = w / 2, cy = h / 2, edge = Math.min(w, h) / 2 - 10, k = (0.62 * edge) / 0.37, micR = edge / k;
      const X = (x, y) => [cx + k * x, cy - k * y];
      // the cabinet
      g.strokeStyle = css('--grid'); g.lineWidth = 1;
      const half = 0.37; // a Leslie's cabinet is about 74 cm wide
      const [x0, y0] = X(-half, half);
      g.strokeRect(x0, y0, 2 * half * k, 2 * half * k);
      // the drum
      g.beginPath(); g.arc(cx, cy, P.drumR * k, 0, 2 * Math.PI); g.strokeStyle = css('--ink-2'); g.lineWidth = 1.5; g.stroke();
      const open = Math.asin(Math.min(1, P.drumA / P.drumR));
      g.beginPath(); g.arc(cx, cy, P.drumR * k, -a.drum - open, -a.drum + open); g.strokeStyle = css('--accent'); g.lineWidth = 5; g.stroke();
      // the horn and its blocked twin
      const end = (s) => X(s * P.hornR * Math.cos(a.horn), s * P.hornR * Math.sin(a.horn));
      const [hx, hy] = end(1), [bx, by] = end(-1);
      g.lineWidth = 3; g.strokeStyle = css('--ink-2');
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(bx, by); g.stroke();
      g.strokeStyle = css('--accent');
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(hx, hy); g.stroke();
      const mouth = Math.max(3, P.hornA * k);
      g.beginPath(); g.moveTo(hx - mouth * Math.sin(a.horn), hy - mouth * Math.cos(a.horn)); g.lineTo(hx + mouth * Math.sin(a.horn), hy + mouth * Math.cos(a.horn)); g.lineWidth = 4; g.stroke();
      // the microphones, and the horn's paths to them
      for (const m of [0, 1]) {
        const phi = (m ? 0.5 : -0.5) * P.spread, rr = Math.min(micR, P.distance), [mx, my] = X(rr * Math.cos(phi), rr * Math.sin(phi));
        const dop = live.v ? live.v[4 + m] : 1;
        g.strokeStyle = dop > 1.0005 ? '#ef4444' : dop < 0.9995 ? '#60a5fa' : css('--ink-2');
        g.lineWidth = 1.5; g.setLineDash([4, 4]);
        g.beginPath(); g.moveTo(hx, hy); g.lineTo(mx, my); g.stroke(); g.setLineDash([]);
        g.fillStyle = css('--ink'); g.beginPath(); g.arc(mx, my, 5, 0, 2 * Math.PI); g.fill();
        g.font = '11px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = css('--ink-2');
        g.fillText(m ? 'R' : 'L', mx, my + (my > cy ? 18 : -10));
      }
      g.textAlign = 'left'; g.fillStyle = css('--ink-2');
      g.fillText(`mics at ${P.distance.toFixed(2)} m`, 8, 14);
      if (live.v && ++shown % 10 === 0) {
        const c = (r) => `${r >= 1 ? '+' : '−'}${Math.abs(1200 * Math.log2(r)).toFixed(1)}¢`;
        legend.innerHTML = `<span style="color:var(--accent)">● horn ${(60 * live.v[2]).toFixed(0)} rpm, ${c(live.v[4])} at L</span><span>drum ${(60 * live.v[3]).toFixed(0)} rpm, ${c(live.v[6])} at L</span>`;
      }
    });
  },
};

// The pitch each rotor is heard at, over the last few seconds.
const pitchView = {
  title: 'The pitch',
  caption: 'how far each rotor\'s pitch is moved at the microphones, in cents, over the last four seconds: the horn at the left microphone (solid) and the right (dashed), the drum at the left (grey). The horn\'s mouth moves faster, so its swing is wider; switch to Fast and watch the horn get there in about a second and the drum take several.',
  perform: true,
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    listen(api);
    const hist = [];
    api.on('pedal', (messages) => { for (const m of messages) if (m.type === 1) { hist.push([m.values[4], m.values[5], m.values[6]]); if (hist.length > 200) hist.shift(); } });
    animate(canvas, () => {
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const box = { l: 40, r: w - 10, t: 10, b: h - 20 }, lim = 40;
      const y = (c) => (box.t + box.b) / 2 - ((box.b - box.t) / 2) * (c / lim);
      g.strokeStyle = css('--grid'); g.fillStyle = css('--ink-2'); g.lineWidth = 1; g.font = '11px system-ui, sans-serif'; g.textAlign = 'right';
      for (const c of [-40, -20, 0, 20, 40]) { g.beginPath(); g.moveTo(box.l, y(c)); g.lineTo(box.r, y(c)); g.stroke(); g.fillText(`${c > 0 ? '+' : c < 0 ? '−' : ''}${Math.abs(c)}¢`, box.l - 6, y(c) + 4); }
      g.textAlign = 'center'; g.fillText('4 s ago', box.l + 24, h - 5); g.fillText('now', box.r - 12, h - 5);
      const line = (k, color, width, dash = []) => {
        g.beginPath(); g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash);
        hist.forEach((v, i) => { const X = box.r - ((box.r - box.l) * (hist.length - 1 - i)) / 199, Y = y(Math.max(-lim, Math.min(lim, 1200 * Math.log2(v[k])))); i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
        g.stroke(); g.setLineDash([]);
      };
      line(2, css('--ink-2'), 1.5);
      line(1, css('--accent'), 1.5, [4, 4]);
      line(0, css('--accent'), 2.5);
    });
  },
};

// The horn's and the drum's patterns: the piston's, at three pitches.
const patternView = {
  title: 'The patterns',
  caption: 'how loud each rotor sends a pitch at each angle from where it points (0° at the top, as the engine plays it): a rigid piston the size of the horn\'s mouth or the drum\'s opening, 2 J1(x)/x. A wavelength much longer than the opening goes every way (the outer circle); a shorter one beams. Behind it each sends what it sends sideways.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const F = [200, 1000, 4000], M = 73;
    let pts = null;
    const compute = () => {
      pts = [0, 1].map((which) => Array.from({ length: M }, (_, i) => {
        const th = (Math.PI * i) / (M - 1), s = th <= Math.PI / 2 ? Math.sin(th) : 1;
        const sc = scratch(model), v = Effect.native(api.P);
        sc.f64(v.length + 2 + F.length).set([...v, which, s, ...F]);
        model.rotary_pattern(sc.at, F.length);
        return Array.from(sc.f64(F.length, 8 * (v.length + 2 + F.length)));
      }));
      legend.innerHTML = F.map((f, i) => `<span style="opacity:${1 - 0.3 * i}">${['━', '╍', '┄'][i]} ${f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`}</span>`).join('');
    };
    api.on('params', compute);
    animate(canvas, () => {
      if (!pts) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const R = Math.min(w / 4 - 12, h / 2 - 22);
      ['horn', 'drum'].forEach((name, which) => {
        const cx = w / 4 + (which * w) / 2, cy = h / 2 + 6;
        g.strokeStyle = css('--grid'); g.lineWidth = 1;
        for (const r of [0.25, 0.5, 0.75, 1]) { g.beginPath(); g.arc(cx, cy, R * r, 0, 2 * Math.PI); g.stroke(); }
        g.fillStyle = css('--ink-2'); g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
        g.fillText(`the ${name}`, cx, 12);
        F.forEach((_, j) => {
          g.beginPath(); g.strokeStyle = css('--accent'); g.globalAlpha = 1 - 0.3 * j; g.lineWidth = 2; g.setLineDash([[], [6, 3], [2, 3]][j]);
          for (const side of [1, -1]) pts[which].forEach((v, i) => {
            const th = (Math.PI * i) / (M - 1), r = R * Math.min(1, Math.abs(v[j]));
            const X = cx + side * r * Math.sin(th), Y = cy - r * Math.cos(th);
            i ? g.lineTo(X, Y) : g.moveTo(X, Y);
          });
          g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
        });
      });
    });
    compute();
  },
};

const ROTARY_SCOPE = 'the voltage at the input (dashed) and at the left microphone (solid) as you play, each scaled to fit: the level throbs as the horn and the drum turn toward the microphone and away.';
const ROTARY_SPECTRUM = 'what goes in (dashed) and what the left microphone hears (solid), in dB of volts. Each harmonic is smeared by the pitch swing: the higher it is, the wider, since a Doppler shift moves every frequency by the same share. The green line is the note you are playing.';

createPedal({ PEDAL, worklet: new URL('./rotary-worklet.js', import.meta.url), views: [cabinetView, pitchView, patternView, spectrumView({ caption: ROTARY_SPECTRUM }), scopeView({ caption: ROTARY_SCOPE })] });
