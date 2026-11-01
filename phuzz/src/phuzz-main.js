// phuzz-main.js — the Phuzz's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, freqAxes, animate, markNote } from '../../shared/plot.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './phuzz-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ model, for the views
const R1 = 33e3, R2 = 470, FUZZ = 1e3; // the schematic's (native/pedals/phuzz/phuzz-model.h)

// the DC operating point: node voltages, transistor currents and junctions (phuzz-web.cpp)
function operatingPoint(P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  model.phuzz_operating_point(s.at);
  const r = Array.from(s.f64(18));
  const [, B, K1, E2, , K2, , S] = r;
  return { B, K1, E2, K2, S, ic1: r[10], ib1: r[11], ic2: r[12], ib2: r[13], vec1: -K1, vec2: E2 - K2 }; // V_EC: a PNP's emitter sits above its collector
}
// a transistor's output characteristics: I_C at each |V_CE| for each base current
function characteristics(P, which, vce, ibs) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  s.f64(vce.length + ibs.length, 8 * v.length).set([...vce, ...ibs]);
  model.phuzz_characteristics(s.at, which, vce.length, ibs.length);
  const out = s.f64(vce.length * ibs.length, 8 * (v.length + vce.length + ibs.length));
  return ibs.map((_, b) => Array.from(out.slice(b * vce.length, (b + 1) * vce.length)));
}
const mA = (a) => `${(a * 1e3).toFixed(2)} mA`, V = (x) => `${x.toFixed(2).replace('-', '−')} V`;

