// lens-main.js — the Gravitational Lens's page: the shell (shared/shell.js) and its views.

import { createPedal } from '../../shared/shell.js';
import { fit, css, freqAxes, animate, markNote, markPartials, atFreq } from '../../shared/plot.js';
import { scopeView, spectrumView } from '../../shared/views.js';
import { scratch, wasmEffect } from '../../shared/wasm.js';
import { PEDAL } from './lens-pedal.js';

const Effect = wasmEffect(PEDAL);
const model = await Effect.ready(); // the C++ model, for the views

const call = (P, fn, extra = []) => {
  const v = Effect.native(P), s = scratch(model);
  s.f64(v.length).set(v);
  if (extra.length) s.f64(extra.length, 8 * v.length).set(extra);
  fn(s.at);
  return { n: v.length, at: (k, off) => Array.from(s.f64(k, 8 * off)) };
};
function parts(P) {
  const r = call(P, (at) => model.lens_parts(at)).at(11, 0);
  return { unit: r[0], xp: r[1], xm: r[2], Tp: r[3], Tm: r[4], mup: r[5], mum: r[6], delay: r[7], A: r[8], f1: r[9] };
}
const N = 300, FREQS = Float64Array.from({ length: N }, (_, i) => 20 * 1000 ** (i / (N - 1)));
function response(P) {
  const r = call(P, (at) => model.lens_response(at, N), [48000, ...FREQS]);
  return { waves: r.at(N, r.n + 1 + N), rays: r.at(N, r.n + 1 + 3 * N), geometric: r.at(N, r.n + 1 + 5 * N) };
}
// the waves' kernel at rate fs, its first n taps
function kernel(P, fs, n) {
  const r = call(P, (at) => model.lens_kernel(at, n + 1), [fs]);
  return r.at(n, r.n + 2);
}
const ms = (t) => (t >= 0.01 ? `${(1e3 * t).toFixed(1)} ms` : t >= 1e-3 ? `${(1e3 * t).toFixed(2)} ms` : `${(1e6 * t).toFixed(0)} µs`);
const hz = (f) => (f >= 1000 ? `${(f / 1000).toFixed(f >= 1e4 ? 0 : 1)} kHz` : `${f.toFixed(0)} Hz`);
// a colour from the page's palette as [r, g, b]
function rgb(colour) {
  const c = document.createElement('canvas').getContext('2d');
  c.fillStyle = colour;
  const s = c.fillStyle;
  if (s.startsWith('#')) return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  return s.match(/[\d.]+/g).slice(0, 3).map(Number);
}

// how loud the output has been, from the engine's messages, for the images' glow
function light(api) {
  const now = { input: 0, output: 0, building: false };
  api.on('pedal', (messages) => {
    const m = messages.filter((x) => x.type === 1).pop();
    if (!m) return;
    now.input = m.values[0]; now.output = m.values[1]; now.building = m.values[2] > 0.5;
  });
  return now;
}

