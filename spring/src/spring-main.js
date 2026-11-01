// spring-main.js — the Spring Reverb's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, animate } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './spring-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ tank, for the views
const FRAMES = 96, BINS = 64, SECS = 0.3, HOP = Math.round((SECS * 48000) / FRAMES), FLO = 100, FHI = 8000, RANGE = 50;
const binF = (b) => FLO * (FHI / FLO) ** (b / (BINS - 1));

// the tank's springs (spring-web.cpp): L, R, r, T_D, F_C, c₀, f_b and modes for each
function info(P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  model.spring_info(s.at);
  const o = Array.from(s.f64(26, 8 * v.length)), springs = [];
  for (let k = 0; k < o[0]; k++) { const q = o.slice(1 + 8 * k, 9 + 8 * k); springs.push({ L: q[0], TD: q[3], Fc: q[4], fb: q[6], modes: q[7] }); }
  return { springs, bank: o[25] };
}
// what the pickup hears after a click, frame by frame (dB, FRAMES × BINS)
function echoes(P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  model.spring_echoes(s.at, FRAMES, BINS, HOP);
  return Float64Array.from(s.f64(FRAMES * BINS, 8 * v.length));
}
// spring k's crossing times L/c_g at the bins' frequencies: on the slow branch (0 above F_C) and the bending one
function delays(P, k) {
  const v = Effect.native(P), s = scratch(model), F = Array.from({ length: BINS }, (_, b) => binF(b));
  s.f64(v.length + 1 + BINS).set([...v, k, ...F]);
  model.spring_delays(s.at, BINS);
  const o = s.f64(2 * BINS, 8 * (v.length + 1 + BINS));
  return { slow: Array.from(o.subarray(0, BINS)), bend: Array.from(o.subarray(BINS)) };
}

// a dark-to-bright palette for the spectrogram: from the card's background through the accent to white
function palette() {
  const hex = (c) => { const m = c.match(/^#?([0-9a-f]{6})$/i); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null; };
  const bg = hex(css('--panel')) ?? [24, 24, 28], acc = hex(css('--accent')) ?? [240, 140, 60], top = [255, 246, 220];
  return (u) => {
    const [a, b, t] = u < 0.65 ? [bg, acc, u / 0.65] : [acc, top, (u - 0.65) / 0.35];
    return a.map((x, i) => Math.round(x + (b[i] - x) * t));
  };
}

// The echoes: a click into the tank, as the pickup bead hears it, against time and frequency.
const echoesView = {
  title: 'The echoes',
  caption: `what the pickup hears for ${SECS * 1000} ms after a click into the tank, as set: brighter is louder, against time across and frequency up. Each echo is a rising chirp, the low frequencies first and those near the transition frequency F_C later and later; the dotted blue lines are the first spring's arrival times, (2j + 1)·L/c_g(f), from its dispersion. Faint falling chirps above F_C (the white line) are its bending waves, which travel faster the higher they are (dotted green).`,
  mount(holder, api) {
    holder.classList.add('echoes');
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const img = document.createElement('canvas');
    img.width = FRAMES; img.height = BINS;
    let tank = null, lines = null, key = '', timer = 0;
    const paint = (dbs) => {
      const g = img.getContext('2d'), data = g.createImageData(FRAMES, BINS), top = Math.max(...dbs), col = palette();
      for (let t = 0; t < FRAMES; t++) for (let b = 0; b < BINS; b++) {
        const u = Math.max(0, Math.min(1, 1 + (dbs[t * BINS + b] - top) / RANGE)), c = col(u), o = 4 * ((BINS - 1 - b) * FRAMES + t);
        data.data[o] = c[0]; data.data[o + 1] = c[1]; data.data[o + 2] = c[2]; data.data[o + 3] = 255;
      }
      g.putImageData(data, 0, 0);
    };
    const compute = () => {
      const k = Object.entries(api.P).filter(([id]) => !['dry', 'reverb', 'level'].includes(id)).join();
      if (k === key) return;
      key = k;
      tank = info(api.P);
      lines = delays(api.P, 0);
      paint(echoes(api.P));
      legend.innerHTML = tank.springs.map((s, i) => `<span>spring ${i + 1}: ${s.L.toFixed(2)} m of wire, T_D ${(1e3 * s.TD).toFixed(1)} ms, F_C ${(s.Fc / 1000).toFixed(2)} kHz</span>`).join('') + `<span>${tank.bank} modes</span>`;
    };
    api.on('params', () => { clearTimeout(timer); timer = setTimeout(compute, 120); });
    animate(canvas, () => {
      if (!tank) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const box = { l: 40, r: w - 8, t: 8, b: h - 22 };
      g.imageSmoothingEnabled = true;
      g.drawImage(img, box.l, box.t, box.r - box.l, box.b - box.t);
      const X = (t) => box.l + ((box.r - box.l) * t) / SECS, Y = (b) => box.b - ((box.b - box.t) * b) / (BINS - 1);
      const Yf = (f) => Y(((BINS - 1) * Math.log(f / FLO)) / Math.log(FHI / FLO));
      // the arrival times
      g.setLineDash([3, 3]); g.lineWidth = 1.5;
      for (const [ts, color] of [[lines.slow, css('--accent-2')], [lines.bend, css('--good')]]) {
        g.strokeStyle = color;
        for (let j = 0; j < 4; j++) {
          g.beginPath();
          let on = false;
          ts.forEach((tau, b) => {
            const t = (2 * j + 1) * tau;
            if (!tau || t > SECS) { on = false; return; }
            if (on) g.lineTo(X(t), Y(b)); else { g.moveTo(X(t), Y(b)); on = true; }
          });
          g.stroke();
        }
      }
      g.setLineDash([]);
      // F_C of the first spring, and the axes
      const fc = tank.springs[0].Fc;
      g.strokeStyle = css('--ink'); g.lineWidth = 1;
      g.beginPath(); g.moveTo(box.l, Yf(fc)); g.lineTo(box.r, Yf(fc)); g.stroke();
      g.fillStyle = css('--ink-2'); g.font = '11px system-ui, sans-serif'; g.textAlign = 'right';
      for (const f of [100, 300, 1000, 3000, 8000]) g.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, box.l - 5, Yf(f) + 4);
      g.textAlign = 'left'; g.fillStyle = css('--ink'); g.fillText('F_C', box.l + 4, Yf(fc) - 4);
      g.fillStyle = css('--ink-2'); g.textAlign = 'center';
      for (let t = 0; t <= SECS + 1e-9; t += 0.05) g.fillText(t ? `${Math.round(t * 1000)} ms` : '0', X(t), h - 6);
    });
    compute();
  },
};

const SPRING_SCOPE = 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. After a note stops, the output keeps going: the echoes coming back from the far bead, every 40 to 53 ms in the three-spring tank, each smeared into a chirp.';
const SPRING_SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts. The tank\'s thousands of modes, each a resonance a few hertz apart, make the reverb\'s fine comb on top of the note; the beads\' inertia takes the very top off. The green line is the note you are playing, and the ticks its harmonics.';

createPedal({ PEDAL, worklet: new URL('./spring-worklet.js', import.meta.url), views: [echoesView, spectrumView({ caption: SPRING_SPECTRUM }), scopeView({ caption: SPRING_SCOPE })] });
