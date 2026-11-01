// plate-main.js — the Plate Reverb's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, animate, markNote } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './plate-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ losses, for the views
const N = 160, FMIN = 20, FMAX = 10000;
const FREQS = Float64Array.from({ length: N }, (_, i) => FMIN * (FMAX / FMIN) ** (i / (N - 1)));
const LX = 2, LY = 1, DRIVE = [0.8, 0.415], PICKS = [[0.2, 0.45], [1.7, 0.45]];

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

// The plate: the fifteen modes moving most, summed into the plate's shape, from above.
const plateView = {
  title: 'The plate',
  caption: 'the plate from above, as the fifteen of its modes moving most at this moment shape it: red where it is moving up, blue where down (the other thousands of modes, each moving less, are left out of the picture but not of the sound). The orange dot is the driver; the white ones are the two pickups. A low note moves a few broad modes; a high one many fine ones.',
  perform: true,
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const GX = 96, GY = 48, img = document.createElement('canvas');
    img.width = GX; img.height = GY;
    const ig = img.getContext('2d'), data = ig.createImageData(GX, GY);
    let modes = [], scale = 1e-12, shown = 0;
    api.on('pedal', (messages) => {
      for (const m of messages) if (m.type === 1) {
        modes = [];
        for (let j = 0; j + 1 < m.values.length; j += 2) modes.push({ m: m.values[j] % 1000, n: Math.floor(m.values[j] / 1000), a: m.values[j + 1] });
      }
    });
    const sx = new Float32Array(GX), sy = new Float32Array(GY), field = new Float32Array(GX * GY);
    animate(canvas, () => {
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      field.fill(0);
      let big = 0;
      for (const { m, n, a } of modes) {
        for (let i = 0; i < GX; i++) sx[i] = Math.sin((m * Math.PI * (i + 0.5)) / GX);
        for (let j = 0; j < GY; j++) sy[j] = a * Math.sin((n * Math.PI * (j + 0.5)) / GY);
        for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) field[j * GX + i] += sx[i] * sy[j];
      }
      for (const v of field) big = Math.max(big, Math.abs(v));
      scale = Math.max(big, scale * 0.97, 1e-12);
      for (let k = 0; k < field.length; k++) {
        const v = Math.max(-1, Math.min(1, field[k] / scale)), q = Math.abs(v) ** 0.7;
        const [r, gg, b] = v > 0 ? [239, 68, 68] : [96, 165, 250];
        data.data[4 * k] = r; data.data[4 * k + 1] = gg; data.data[4 * k + 2] = b; data.data[4 * k + 3] = Math.round(255 * q);
      }
      ig.putImageData(data, 0, 0);
      // the plate, 2:1, as large as fits
      const pw = Math.min(w - 16, 2 * (h - 12)), ph = pw / 2, ox = (w - pw) / 2, oy = (h - ph) / 2;
      g.fillStyle = css('--grid'); g.globalAlpha = 0.35; g.fillRect(ox, oy, pw, ph); g.globalAlpha = 1;
      g.imageSmoothingEnabled = true;
      g.drawImage(img, ox, oy, pw, ph);
      g.strokeStyle = css('--ink-2'); g.lineWidth = 1.5; g.strokeRect(ox, oy, pw, ph);
      const dot = ([px, py], color) => { g.beginPath(); g.arc(ox + (pw * px) / LX, oy + (ph * py) / LY, 5, 0, 2 * Math.PI); g.fillStyle = color; g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke(); };
      dot(DRIVE, css('--accent')); for (const p of PICKS) dot(p, '#f5f5f5');
      if (++shown % 15 === 0) {
        const f = (mm, nn) => (0.7637 * ((mm * Math.PI / LX) ** 2 + (nn * Math.PI / LY) ** 2)) / (2 * Math.PI);
        const lead = modes.reduce((b, q) => (!b || Math.abs(q.a) > Math.abs(b.a) ? q : b), null);
        legend.innerHTML = lead && big > 0 ? `<span style="color:var(--accent)">● moving most: mode (${lead.m}, ${lead.n}) at ${f(lead.m, lead.n).toFixed(1)} Hz</span>` : '<span>the plate is still</span>';
      }
    });
  },
};

const PLATE_SCOPE = 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. The plate\'s sound starts a few milliseconds after the note, the highs first, and goes on long after it.';
const PLATE_SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts: the plate adds its modes around each harmonic of the note, densely, and nothing above Modes up to. The green line is the note you are playing, and the ticks its harmonics.';

createPedal({ PEDAL, worklet: new URL('./plate-worklet.js', import.meta.url), views: [plateView, decayView, spectrumView({ caption: PLATE_SPECTRUM }), scopeView({ caption: PLATE_SCOPE })] });