// The lens plane: the arrival time of the path through each point, its images, and the area
// arriving before a time that sweeps on, whose second derivative is the lens's impulse response.
const planeView = {
  title: 'The lens plane',
  caption: 'the plane of the lens seen from you, in Einstein radii: the lens (black) at the centre, its Einstein ring (dashed), the source behind it (✦) and its two images, where the arrival time of the paths through the plane is least (+, on the source\'s side) and at its saddle (−, across the lens), each drawn as big as it is bright and glowing as you play. The contours are arrival times half of 4GM/c³ apart. The shading is the part of the plane whose paths have arrived by a time that sweeps on from the first image: the wave that reaches you is the sum over all of it, and the lens\'s impulse response is the second derivative of the shaded area, a spike when the first image appears, a swing as the shading wraps round the saddle, and a slow tail as it grows outward.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    const glow = light(api);
    const G = 180, span = 3; // grid points across, and half the plane's width (Einstein radii)
    let T = new Float32Array(G * G), pp, y = 0.5, t0 = performance.now();
    const off = document.createElement('canvas');
    off.width = off.height = G;
    const update = () => {
      const P = api.P;
      pp = parts(P); y = P.offset;
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
        const x1 = span * (2 * (i + 0.5) / G - 1), x2 = span * (1 - 2 * (j + 0.5) / G), r = Math.hypot(x1, x2);
        T[j * G + i] = ((x1 - y) ** 2 + x2 * x2) / 2 - Math.log(Math.max(r, 1e-6));
      }
      legend.innerHTML = `<span>images at +${pp.xp.toFixed(2)} and −${(-pp.xm).toFixed(2)} θE</span><span>brightened ${pp.mup.toFixed(2)} + ${(-pp.mum).toFixed(2)} = ${pp.A.toFixed(2)} times</span><span>the second ${ms(pp.delay)} later</span>`;
    };
    const draw = () => {
      if (!pp) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const size = Math.min(w - 16, h - 16), ox = (w - size) / 2, oy = (h - size) / 2;
      const X = (v) => ox + size * (v / span + 1) / 2, Y = (v) => oy + size * (1 - v / span) / 2;
      // the sweep: from the first image to well past the saddle, every four seconds
      const period = 4, phase = ((performance.now() - t0) / 1000 % period) / period;
      const tau = pp.Tp + (pp.Tm - pp.Tp + 2.5) * phase;
      const lit = rgb(css('--accent')), ink = rgb(css('--ink-2'));
      const img = off.getContext('2d').createImageData(G, G), d = img.data, step = 0.5;
      const bands = Math.ceil((pp.Tm - pp.Tp + 2) / step); // contours up to 2 units past the saddle
      for (let k = 0; k < G * G; k++) {
        const t = T[k], band = Math.floor((t - pp.Tp) / step), right = k % G < G - 1 ? Math.floor((T[k + 1] - pp.Tp) / step) : band;
        const below0 = k >= G ? Math.floor((T[k - G] - pp.Tp) / step) : band;
        // a contour where the band changes by one between neighbours (not where they crowd, by the lens)
        const edge = band < bands && ((right !== band && Math.abs(right - band) === 1) || (below0 !== band && Math.abs(below0 - band) === 1));
        const below = t < tau;
        const c = below ? lit : ink, a = below ? (edge ? 170 : 70) : (edge ? 90 : 0);
        d[4 * k] = c[0]; d[4 * k + 1] = c[1]; d[4 * k + 2] = c[2]; d[4 * k + 3] = a;
      }
      off.getContext('2d').putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(off, ox, oy, size, size);
      // the Einstein ring, the lens and the source
      g.strokeStyle = css('--ink-2'); g.setLineDash([4, 4]); g.lineWidth = 1;
      g.beginPath(); g.arc(X(0), Y(0), size / (2 * span), 0, 2 * Math.PI); g.stroke(); g.setLineDash([]);
      g.fillStyle = css('--ink'); g.beginPath(); g.arc(X(0), Y(0), 4, 0, 2 * Math.PI); g.fill();
      g.font = '13px system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText('✦', X(y), Y(0) + 5);
      // the images, as big as they are bright, glowing with the output
      const level = Math.min(1, 6 * glow.output);
      for (const [x, mu, sign] of [[pp.xp, pp.mup, '+'], [pp.xm, -pp.mum, '−']]) {
        const r = 3 + 6 * Math.sqrt(Math.min(mu, 6));
        g.globalAlpha = 0.35 + 0.65 * level;
        g.fillStyle = css('--accent'); g.beginPath(); g.arc(X(x), Y(0), r, 0, 2 * Math.PI); g.fill();
        g.globalAlpha = 1;
        g.fillStyle = css('--ink'); g.fillText(sign, X(x), Y(0) - r - 4);
      }
      g.textAlign = 'left'; g.fillStyle = css('--ink-2'); g.font = '11px system-ui, sans-serif';
      g.fillText(`shaded: arrived by T₊ + ${(tau - pp.Tp).toFixed(2)}${glow.building ? ' · changing' : ''}`, ox + 4, oy + size - 6);
    };
    api.on('params', () => { update(); draw(); });
    animate(canvas, draw);
    update();
  },
};

