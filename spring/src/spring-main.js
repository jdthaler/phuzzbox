// spring-main.js — the Spring Reverb's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, animate } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { slowMotion, Bank } from '../../shared/motion.js';
import { PEDAL } from './spring-pedal.js';
import { tankModes, springBank, POINTS } from './spring-motion.js';

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

// The springs, in slow motion: a note into the drive bead, the twist running along every spring to
// the pickup bead and back, smearing into a chirp, from the engine's own modes.
const springsView = {
  title: 'The springs',
  perform: true,
  caption: 'the tank\'s springs, from the drive bead (left) to the pickup bead (right), slowed down: the note you played last (or a test bass note, until you play), sent into the drive coil from rest, as the engine\'s own modes carry it. The coils bunch where the wire is turning fastest, and the line above each spring is how fast its wire turns along it. Watch the low frequencies run ahead and the highs crawl behind them, each crossing L/c_g(f) long, then reflect at the beads and come back: the drip. Only the first 0.13 s of a note you play is caught (the input\'s analyser holds no more); the tank rings on from there.',
  mount(holder, api) {
    holder.classList.add('springs');
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const m = slowMotion(holder, api, { seconds: 0.25 });
    let tank = null, bank = null, key = '', scale = 0, timer = 0, shown = 0;
    const build = () => {
      const k = Object.entries(api.P).filter(([id]) => !['dry', 'reverb', 'level'].includes(id)).join() + m.fs;
      if (k !== key) {
        key = k;
        tank = tankModes(model, Effect, api.P);
        bank = springBank(tank, m.fs);
      }
      bank.bank.reset(); scale = 0;
    };
    m.on(() => build());
    api.on('params', () => { clearTimeout(timer); timer = setTimeout(build, 120); });
    const field = new Float64Array(POINTS);
    animate(canvas, () => {
      if (!bank || !m.signal) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      bank.bank.seek(Math.round(m.t() * m.fs), m.signal, 4000);
      const S = tank.count, lane = (h - 18) / S, x0 = 34, x1 = w - 34, roomy = lane > 56;
      // every spring's field first, for one scale over them all
      const fields = [];
      for (let k = 0; k < S; k++) { bank.field(k, field); fields.push(Float64Array.from(field)); }
      let big = 0;
      for (const f of fields) for (const v of f) big = Math.max(big, Math.abs(v));
      scale = Math.max(big, scale * 0.98, 1e-12);
      const at = (f, u) => { const p = u * (POINTS - 1), i = Math.min(POINTS - 2, Math.floor(p)), r = p - i; return f[i] + (f[i + 1] - f[i]) * r; };
      g.lineWidth = 1; g.font = '11px system-ui, sans-serif';
      for (let k = 0; k < S; k++) {
        const f = fields[k], yc = 2 + lane * (k + (roomy ? 0.6 : 0.64)), amp = Math.min(lane * 0.17, 14), wave = lane * (roomy ? 0.26 : 0.3);
        const loops = Math.max(24, Math.round((x1 - x0) / 9));
        // the wave: how fast the wire turns, along it
        g.strokeStyle = css('--accent'); g.lineWidth = 1.5; g.beginPath();
        for (let i = 0; i <= 200; i++) { const u = i / 200, X = x0 + (x1 - x0) * u, Y = yc - amp - 3 - wave * 0.9 * (at(f, u) / scale); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }
        g.stroke();
        // the coil: each loop's phase moved by the turning, so the loops bunch where it is fastest
        g.strokeStyle = css('--ink-2'); g.lineWidth = 1.2; g.beginPath();
        const n = loops * 10;
        for (let i = 0; i <= n; i++) {
          const u = i / n, ph = 2 * Math.PI * loops * u + 3 * (at(f, u) / scale);
          const X = x0 + (x1 - x0) * u + 3 * Math.cos(ph), Y = yc + amp * Math.sin(ph);
          i ? g.lineTo(X, Y) : g.moveTo(X, Y);
        }
        g.stroke();
        // the beads
        for (const [X, side] of [[x0, 0], [x1, 1]]) {
          const v = Math.abs(at(f, side)) / scale;
          g.fillStyle = css('--accent'); g.globalAlpha = 0.25 + 0.75 * Math.min(1, v);
          g.fillRect(X - 6, yc - amp - 2, 12, 2 * amp + 4); g.globalAlpha = 1;
        }
        if (roomy) { g.fillStyle = css('--ink-2'); g.textAlign = 'left'; g.fillText(`${(tank.springs[k].L).toFixed(2)} m of wire`, x0 + 10, yc + amp + 13); }
      }
      g.fillStyle = css('--ink-2'); g.textAlign = 'left'; g.fillText('drive', 4, h - 6);
      g.textAlign = 'right'; g.fillText('pickup', w - 4, h - 6);
      g.textAlign = 'center'; g.fillText(m.label(), w / 2, h - 6);
      if (++shown % 20 === 1) legend.innerHTML = tank.springs.slice(0, S).map((sp, i) => `<span>spring ${i + 1}: across in ${(500 * sp.TD).toFixed(1)} ms, low notes first</span>`).join('');
    });
  },
};

const SPRING_SCOPE = 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. After a note stops, the output keeps going: the echoes coming back from the far bead, every 40 to 53 ms in the three-spring tank, each smeared into a chirp.';
const SPRING_SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts. The tank\'s thousands of modes, each a resonance a few hertz apart, make the reverb\'s fine comb on top of the note; the beads\' inertia takes the very top off. The green line is the note you are playing, and the ticks its harmonics.';

createPedal({ PEDAL, worklet: new URL('./spring-worklet.js', import.meta.url), views: [springsView, echoesView, spectrumView({ caption: SPRING_SPECTRUM }), scopeView({ caption: SPRING_SCOPE })] });
