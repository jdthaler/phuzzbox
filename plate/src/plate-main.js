// plate-main.js — the Plate Reverb's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, animate, markNote } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { slowMotion } from '../../shared/motion.js';
import { PEDAL } from './plate-pedal.js';
import { plateModes, plateBank, LX, LY, GX, GY } from './plate-motion.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ losses, for the views
const N = 160, FMIN = 20, FMAX = 10000;
const FREQS = Float64Array.from({ length: N }, (_, i) => FMIN * (FMAX / FMIN) ** (i / (N - 1)));

// the losses at each frequency: the steel's thermoelastic and radiation rates, the damper's, the T60
function decayCurves(P) {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length + 5 * N).set([...v, ...FREQS]);
  model.plate_decay(s.at, N);
  const o = Array.from(s.f64(4 * N, 8 * (v.length + N)));
  return { th: o.slice(0, N), rad: o.slice(N, 2 * N), damper: o.slice(2 * N, 3 * N), t60: o.slice(3 * N) };
}

// The decay: how long each frequency rings, and what takes it away.
const decayView = {
  title: 'The decay',
  caption: 'how long each frequency rings before it has died by 60 dB (orange), against the steel alone without the damper (dashed): its thermoelastic loss, heat flowing across the plate as it bends, rises up to about 1 kHz and then holds; its radiation into the air rises slowly. The damper takes the same from every frequency, so the low notes, which the steel keeps longest, are what the Decay knob sets. Above the grey line no modes are played. The green line is the note you are playing.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let C = null;
    const compute = () => {
      C = decayCurves(api.P);
      const at = (f) => C.t60[FREQS.findIndex((q) => q >= f)];
      legend.innerHTML = `<span style="color:var(--accent)">● 100 Hz rings ${at(100).toFixed(1)} s</span><span>1 kHz ${at(1000).toFixed(1)} s</span><span>4 kHz ${at(4000).toFixed(1)} s</span>`;
    };
    api.on('params', compute);
    animate(canvas, () => {
      if (!C) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const steel = C.th.map((t, i) => (3 * Math.log(10)) / (t + C.rad[i]));
      const tmax = Math.min(12, Math.max(4, ...C.t60) * 1.15);
      const box = { l: 36, r: w - 10, t: 10, b: h - 22 };
      const x = (f) => box.l + ((box.r - box.l) * Math.log(f / FMIN)) / Math.log(FMAX / FMIN);
      const y = (t) => box.b - ((box.b - box.t) * Math.min(t, tmax)) / tmax;
      g.strokeStyle = css('--grid'); g.fillStyle = css('--ink-2'); g.lineWidth = 1;
      g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
      for (const f of [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
        g.beginPath(); g.moveTo(x(f), box.t); g.lineTo(x(f), box.b); g.stroke();
        if (w > 320 || [100, 1000, 10000].includes(f)) g.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x(f), h - 6);
      }
      g.textAlign = 'right';
      const step = tmax > 8 ? 2 : 1;
      for (let t = 0; t <= tmax; t += step) { g.beginPath(); g.moveTo(box.l, y(t)); g.lineTo(box.r, y(t)); g.stroke(); g.fillText(`${t} s`, box.l - 4, y(t) + 4); }
      const top = x(api.P.top);
      g.fillStyle = css('--grid'); g.globalAlpha = 0.5; g.fillRect(top, box.t, box.r - top, box.b - box.t); g.globalAlpha = 1;
      const line = (v, color, width, dash = []) => {
        g.beginPath(); g.setLineDash(dash); g.strokeStyle = color; g.lineWidth = width;
        v.forEach((t, i) => (i ? g.lineTo(x(FREQS[i]), y(t)) : g.moveTo(x(FREQS[i]), y(t))));
        g.stroke(); g.setLineDash([]);
      };
      line(steel, css('--ink-2'), 1.5, [5, 4]);
      line(C.t60, css('--accent'), 2.5);
      g.fillStyle = css('--ink-2'); g.textAlign = 'left';
      if (y(steel[N - 1]) > box.t + 14) g.fillText('the steel alone', x(1200), Math.max(box.t + 12, y(steel[FREQS.findIndex((f) => f >= 1200)]) - 6));
      markNote(g, x, box, api.note);
    });
    compute();
  },
};