// Arrivals: the impulse response in waves against time, and the two rays of geometric optics.
const arrivalsView = {
  title: 'Arrivals',
  caption: 'what reaches you after a click, against time from the first image: in waves (solid), a spike as the first image arrives, a swing up and over as the saddle\'s image arrives, the click Hilbert-transformed (turned a quarter cycle at every frequency), and a long faint negative tail, the waves bent round the lens rather than focused by it, which carries the longest waves through untouched. Geometric optics (dashed) has only the two images: a spike of √μ₊ and the saddle\'s √|μ₋| Hilbert-transformed, which reaches back before the first image arrives and so can\'t be played as it is. Plotted per unit of 4GM/c³ on a scale that grows like a logarithm away from zero, so the faint tail shows; the first spike is drawn as an arrow, its height its weight.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let pp, h, span, n = 800, D;
    const update = () => {
      const P = api.P;
      pp = parts(P);
      span = Math.max(3, 1.6 * (pp.Tm - pp.Tp));
      const fs = n / (span * pp.unit);
      D = 1 / (fs * pp.unit);
      h = kernel(P, fs, n);
      legend.innerHTML = `<span>4GM/c³ = ${ms(pp.unit)}</span><span>√μ₊ = ${Math.sqrt(pp.mup).toFixed(2)}, √|μ₋| = ${Math.sqrt(-pp.mum).toFixed(2)}</span><span>the second image ${ms(pp.delay)} after the first</span>`;
    };
    const draw = () => {
      if (!h) return;
      const { g, w, h: H } = fit(canvas);
      g.clearRect(0, 0, w, H);
      const l = 40, r = w - 10, t = 14, b = H - 26, g0 = 0.05, top = Math.asinh(3 / g0);
      const X = (tau) => l + ((tau + 0.06 * span) / (1.06 * span)) * (r - l);
      const Y = (v) => (t + b) / 2 - ((b - t) / 2) * Math.max(-1, Math.min(1, Math.asinh(v / g0) / top));
      // axes: zero, ticks in milliseconds
      g.strokeStyle = css('--grid'); g.lineWidth = 1;
      g.beginPath(); g.moveTo(l, Y(0)); g.lineTo(r, Y(0)); g.stroke();
      g.fillStyle = css('--ink-2'); g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
      // ticks about every fifth of the span, 1, 2 or 5 of a power of ten, in ms (or µs)
      const total = span * pp.unit, scale = total >= 1e-3 ? 1e3 : 1e6, unitName = total >= 1e-3 ? 'ms' : 'µs';
      const raw = (total * scale) / 5, pow = 10 ** Math.floor(Math.log10(raw)), tick = pow * (raw / pow >= 5 ? 5 : raw / pow >= 2 ? 2 : 1);
      const dec = Math.max(0, -Math.floor(Math.log10(tick) + 1e-9));
      for (let s = 0; s <= total * scale + 1e-9; s += tick) {
        const xx = X(s / scale / pp.unit);
        g.beginPath(); g.moveTo(xx, b); g.lineTo(xx, b + 4); g.stroke();
        g.fillText(s.toFixed(dec), xx, b + 15);
      }
      g.textAlign = 'right'; g.fillText(`asinh scale · ${unitName}`, r, t + 4);
      // geometric optics: the saddle's Hilbert-transformed ray, −√|μ₋| / (π (τ − ΔT))
      const a = Math.sqrt(-pp.mum), dT = pp.Tm - pp.Tp;
      g.strokeStyle = css('--ink-2'); g.setLineDash([5, 4]); g.lineWidth = 1.5;
      g.beginPath();
      let first = true;
      for (let i = 0; i <= 600; i++) {
        const tau = -0.06 * span + (1.06 * span * i) / 600, v = -a / (Math.PI * (tau - dT));
        if (!Number.isFinite(v) || Math.abs(tau - dT) < 1e-3 * span) { first = true; continue; }
        first ? g.moveTo(X(tau), Y(v)) : g.lineTo(X(tau), Y(v));
        first = false;
      }
      g.stroke(); g.setLineDash([]);
      // waves: the kernel per unit time (its first tap is the spike)
      g.strokeStyle = css('--accent'); g.lineWidth = 2;
      g.beginPath(); g.moveTo(X(-0.06 * span), Y(0)); g.lineTo(X(0), Y(0));
      for (let i = 1; i < h.length; i++) g.lineTo(X(i * D), Y(h[i] / D));
      g.stroke();
      // the first image's spike, an arrow
      const head = Y(3 * g0 * Math.sinh(top * 0.9) / 3);
      g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(0), head); g.stroke();
      g.beginPath(); g.moveTo(X(0) - 5, head + 8); g.lineTo(X(0), head); g.lineTo(X(0) + 5, head + 8); g.stroke();
      g.fillStyle = css('--ink'); g.textAlign = 'left';
      g.fillText(`√μ₊ = ${Math.sqrt(pp.mup).toFixed(2)}`, X(0) + 8, head + 10);
      g.fillText('−', X(dT) + 6, Y(-0.6));
    };
    api.on('params', () => { update(); draw(); });
    animate(canvas, draw);
    update();
  },
};