// The transistors: each one's output characteristics (I_C against V_EC at a few base currents),
// its DC load line, the operating point the battery sets, and where it goes as you play.
const transistorView = {
  title: 'The transistors',
  caption: 'each transistor\'s collector current against the voltage across it, at a few base currents (thin), with the line its resistors allow (dashed) and the operating point (ring). Play, and the trail shows each one swinging into the axes, saturated and cut off: that is the fuzz.',
  mount(holder, api) {
    holder.classList.add('transistors');
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const trail = [[], []], KEEP = 240;
    let curves, op, P;
    const update = () => {
      P = api.P;
      op = operatingPoint(P);
      const vmax = P.battery, vs = Array.from({ length: 60 }, (_, i) => (vmax * (i + 0.5)) / 60);
      curves = [0, 1].map((k) => {
        const ib = k ? op.ib2 : op.ib1;
        const ibs = [0, 0.5, 1, 1.5, 2].map((m) => m * ib);
        return { vs, ibs, ic: characteristics(P, k, vs, ibs) };
      });
      legend.innerHTML = `<span>Q1: ${V(op.vec1)} across it, ${mA(op.ic1)}</span><span>Q2: collector at ${V(op.K2)}, ${mA(op.ic2)}</span><span>rail ${V(op.S)}</span><span>half the battery would be ${V(-P.battery / 2)}</span>`;
      draw();
    };
    const draw = () => {
      if (!op) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const stacked = h > 0.6 * w, pw = stacked ? w : w / 2, ph = stacked ? h / 2 : h;
      [0, 1].forEach((k) => {
        const ox = stacked ? 0 : k * pw, oy = stacked ? k * ph : 0;
        const box = { l: ox + 46, r: ox + pw - 10, t: oy + 16, b: oy + ph - 32 };
        const c = curves[k], imax = 1.25 * Math.max(...c.ic[c.ic.length - 1], k ? op.ic2 : op.ic1) || 1e-3;
        const X = (v) => box.l + ((box.r - box.l) * v) / P.battery;
        const Y = (i) => box.b - ((box.b - box.t) * Math.min(i, imax)) / imax;
        g.strokeStyle = css('--grid'); g.fillStyle = css('--ink-2'); g.lineWidth = 1; g.font = '11px system-ui, sans-serif';
        g.strokeRect(box.l, box.t, box.r - box.l, box.b - box.t);
        g.textAlign = 'left'; g.fillText(k ? 'Q2' : 'Q1', box.l + 6, box.t + 13);
        g.textAlign = 'center'; g.fillText('V_EC (V)', (box.l + box.r) / 2, box.b + 26);
        for (let v = 0; v <= P.battery; v += 2) { g.fillText(String(v), X(v), box.b + 11); }
        g.textAlign = 'right'; g.fillText(mA(imax).replace(' mA', ''), box.l - 4, box.t + 8); g.fillText('0', box.l - 4, box.b);
        g.save(); g.translate(ox + 10, (box.t + box.b) / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText('I_C (mA)', 0, 0); g.restore();
        // the characteristics
        g.strokeStyle = css('--ink-2'); g.lineWidth = 1;
        for (const ic of c.ic) { g.beginPath(); ic.forEach((i, j) => (j ? g.lineTo(X(c.vs[j]), Y(i)) : g.moveTo(X(c.vs[j]), Y(i)))); g.stroke(); }
        // the DC load line: Q1's collector through R1 to the rail; Q2's through R3, R2 and the
        // battery's own resistance, its emitter through the Fuzz pot (base currents neglected)
        const rLoad = k ? P.bias + R2 + P.battR + FUZZ : R1 + P.battR;
        g.strokeStyle = css('--accent-2'); g.setLineDash([5, 4]); g.beginPath(); g.moveTo(X(P.battery), Y(0)); g.lineTo(X(0), Y(P.battery / rLoad)); g.stroke(); g.setLineDash([]);
        // the trail and the operating point
        const t = trail[k];
        g.fillStyle = css('--accent');
        t.forEach(([v, i], j) => { g.globalAlpha = 0.15 + (0.85 * j) / t.length; g.fillRect(X(v) - 1.5, Y(i) - 1.5, 3, 3); });
        g.globalAlpha = 1;
        const qv = k ? op.vec2 : op.vec1, qi = k ? op.ic2 : op.ic1;
        g.strokeStyle = css('--accent'); g.lineWidth = 2; g.beginPath(); g.arc(X(qv), Y(qi), 5, 0, 2 * Math.PI); g.stroke();
      });
    };
    api.on('params', update);
    api.on('pedal', (messages) => {
      for (const m of messages) {
        if (m.type !== 1) continue;
        for (let j = 0; j < 7; j++) {
          trail[0].push([-m.values[4 * j], m.values[4 * j + 1]]);
          trail[1].push([-m.values[4 * j + 2], m.values[4 * j + 3]]);
        }
      }
      for (const t of trail) if (t.length > KEEP) t.splice(0, t.length - KEEP);
    });
    animate(canvas, draw);
    new ResizeObserver(draw).observe(canvas);
    update();
  },
};

// A scope: the input and the output, in volts, lined up on the output's rising edges.
const scopeView = {
  title: 'Scope',
  caption: 'the voltage at the input (dashed) and the output (solid) as you play: the bass comes out squared off, clipped on both sides, each top sagging as the 10 nF output capacitor charges through the volume pot.',
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
      // both buffers end at the same instant; trigger on the output's last rising zero crossing
      // that leaves a window's worth after it
      const off = b.length - a.length;
      let start = a.length - span - 1;
      for (let i = a.length - span - 1; i > 1; i--) if (a[i - 1] < 0 && a[i] >= 0) { start = i; break; }
      let m = 1e-4;
      for (let i = 0; i < span; i++) m = Math.max(m, Math.abs(k * a[start + i]), Math.abs(b[off + start + i]));
      const X = (i) => box.l + ((box.r - box.l) * i) / span, Y = (v) => (box.t + box.b) / 2 - ((box.b - box.t) / 2) * (v / m) * 0.95;
      g.textAlign = 'left';
      g.fillText(`±${(m * 1000).toFixed(0)} mV`, box.l + 4, box.t + 8);
      g.textAlign = 'center'; g.fillText('50 ms', (box.l + box.r) / 2, h - 5);
      g.strokeStyle = css('--ink-2'); g.lineWidth = 1.2; g.setLineDash([4, 3]); g.beginPath();
      for (let i = 0; i < span; i++) { const y = Y(b[off + start + i]); i ? g.lineTo(X(i), y) : g.moveTo(X(i), y); }
      g.stroke(); g.setLineDash([]);
      g.strokeStyle = css('--accent'); g.lineWidth = 2; g.beginPath();
      for (let i = 0; i < span; i++) { const y = Y(k * a[start + i]); i ? g.lineTo(X(i), y) : g.moveTo(X(i), y); }
      g.stroke();
    });
  },
};

// The spectra of the input and the output: the harmonics the transistors add.
const spectrumView = {
  title: 'Spectrum',
  caption: 'what goes in (dashed) and what comes out (solid), in dB of volts: the clipping puts harmonics all the way up, odd and even, since the two sides clip unevenly. The green line is the note you are playing, as the tuner hears it at the input, and the ticks along the top its harmonics.',
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

createPedal({ PEDAL, worklet: new URL('./phuzz-worklet.js', import.meta.url), views: [transistorView, scopeView, spectrumView] });
