// preamp-main.js — the Tube Preamp's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, freqAxes, animate, markNote } from '../../shared/plot.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './preamp-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ model, for the views
const NODES = ['A', 'M', 'G1', 'P1', 'K1', 'Q', 'W1', 'G2', 'P2', 'K2', 'K3', 'T', 'O', 'X', 'S', 'Y', 'Z', 'V', 'D', 'E'];
// each stage's resistance in the plate-to-cathode loop, for its DC load line (native/pedals/preamp/preamp-model.h)
const STAGES = [
  { name: 'V1a, first gain stage', r: 100e3 + 1.5e3 },
  { name: 'V2a, second gain stage', r: 100e3 + 820 },
  { name: 'V2b, cathode follower', r: 100e3 },
];
const N = 240, FREQS = Float64Array.from({ length: N }, (_, i) => 20 * 1000 ** (i / (N - 1)));
const db = (x) => 20 * Math.log10(x);

// the DC operating point: node voltages, and each triode's grid and plate voltages and currents (preamp-web.cpp)
function operatingPoint(P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  model.preamp_operating_point(s.at);
  const r = Array.from(s.f64(NODES.length + 12));
  const node = Object.fromEntries(NODES.map((n, i) => [n, r[i]]));
  const tubes = [0, 1, 2].map((t) => { const o = r.slice(NODES.length + 4 * t, NODES.length + 4 * t + 4); return { vg: o[0], va: o[1], ig: o[2], ia: o[3] }; });
  return { node, tubes };
}
// the tube's plate current at each plate voltage, for each grid voltage
function plateCurves(P, va, vg) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  s.f64(va.length + vg.length, 8 * v.length).set([...va, ...vg]);
  model.preamp_plate_curves(s.at, va.length, vg.length);
  const out = s.f64(va.length * vg.length, 8 * (v.length + va.length + vg.length));
  return vg.map((_, g) => Array.from(out.slice(g * va.length, (g + 1) * va.length)));
}
// the small-signal response at FREQS: the whole preamp, and its tone stack and Master alone
function response(P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  s.f64(N, 8 * v.length).set(FREQS);
  model.preamp_response(s.at, N);
  const out = s.f64(3 * N, 8 * (v.length + N));
  return { all: Array.from(out.slice(0, N)), stack: Array.from(out.slice(2 * N, 3 * N)) };
}
const mA = (a) => `${(a * 1e3).toFixed(2)} mA`, V = (x) => `${x.toFixed(1).replace('-', '−')} V`;

