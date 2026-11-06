// lampvibe-main.js — the Lamp Vibe's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, animate, markNote } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './lampvibe-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ model, for the views

const call = (P, fn, extra = []) => {
  const v = P ? Effect.native(P) : [], s = scratch(model);
  if (v.length) s.f64(v.length).set(v);
  if (extra.length) s.f64(extra.length, 8 * v.length).set(extra);
  fn(s.at);
  return { s, n: v.length, at: (k, off) => Array.from(s.f64(k, 8 * off)) };
};
function parts(P) {
  const { s } = call(P, (at) => model.lampvibe_parts(at));
  const r = Array.from(s.f64(20));
  return { V: r[0], I: r[1], T: r[2], d: r[3], L: r[4], A: r[5], C: r[6], Rcold: r[7], rlit: r[8], rdark: r[9], tau: r[10], caps: r.slice(11, 15), speed: r[15], depth: r[16], vibrato: !!r[17], gain: r[18] };
}
function spectrum(T, lambdas) {
  const r = call(null, (at) => model.lampvibe_spectrum(at, lambdas.length), [T, ...lambdas]), n = lambdas.length;
  return { B: r.at(n, 1 + n), S: r.at(n, 1 + 2 * n) };
}
function response(P, R, freqs) {
  const r = call(P, (at) => model.lampvibe_response(at, freqs.length), [R, ...freqs]), n = freqs.length;
  return { gain: r.at(n, r.n + 1 + n), phase: r.at(n, r.n + 1 + 2 * n) };
}

// a glowing body's colour at T, for the drawing only (Helland's fit to the colour of a black body)
function glowColour(T) {
  const t = T / 100;
  const r = t <= 66 ? 255 : 329.7 * (t - 60) ** -0.1332;
  const g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.1 * (t - 60) ** -0.0755;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  return [r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))));
}
const rgb = ([r, g, b], a = 1) => `rgba(${r},${g},${b},${a})`;
const kOhm = (k) => (k >= 1000 ? `${(k / 1000).toFixed(1)} MΩ` : `${k.toFixed(k < 10 ? 1 : 0)} kΩ`);

// the lamp as it plays, from the engine's messages: its temperature, current, glow, the cells'
// resistance and the lamp's voltage, 120 times a second
function tracker(api) {
  const trail = [], KEEP = 300, now = { T: 2500, I: 0, glow: 1, R: 5, V: 0 };
  api.on('pedal', (messages) => {
    for (const m of messages) {
      if (m.type !== 1) continue;
      for (let j = 0; j < 5; j++) trail.push(Array.from(m.values.slice(5 * j, 5 * j + 5)));
      [now.T, now.I, now.glow, now.R, now.V] = trail.at(-1);
    }
    if (trail.length > KEEP) trail.splice(0, trail.length - KEEP);
  });
  return { trail, now };
}