// The response: the gain against frequency, in waves and in rays.
const responseView = {
  title: 'The response',
  caption: 'the lens\'s gain against frequency, in dB: in waves (solid) and in geometric optics (dashed). The two images beat into a comb, peaks where they arrive in step and dips where they cancel, one every 1/Δt, and with Rays the comb runs all the way down. In waves it fades below about c³/(8πGM) (the dotted line), where the wavelength outgrows the lens and the wave goes round it, gaining nothing: every lens passes the longest waves at 0 dB. The faint line is the lens\'s average brightening, |μ₊| + |μ₋|. The green dots are the note you play.',
  mount(holder, api) {
    const canvas = document.createElement('canvas');
    holder.append(canvas);
    const legend = document.createElement('div');
    legend.className = 'legend';
    holder.after(legend);
    let R, pp, P;
    const db = (x) => 20 * Math.log10(Math.max(x, 1e-6));
    const update = () => {
      P = api.P; R = response(P); pp = parts(P);
      legend.innerHTML = `<span><i style="background:${css('--accent')}"></i>waves</span><span>rays (dashed): dips every ${hz(1 / pp.delay)}</span><span>diffraction below ${hz(pp.f1)}</span><span>brightening ${(10 * Math.log10(pp.A)).toFixed(1)} dB</span>`;
    };
    const draw = () => {
      if (!R) return;
      const { g, w, h } = fit(canvas);
      g.clearRect(0, 0, w, h);
      const { x, y, box } = freqAxes(g, w, h, { fmin: 20, fmax: 20000, dbMin: -24, dbMax: 24, step: 6 });
      const line = (vals, colour, dash, width) => {
        g.strokeStyle = colour; g.lineWidth = width; g.setLineDash(dash);
        g.beginPath();
        vals.forEach((v, i) => { const Y = Math.max(box.t, Math.min(box.b, y(db(v)))); i ? g.lineTo(x(FREQS[i]), Y) : g.moveTo(x(FREQS[i]), Y); });
        g.stroke(); g.setLineDash([]); g.lineWidth = 1;
      };
      g.strokeStyle = css('--ink-2'); g.globalAlpha = 0.5; g.setLineDash([2, 3]);
      const yA = y(10 * Math.log10(pp.A));
      g.beginPath(); g.moveTo(box.l, yA); g.lineTo(box.r, yA); g.stroke();
      if (pp.f1 > 20 && pp.f1 < 20000) { g.beginPath(); g.moveTo(x(pp.f1), box.t); g.lineTo(x(pp.f1), box.b); g.stroke(); }
      g.setLineDash([]); g.globalAlpha = 1;
      line(R.rays, css('--ink-2'), [5, 4], 1.5);
      line(R.waves, css('--accent'), [], 2.5);
      markNote(g, x, box, api.note);
      markPartials(g, x, y, box, api, (f) => db(atFreq(FREQS, P.optics === 'rays' ? R.rays : R.waves, f)));
    };
    api.on('params', () => { update(); draw(); });
    animate(canvas, draw);
    update();
  },
};

const SCOPE = 'the voltage at the input (dashed) and the output (solid) as you play, each scaled to fit. On a heavy lens you see each note arrive twice, the second time Hilbert-transformed, its shape changed though its spectrum isn\'t: a quarter cycle turns a sine into a cosine and a sawtooth into a spiky wave.';
const SPECTRUM = 'what goes in (dashed) and what comes out (solid), in dB of volts (0 dBV is a sine of 1 V peak): the two images\' comb pulls regular dips through the bass\'s harmonics, and in waves the low strings come through as they went in. The green line is the note you are playing, and the ticks along the top its harmonics.';

createPedal({ PEDAL, worklet: new URL('./lens-worklet.js', import.meta.url), views: [planeView, arrivalsView, responseView, scopeView({ caption: SCOPE }), spectrumView({ caption: SPECTRUM })] });