// The triodes: each one's plate characteristics, its DC load line, its operating point, and where
// it goes as you play.
const tubeView = {
  title: 'The tubes',
  caption: 'each triode\'s plate current against the voltage across it, at grid voltages of 0, −1, −2, −3 and −4 V from its cathode (thin), with the line its resistors allow (dashed) and the operating point (ring). Play, and the trail runs up and down its load line: past the 0 V curve the grid is conducting, at the bottom the tube is cut off.',
  mount(holder, api) {
    holder.classList.add('tubes');
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const trail = [[], [], []], KEEP = 240, VG = [0, -1, -2, -3, -4];
    let curves, op, vmax = 400, imax = 4e-3;
    const update = () => {
      const P = api.P;
      op = operatingPoint(P);
      vmax = Math.max(100, Math.ceil(op.node.D / 50) * 50);
      const vs = Array.from({ length: 80 }, (_, i) => (vmax * (i + 0.5)) / 80);
      curves = { vs, ia: plateCurves(P, vs, VG) };
      imax = 1.2 * (op.node.D / STAGES[2].r);
      legend.innerHTML = op.tubes.map((t, k) => `<span>${STAGES[k].name.split(',')[0]}: ${V(t.va)} across it, ${mA(t.ia)}, grid ${V(t.vg)}</span>`).join('') + `<span>rail ${V(op.node.D)}</span>`;
      draw();
    };
    const draw = () => {
      if (!op) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const stacked = h > 0.6 * w, pw = stacked ? w : w / 3, ph = stacked ? h / 3 : h;
      [0, 1, 2].forEach((k) => {
        const ox = stacked ? 0 : k * pw, oy = stacked ? k * ph : 0;
        const box = { l: ox + 46, r: ox + pw - 10, t: oy + 16, b: oy + ph - 32 };
        const X = (v) => box.l + ((box.r - box.l) * Math.max(0, Math.min(v, vmax))) / vmax;
        const Y = (i) => box.b - ((box.b - box.t) * Math.max(0, Math.min(i, imax))) / imax;
        g.strokeStyle = css('--grid'); g.fillStyle = css('--ink-2'); g.lineWidth = 1; g.font = '11px system-ui, sans-serif';
        g.strokeRect(box.l, box.t, box.r - box.l, box.b - box.t);
        g.textAlign = 'left'; g.fillText(STAGES[k].name, box.l + 6, box.t + 13);
        g.textAlign = 'center'; g.fillText('V_plate − V_cathode (V)', (box.l + box.r) / 2, box.b + 26);
        for (let v = 0; v <= vmax; v += 100) g.fillText(String(v), X(v), box.b + 11);
        g.textAlign = 'right'; g.fillText((imax * 1e3).toFixed(1), box.l - 4, box.t + 8); g.fillText('0', box.l - 4, box.b);
        g.save(); g.translate(ox + 10, (box.t + box.b) / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText('I_plate (mA)', 0, 0); g.restore();
        g.save();
        g.beginPath(); g.rect(box.l, box.t, box.r - box.l, box.b - box.t); g.clip();
        g.strokeStyle = css('--ink-2'); g.lineWidth = 1;
        for (const ia of curves.ia) { g.beginPath(); ia.forEach((i, j) => (j ? g.lineTo(X(curves.vs[j]), Y(i)) : g.moveTo(X(curves.vs[j]), Y(i)))); g.stroke(); }
        // the DC load line: the rail through the stage's resistances (its plate and cathode resistors)
        g.strokeStyle = css('--accent-2'); g.setLineDash([5, 4]); g.beginPath(); g.moveTo(X(op.node.D), Y(0)); g.lineTo(X(0), Y(op.node.D / STAGES[k].r)); g.stroke(); g.setLineDash([]);
        const t = trail[k];
        g.fillStyle = css('--accent');
        t.forEach(([v, i], j) => { g.globalAlpha = 0.15 + (0.85 * j) / t.length; g.fillRect(X(v) - 1.5, Y(i) - 1.5, 3, 3); });
        g.globalAlpha = 1;
        const q = op.tubes[k];
        g.strokeStyle = css('--accent'); g.lineWidth = 2; g.beginPath(); g.arc(X(q.va), Y(q.ia), 5, 0, 2 * Math.PI); g.stroke();
        g.restore();
      });
    };
    api.on('params', update);
    api.on('pedal', (messages) => {
      for (const m of messages) {
        if (m.type !== 1) continue;
        for (let j = 0; j < 4; j++) for (let k = 0; k < 3; k++) trail[k].push([m.values[6 * j + 2 * k], m.values[6 * j + 2 * k + 1]]);
      }
      for (const t of trail) if (t.length > KEEP) t.splice(0, t.length - KEEP);
    });
    animate(canvas, draw);
    new ResizeObserver(draw).observe(canvas);
    update();
  },
};

// The tone stack: the whole preamp's response for a small signal, and the tone stack's own.
const toneView = {
  title: 'The tone stack',
  caption: 'the preamp\'s gain for a small signal, from what your interface records to what comes out (solid), and the tone stack and Master alone (dashed). Turn Bass, Middle and Treble and watch the scoop move: the stack only ever takes away, most of all in the middle.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    let H = null;
    const draw = () => {
      if (!H) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const { x, y, box } = freqAxes(g, w, h, { dbMin: -48, dbMax: 36, step: 12 });
      const line = (vals, color, width, dash = []) => {
        g.beginPath(); g.setLineDash(dash); g.strokeStyle = color; g.lineWidth = width;
        vals.forEach((v, i) => { const X = x(FREQS[i]), Y = Math.max(box.t, Math.min(box.b, y(db(v)))); i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
        g.stroke(); g.setLineDash([]);
      };
      line(H.stack, css('--ink-2'), 1.2, [5, 4]);
      line(H.all, css('--accent'), 2.5);
    };
    api.on('params', () => { H = response(api.P); draw(); });
    new ResizeObserver(draw).observe(canvas);
    H = response(api.P);
    draw();
  },
};

// A scope: the input and the output, in volts, lined up on the output's rising edges.
const scopeView = {
  title: 'Scope',
  caption: 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. Turn up Gain and the tops round off first: the second triode\'s grid starts to conduct on one side and it cuts off on the other.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    let a = null, b = null;
    animate(canvas, () => {
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const box = { l: 40, r: w - 10, t: 10, b: h - 20 };
      g.strokeStyle = css('--grid'); g.fillStyle = css('--ink-2'); g.lineWidth = 1; g.font = '11px system-ui, sans-serif';
      g.beginPath(); g.moveTo(box.l, (box.t + box.b) / 2); g.lineTo(box.r, (box.t + box.b) / 2); g.stroke();
      if (!api.analyser || !api.input) { g.textAlign = 'center'; g.fillText('Start audio, then play', (box.l + box.r) / 2, (box.t + box.b) / 2 - 8); return; }
      a ??= new Float32Array(api.analyser.fftSize); b ??= new Float32Array(api.input.fftSize);
      api.analyser.getFloatTimeDomainData(a);
      api.input.getFloatTimeDomainData(b);
      const k = api.fullScale(), fs = api.ctx.sampleRate, span = Math.round(0.05 * fs); // 50 ms
      const off = b.length - a.length;
      let start = a.length - span - 1;
      for (let i = a.length - span - 1; i > 1; i--) if (a[i - 1] < 0 && a[i] >= 0) { start = i; break; }
      let ma = 1e-4, mb = 1e-4;
      for (let i = 0; i < span; i++) { ma = Math.max(ma, Math.abs(k * a[start + i])); mb = Math.max(mb, Math.abs(b[off + start + i])); }
      const X = (i) => box.l + ((box.r - box.l) * i) / span, Y = (v, m) => (box.t + box.b) / 2 - ((box.b - box.t) / 2) * (v / m) * 0.95;
      g.textAlign = 'left';
      g.fillText(`±${(ma * 1000).toFixed(0)} mV`, box.l + 4, box.t + 8);
      g.textAlign = 'center'; g.fillText(`50 ms; input ${(mb * 1000).toFixed(0)} mV at full height`, (box.l + box.r) / 2, h - 5);
      g.strokeStyle = css('--ink-2'); g.lineWidth = 1.2; g.setLineDash([4, 3]); g.beginPath();
      for (let i = 0; i < span; i++) { const yy = Y(b[off + start + i], mb); i ? g.lineTo(X(i), yy) : g.moveTo(X(i), yy); }
      g.stroke(); g.setLineDash([]);
      g.strokeStyle = css('--accent'); g.lineWidth = 2; g.beginPath();
      for (let i = 0; i < span; i++) { const yy = Y(k * a[start + i], ma); i ? g.lineTo(X(i), yy) : g.moveTo(X(i), yy); }
      g.stroke();
    });
  },
};

// The spectra of the input and the output: the harmonics the triodes add.
const spectrumView = {
  title: 'Spectrum',
  caption: 'what goes in (dashed) and what comes out (solid), in dB of volts: clean, the harmonics are the bass\'s own, shaped by the tone stack; turned up, the triodes add their own, the even ones first, since each clips more on one side than the other. The green line is the note you are playing, as the tuner hears it at the input, and the ticks along the top its harmonics.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    let dOut = null, dIn = null;
    animate(canvas, () => {
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const { x, y, box } = freqAxes(g, w, h, { fmin: 30, dbMin: -120, dbMax: 0, step: h < 260 ? 24 : 12 });
      if (!api.analyser || !api.input) { g.fillStyle = css('--ink-2'); g.textAlign = 'center'; g.fillText('Start audio, then play', (box.l + box.r) / 2, (box.t + box.b) / 2); return; }
      markNote(g, x, box, api.note);
      dOut ??= new Float32Array(api.analyser.frequencyBinCount); dIn ??= new Float32Array(api.input.frequencyBinCount);
      api.analyser.getFloatFrequencyData(dOut);
      api.input.getFloatFrequencyData(dIn);
      const fs = api.ctx.sampleRate, kdb = 20 * Math.log10(api.fullScale());
      const line = (d, n, color, width, offset, dash) => {
        g.beginPath(); g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash);
        let started = false;
        for (let i = 1; i < d.length; i++) {
          const f = (i * fs) / n;
          if (f < 30 || f > 20000) continue;
          const Y = Math.max(box.t, Math.min(box.b, y(d[i] + offset)));
          if (!started) { g.moveTo(x(f), Y); started = true; } else g.lineTo(x(f), Y);
        }
        g.stroke(); g.setLineDash([]);
      };
      line(dIn, api.input.fftSize, css('--ink-2'), 1, 0, [4, 3]);
      line(dOut, api.analyser.fftSize, css('--accent'), 1.5, kdb, []);
    });
  },
};

createPedal({ PEDAL, worklet: new URL('./preamp-worklet.js', import.meta.url), views: [tubeView, toneView, scopeView, spectrumView] });