// The lamp: the bulb drawn glowing at its filament's temperature, and the last two and a half
// seconds of its temperature, its voltage and the cells' resistance.
const lampView = {
  title: 'The lamp',
  caption: 'the bulb, drawn in the colour and brightness of its filament, and the last two and a half seconds: the voltage the oscillator puts across it (dashed), the filament\'s temperature (yellow) and the cells\' resistance (violet, on a log scale). The filament stores heat, so its temperature lags the voltage and swings less the faster the oscillator goes, and less for a bigger bulb. It heats quickly and cools slowly: a hot filament radiates its heat away fast, as T⁴, but a dim one only slowly, so the lamp lingers in the dark part of each cycle.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const { trail, now } = tracker(api);
    let pp;
    const update = () => {
      pp = parts(api.P);
      legend.innerHTML = `<span><i style="background:${rgb(glowColour(pp.T))}"></i>filament ${(pp.d * 1e6).toFixed(0)} µm × ${(pp.L * 1e3).toFixed(0)} mm, ${pp.T.toFixed(0)} K at ${pp.V} V</span>`
        + `<span>cold ${pp.Rcold.toFixed(1)} Ω, hot ${(pp.V / pp.I).toFixed(0)} Ω</span>`;
    };
    const draw = () => {
      if (!pp) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      // the bulb
      const bw = Math.min(110, w * 0.26), cx = 10 + bw / 2, cy = h * 0.42, r = bw * 0.38;
      const col = glowColour(now.T), a = Math.min(1, Math.max(0.04, Math.sqrt(now.glow)));
      const halo = g.createRadialGradient(cx, cy, 0, cx, cy, r * 1.8);
      halo.addColorStop(0, rgb(col, 0.9 * a)); halo.addColorStop(1, rgb(col, 0));
      g.fillStyle = halo; g.beginPath(); g.arc(cx, cy, r * 1.8, 0, 2 * Math.PI); g.fill();
      g.strokeStyle = css('--ink-2'); g.lineWidth = 1.5;
      g.beginPath(); g.arc(cx, cy, r, 0.3 * Math.PI, 2.7 * Math.PI); g.stroke();
      g.strokeRect(cx - r * 0.45, cy + r * 0.95, r * 0.9, r * 0.6);
      g.strokeStyle = rgb(col, Math.max(0.3, a)); g.lineWidth = 2; g.beginPath();
      for (let i = 0; i <= 24; i++) { const x = cx - r * 0.45 + (0.9 * r * i) / 24, y = cy + (i % 2 ? -3 : 3); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke(); g.lineWidth = 1;
      g.fillStyle = css('--ink'); g.font = '12px system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText(`${now.T.toFixed(0)} K`, cx, cy + r * 2.1);
      g.fillStyle = css('--ink-2'); g.font = '11px system-ui, sans-serif';
      g.fillText(`${now.I.toFixed(0)} mA`, cx, cy + r * 2.1 + 15);
      // the traces
      const box = { l: bw + 30, r: w - 34, t: 12, b: h - 22 };
      if (box.r - box.l < 60) return;
      g.strokeStyle = css('--grid'); g.strokeRect(box.l, box.t, box.r - box.l, box.b - box.t);
      const X = (i) => box.l + ((box.r - box.l) * i) / 299;
      const Tlo = 1000, Thi = Math.max(2600, pp.T + 100), YT = (T) => box.b - ((box.b - box.t) * (Math.max(T, Tlo) - Tlo)) / (Thi - Tlo);
      const YV = (v) => box.b - ((box.b - box.t) * v) / (pp.V * 1.05);
      const Rlo = 1, Rhi = 1e4, YR = (k) => box.b - ((box.b - box.t) * Math.log(Math.min(Math.max(k, Rlo), Rhi) / Rlo)) / Math.log(Rhi / Rlo);
      const off = 300 - trail.length;
      const line = (f, colour, dash = []) => {
        g.strokeStyle = colour; g.setLineDash(dash); g.lineWidth = 2; g.beginPath();
        trail.forEach((p, i) => (i ? g.lineTo(X(i + off), f(p)) : g.moveTo(X(i + off), f(p))));
        g.stroke(); g.setLineDash([]); g.lineWidth = 1;
      };
      line((p) => YV(p[4]), css('--ink-2'), [4, 4]);
      line((p) => YR(p[3]), '#b48cff');
      line((p) => YT(p[0]), '#ffc94a');
      g.fillStyle = '#ffc94a'; g.textAlign = 'right';
      g.fillText(`${Thi.toFixed(0)} K`, box.l - 3, box.t + 9); g.fillText(`${Tlo} K`, box.l - 3, box.b);
      g.fillStyle = '#b48cff'; g.textAlign = 'left';
      g.fillText('10 M', box.r + 3, box.t + 9); g.fillText('1 kΩ', box.r + 3, box.b);
      g.fillStyle = css('--ink-2'); g.textAlign = 'center';
      g.fillText(`cells ${kOhm(now.R)}`, (box.l + box.r) / 2, box.b + 15);
    };
    api.on('params', update);
    animate(canvas, draw);
    update();
  },
};