// The plate, in slow motion: a note into the driver, the bending waves spreading from it across the
// plate and back off its edges, from every mode the engine plays; the driver and the pickups can
// be dragged.
const WHERE = [['driveX', 'driveY', 'the driver'], ['leftX', 'leftY', 'the left pickup'], ['rightX', 'rightY', 'the right pickup']];
const plateView = {
  title: 'The plate',
  caption: 'the plate from above, slowed down: the note you played last (or a test bass note, until you play) sent into the driver (orange) from rest, as every one of the engine\'s modes carries it: red where the plate is moving up, blue where down. Watch the ripples spread from the driver, the short, high ones fastest (a bending wave\'s speed rises with its frequency), reach the pickups (white) and come back off the edges, until the plate is a shimmer of thousands of modes. Drag the driver or a pickup to move it: on a mode\'s nodal line it neither plays nor hears that mode. Only the first 0.13 s of a note you play is caught (the input\'s analyser holds no more); the plate rings on from there.',
  perform: true,
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    canvas.style.touchAction = 'none';
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const m = slowMotion(holder, api, { seconds: 0.2 });
    const img = document.createElement('canvas');
    img.width = GX; img.height = GY;
    const ig = img.getContext('2d'), data = ig.createImageData(GX, GY), field = new Float64Array(GX * GY);
    let plate = null, bank = null, key = '', where = '', scale = 0, timer = 0, shown = 0, rect = null;
    const build = () => {
      const k = `${api.P.top},${api.P.decay},${m.fs}`;
      if (k !== key) { key = k; plate = plateModes(model, Effect, api.P); bank = plateBank(plate, m.fs, api.P); where = ''; }
      const w = WHERE.map(([x, y]) => `${api.P[x]},${api.P[y]}`).join();
      if (w !== where) { where = w; bank.place(api.P); }
    };
    m.on(() => { build(); bank.bank.reset(); scale = 0; });
    api.on('params', () => { clearTimeout(timer); timer = setTimeout(build, 100); });
    // dragging the driver and the pickups
    let drag = null;
    const toPlate = (e) => { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left - rect.ox) / rect.pw) * LX, (1 - (e.clientY - r.top - rect.oy) / rect.ph) * LY]; };
    canvas.addEventListener('pointerdown', (e) => {
      if (!rect) return;
      const [x, y] = toPlate(e), near = WHERE.map(([ix, iy], i) => [i, Math.hypot((x - api.P[ix]) * rect.pw / LX, (y - api.P[iy]) * rect.ph / LY)]).sort((a, b) => a[1] - b[1])[0];
      if (near[1] > 18) return;
      drag = near[0]; canvas.setPointerCapture(e.pointerId); e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (drag === null) { if (rect) { const [x, y] = toPlate(e); canvas.style.cursor = WHERE.some(([ix, iy]) => Math.hypot((x - api.P[ix]) * rect.pw / LX, (y - api.P[iy]) * rect.ph / LY) < 18) ? 'grab' : ''; } return; }
      const [x, y] = toPlate(e), [ix, iy] = WHERE[drag];
      const clamp = (v, lo, hi) => Math.round(1000 * Math.max(lo, Math.min(hi, v))) / 1000;
      api.page.setAll({ [ix]: clamp(x, 0.02, LX - 0.02), [iy]: clamp(y, 0.02, LY - 0.02) });
    });
    const end = () => { drag = null; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    animate(canvas, () => {
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      // the plate, 2:1, as large as fits above the clock
      const pw = Math.min(w - 16, 2 * (h - 30)), ph = pw / 2, ox = (w - pw) / 2, oy = Math.max(4, (h - 22 - ph) / 2);
      rect = { pw, ph, ox, oy };
      g.fillStyle = css('--grid'); g.globalAlpha = 0.35; g.fillRect(ox, oy, pw, ph); g.globalAlpha = 1;
      if (bank && m.signal) {
        bank.bank.seek(Math.round(m.t() * m.fs), m.signal, 1500);
        bank.field(field);
        let big = 0;
        for (const v of field) big = Math.max(big, Math.abs(v));
        scale = Math.max(big, scale * 0.995, 1e-15);
        for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) {
          const v = Math.max(-1, Math.min(1, field[y * GX + x] / scale)), q = Math.abs(v) ** 0.7, k = 4 * ((GY - 1 - y) * GX + x);
          const [r, gg, b] = v > 0 ? [239, 68, 68] : [96, 165, 250];
          data.data[k] = r; data.data[k + 1] = gg; data.data[k + 2] = b; data.data[k + 3] = Math.round(255 * q);
        }
        ig.putImageData(data, 0, 0);
        g.imageSmoothingEnabled = true;
        g.drawImage(img, ox, oy, pw, ph);
      }
      g.strokeStyle = css('--ink-2'); g.lineWidth = 1.5; g.strokeRect(ox, oy, pw, ph);
      WHERE.forEach(([ix, iy], i) => {
        g.beginPath(); g.arc(ox + (pw * api.P[ix]) / LX, oy + ph - (ph * api.P[iy]) / LY, drag === i ? 7 : 5, 0, 2 * Math.PI);
        g.fillStyle = i ? '#f5f5f5' : css('--accent'); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke();
      });
      g.fillStyle = css('--ink-2'); g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText(m.label(), w / 2, h - 6);
      if (plate && ++shown % 20 === 1) legend.innerHTML = `<span>${plate.modes.length} modes</span>` + WHERE.map(([ix, iy, name], i) => `<span${i ? '' : ' style="color:var(--accent)"'}>${name} at ${api.P[ix].toFixed(2)}, ${api.P[iy].toFixed(2)} m</span>`).join('');
    });
  },
};

const PLATE_SCOPE = 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. The plate\'s sound starts a few milliseconds after the note, the highs first, and goes on long after it.';
const PLATE_SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts: the plate adds its modes around each harmonic of the note, densely, and nothing above Modes up to. The green line is the note you are playing, and the ticks its harmonics.';

createPedal({ PEDAL, worklet: new URL('./plate-worklet.js', import.meta.url), views: [plateView, decayView, spectrumView({ caption: PLATE_SPECTRUM }), scopeView({ caption: PLATE_SCOPE })] });