// The glow: a black body's spectrum at the filament's temperature now (solid) and at the lamp's
// rating (dashed), and the cells' response (shaded), on a log scale: the light the cells see is
// the overlap, and the short-wavelength side of the spectrum, where they look, swells fastest.
const LAMBDA = Float64Array.from({ length: 160 }, (_, i) => 300e-9 + (1700e-9 * i) / 159);
const glowView = {
  title: 'The glow',
  caption: 'the light a black body gives at each wavelength (Planck\'s law), at the filament\'s temperature now (solid) and at the lamp\'s rating (dashed), on a log scale; the band is what the eye sees. Most of a filament\'s light is infrared. The cadmium-sulphide cells see only a bell of wavelengths around 540 nm (shaded), on the short side of the peak, where the spectrum swells fastest as the filament warms: from 2000 K to 2500 K the light the cells see grows elevenfold, while the power the filament radiates only triples.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const { now } = tracker(api);
    let pp, rated, S;
    const update = () => {
      pp = parts(api.P);
      ({ B: rated, S } = spectrum(pp.T, Array.from(LAMBDA)));
      legend.innerHTML = `<span><i style="background:#ffc94a"></i>the filament now</span><span><i style="background:${css('--ink-2')}"></i>at its rating, ${pp.T.toFixed(0)} K</span><span><i style="background:#b48cff"></i>what the cells see</span>`;
    };
    const draw = () => {
      if (!rated) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const box = { l: 30, r: w - 10, t: 12, b: h - 24 };
      const top = Math.max(...rated) * 2, bot = top * 1e-5;
      const X = (l) => box.l + ((box.r - box.l) * (l - LAMBDA[0])) / (LAMBDA.at(-1) - LAMBDA[0]);
      const Y = (v) => box.b - ((box.b - box.t) * Math.log(Math.max(v, bot) / bot)) / Math.log(top / bot);
      // the visible band
      const grd = g.createLinearGradient(X(400e-9), 0, X(700e-9), 0);
      ['#7a3cff', '#2f6bff', '#2fd06b', '#f2e33a', '#ff8a2a', '#ff2a2a'].forEach((c, i) => grd.addColorStop(i / 5, c));
      g.globalAlpha = 0.18; g.fillStyle = grd; g.fillRect(X(400e-9), box.t, X(700e-9) - X(400e-9), box.b - box.t); g.globalAlpha = 1;
      // the cells' response
      g.fillStyle = 'rgba(180,140,255,0.25)'; g.beginPath(); g.moveTo(X(LAMBDA[0]), box.b);
      LAMBDA.forEach((l, i) => g.lineTo(X(l), box.b - (box.b - box.t) * 0.9 * S[i]));
      g.lineTo(X(LAMBDA.at(-1)), box.b); g.fill();
      g.strokeStyle = css('--grid'); g.strokeRect(box.l, box.t, box.r - box.l, box.b - box.t);
      g.fillStyle = css('--ink-2'); g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
      for (const l of [500e-9, 1000e-9, 1500e-9, 2000e-9]) g.fillText(`${(l * 1e9).toFixed(0)}${l === 2000e-9 ? ' nm' : ''}`, Math.min(X(l), box.r - 20), box.b + 14);
      const curve = (B, colour, dash = []) => {
        g.strokeStyle = colour; g.setLineDash(dash); g.lineWidth = 2; g.beginPath();
        LAMBDA.forEach((l, i) => (i ? g.lineTo(X(l), Y(B[i])) : g.moveTo(X(l), Y(B[i]))));
        g.stroke(); g.setLineDash([]); g.lineWidth = 1;
      };
      curve(rated, css('--ink-2'), [4, 4]);
      curve(spectrum(now.T, Array.from(LAMBDA)).B, '#ffc94a');
      g.textAlign = 'left'; g.fillStyle = '#ffc94a';
      g.fillText(`${now.T.toFixed(0)} K: the cells see ${(100 * now.glow).toFixed(now.glow < 0.1 ? 1 : 0)} % of the rated glow`, box.l + 6, box.t + 14);
    };
    api.on('params', update);
    animate(canvas, draw);
    update();
  },
};

// The phase: the pedal's gain against frequency with the cells as they are now, and the range they
// swept over the last cycles (the faint curves at the ends); in vibrato, the four stages' phase.
const F = Float64Array.from({ length: 240 }, (_, i) => 10 * 1000 ** (i / 239));
const phaseView = {
  title: 'The phase',
  caption: 'Chorus: the pedal\'s gain against frequency, the cells as they are now (solid) and at the ends of their swing (faint). Each stage passes every frequency at full strength but delays its phase, by 90° at 1/(2πRC); the four together turn the high frequencies through 720°, and where the stages have turned a note by 180° or 540°, mixing it with the dry signal cancels it: two notches, which the lamp sweeps up and down. Vibrato: the stages\' phase alone; as the lamp sweeps it, a note\'s phase slides back and forth, and so does its pitch.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const { trail, now } = tracker(api);
    let pp;
    const update = () => {
      pp = parts(api.P);
      legend.innerHTML = pp.vibrato
        ? '<span><i style="background:#b48cff"></i>the four stages\' phase, now</span><span>the faint lines: the ends of the swing</span>'
        : '<span><i style="background:#b48cff"></i>gain, wet and dry mixed</span><span>the faint lines: the ends of the swing</span>';
    };
    const draw = () => {
      if (!pp) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const box = { l: 40, r: w - 10, t: 12, b: h - 24 };
      const X = (f) => box.l + ((box.r - box.l) * Math.log(f / 10)) / Math.log(1000);
      const Y = pp.vibrato
        ? (ph) => box.t + ((box.b - box.t) * -ph) / (4 * Math.PI)
        : (gain) => box.t + ((box.b - box.t) * Math.min(40, -20 * Math.log10(Math.max(gain, 1e-3)))) / 40;
      g.strokeStyle = css('--grid'); g.lineWidth = 1; g.strokeRect(box.l, box.t, box.r - box.l, box.b - box.t);
      g.fillStyle = css('--ink-2'); g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
      for (const f of [100, 1000]) { g.beginPath(); g.moveTo(X(f), box.t); g.lineTo(X(f), box.b); g.stroke(); g.fillText(f >= 1000 ? '1k' : `${f}`, X(f), box.b + 14); }
      g.fillText('10 Hz', box.l + 16, box.b + 14); g.fillText('10k', box.r - 12, box.b + 14);
      g.textAlign = 'right';
      if (pp.vibrato) ['0°', '360°', '720°'].forEach((t, i) => g.fillText(t, box.l - 4, box.t + ((box.b - box.t) * i) / 2 + 4));
      else ['0 dB', '−20', '−40'].forEach((t, i) => g.fillText(t, box.l - 4, box.t + ((box.b - box.t) * i) / 2 + 4));
      const curve = (R, alpha, width) => {
        const r = response(api.P, R * 1e3, Array.from(F)), v = pp.vibrato ? r.phase : r.gain;
        g.strokeStyle = `rgba(180,140,255,${alpha})`; g.lineWidth = width; g.beginPath();
        v.forEach((y, i) => (i ? g.lineTo(X(F[i]), Y(y)) : g.moveTo(X(F[i]), Y(y))));
        g.stroke(); g.lineWidth = 1;
      };
      if (trail.length > 10) {
        let lo = Infinity, hi = 0;
        for (const p of trail) { lo = Math.min(lo, p[3]); hi = Math.max(hi, p[3]); }
        curve(lo, 0.3, 1.5); curve(hi, 0.3, 1.5);
      }
      curve(now.R, 1, 2.5);
      markNote(g, X, box, api.note);
    };
    api.on('params', update);
    animate(canvas, draw);
    update();
  },
};

const SCOPE = 'the bass going in (dashed) and coming out (solid), each scaled to fit. In chorus the output is the note plus a copy of it turned through the stages\' phase; where the two are out of step they cancel, so the output swells and thins as the lamp sweeps the notches past the note\'s harmonics. In vibrato the wave keeps its size but slides back and forth against the input.';
const SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts. In chorus, watch the two notches sweep across the harmonics with the lamp; in vibrato every harmonic keeps its size, and each smears a little either side as its pitch wobbles. The green line is the note you are playing, and the ticks along the top its harmonics.';

createPedal({ PEDAL, worklet: new URL('./lampvibe-worklet.js', import.meta.url), views: [lampView, glowView, phaseView, scopeView({ caption: SCOPE }), spectrumView({ caption: SPECTRUM })] });
