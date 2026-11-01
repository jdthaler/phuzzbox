// views.js — the two views every pedal's page has: a Scope (the voltage going in and coming out,
// against time) and a Spectrum (the same two, against frequency). shared/shell.js adds them to a
// page that doesn't bring its own; a pedal passes its own caption when it has something to say
// about what its circuit does to them. How each works is in scope/README.md and
// spectrum/README.md, which a page shows as How it works.
//
//   scopeView({ caption?, ms? })        the Scope: input dashed, output solid, in volts
//   spectrumView({ caption? })          the Spectrum: the same, in dBV, with the note being played
//
// The pure parts are exported for test/views-tests.mjs.

import { fit, css, freqAxes, animate, markNote } from './plot.js';

// ---- the spectrum's calibration

// An AnalyserNode (the Web Audio spec, "FFT windowing and smoothing over time") windows its block
// with a Blackman window, w[n] = 0.42 − 0.5 cos(2πn/N) + 0.08 cos(4πn/N), takes the Fourier
// transform divided by N, smooths the magnitudes over frames and gives 20 log10 of them. A sine of
// peak amplitude A at a bin's centre then reads |X| = A · a₀ / 2, a₀ = 0.42 the window's mean
// (its coherent gain): 13.56 dB under A. Adding that back makes the plot read a partial's peak
// amplitude: 0 dBV is a sine of 1 V peak.
export const BLACKMAN_A0 = 0.42;
export const PEAK_DB = -20 * Math.log10(BLACKMAN_A0 / 2); // +13.56 dB

// ---- the scope's trigger and scale

// The scope's trigger, as an oscilloscope's: the last rising crossing of `level` at or before
// sample `last` of the signal at(i), i = 0…, that came up from below level − hyst, so noise riding
// on a slow edge can't trigger it twice (a Schmitt trigger's hysteresis). Returns the crossing's
// position to a fraction of a sample (linear between the two samples), or −1 for none.
export function trigger(at, last, level = 0, hyst = 0) {
  for (let i = last; i > 0; i--) {
    if (!(at(i - 1) < level && at(i) >= level)) continue;
    let j = i - 1; // back through the band just under the level: armed if the signal came from below it
    while (j > 0 && at(j) < level && at(j) > level - hyst) j--;
    if (at(j) <= level - hyst) return i - 1 + (level - at(i - 1)) / (at(i) - at(i - 1));
    i = j + 1; // it wiggled across within the band: not a trigger; go on from there
  }
  return -1;
}

// The smallest 1, 2 or 5 × 10ⁿ at or above x: the scope's volts a division, so its labels are round.
export function niceRange(x) {
  if (!(x > 0)) return 1e-3;
  const p = 10 ** Math.floor(Math.log10(x)), m = x / p;
  return (m <= 1 + 1e-9 ? 1 : m <= 2 + 1e-9 ? 2 : m <= 5 + 1e-9 ? 5 : 10) * p;
}

// The two traces' volts a division: the larger for both when they are within 2.5 times of each
// other (one step of 1, 2, 5), each its own otherwise.
export function sharedScale(dIn, dOut) {
  const big = Math.max(dIn, dOut);
  return big <= 2.5 * Math.min(dIn, dOut) * (1 + 1e-9) ? [big, big] : [dIn, dOut];
}

const volts = (v) => (v >= 1 ? `${+v.toPrecision(3)} V` : `${+(v * 1000).toPrecision(3)} mV`);
const waiting = (g, box) => { g.fillStyle = css('--ink-2'); g.textAlign = 'center'; g.fillText('Start audio, then play', (box.l + box.r) / 2, (box.t + box.b) / 2 - 8); };

// ---- the Scope

export function scopeView({ caption, ms = 50 } = {}) {
  return {
    title: 'Scope',
    about: 'scope',
    perform: true,
    caption: caption ?? `the voltage at the input (dashed) and at the pedal's output (solid) over ${ms} ms, held still by triggering on the input's rising edges, as an oscilloscope does. A buffer's two lines lie on each other; a filter shifts and reshapes the output; a fuzz squares it off.`,
    mount(holder, api) {
      const canvas = document.createElement('canvas');
      holder.append(canvas);
      let a = null, b = null;
      const chIn = { div: 0, shrink: 0 }, chOut = { div: 0, shrink: 0 };
      animate(canvas, () => {
        const { g, w, h } = fit(canvas);
        g.clearRect(0, 0, w, h);
        const box = { l: 10, r: w - 10, t: 10, b: h - 20 }, mid = (box.t + box.b) / 2;
        g.lineWidth = 1; g.font = '11px system-ui, sans-serif';
        // the graticule: ten divisions across, four up and down
        g.strokeStyle = css('--grid');
        for (let d = 0; d <= 10; d++) { const X = box.l + ((box.r - box.l) * d) / 10; g.beginPath(); g.moveTo(X, box.t); g.lineTo(X, box.b); g.stroke(); }
        for (let d = 0; d <= 4; d++) { const Y = box.t + ((box.b - box.t) * d) / 4; g.beginPath(); g.moveTo(box.l, Y); g.lineTo(box.r, Y); g.stroke(); }
        g.fillStyle = css('--ink-2'); g.textAlign = 'center';
        g.fillText(`${ms / 10} ms/div`, (box.l + box.r) / 2, h - 5);
        if (!api.analyser || !api.input) { waiting(g, box); return; }
        a ??= new Float32Array(api.analyser.fftSize); b ??= new Float32Array(api.input.fftSize);
        api.analyser.getFloatTimeDomainData(a);
        api.input.getFloatTimeDomainData(b);
        const n = Math.min(a.length, b.length), oa = a.length - n, ob = b.length - n; // both end at the same sample
        const fs = api.ctx.sampleRate, span = Math.min(Math.round((ms / 1000) * fs), n >> 1);
        const k = api.fullScale(), out = (i) => k * a[oa + i];
        // the trigger is on the input, the bass itself, whose note repeats whatever the pedal does
        // to it: its swing over the newest two windows sets the level, half way, and the
        // hysteresis, a tenth of the swing
        const inp = (i) => b[ob + i];
        let lo = Infinity, hi = -Infinity;
        for (let i = n - 2 * span; i < n; i++) { const v = inp(i); if (v < lo) lo = v; if (v > hi) hi = v; }
        let start = trigger(inp, n - span - 1, (lo + hi) / 2, 0.1 * (hi - lo));
        if (start < 0) start = n - span - 1; // free-running, as a scope with nothing to trigger on
        const s0 = Math.floor(start), frac = start - s0;
        // volts a division for each trace: 1, 2 or 5 × 10ⁿ, so its peak fits in the two divisions
        // above the middle; each steps up at once, and down only after a second of wanting a
        // smaller one, and is 2 mV at the least, so the hiss between notes doesn't fill the screen
        let mIn = 0, mOut = 0;
        for (let i = 0; i <= span; i++) { mOut = Math.max(mOut, Math.abs(out(s0 + i))); mIn = Math.max(mIn, Math.abs(inp(s0 + i))); }
        for (const [c, m] of [[chIn, mIn], [chOut, mOut]]) {
          const want = niceRange(Math.max(m / 2, 2e-3));
          if (want >= c.div) { c.div = want; c.shrink = 0; } else if (++c.shrink > 60) { c.div = want; c.shrink = 0; }
        }
        // one scale for both, as a pedal that passes the signal unchanged should show two lines on
        // each other, unless one needs more than 2.5 times the other's (a preamp's gain): then each
        // its own, as on a two-channel scope
        const [dIn, dOut] = sharedScale(chIn.div, chOut.div);
        const X = (i) => box.l + ((box.r - box.l) * (i - frac)) / span;
        const Y = (v, d) => mid - ((box.b - box.t) / 4) * (v / d);
        g.textAlign = 'left';
        if (dIn === dOut) { g.fillStyle = css('--ink-2'); g.fillText(`${volts(dOut)}/div`, box.l + 4, box.t + 12); } else {
          g.fillStyle = css('--ink-2'); g.fillText(`in ${volts(dIn)}/div`, box.l + 4, box.t + 12);
          g.fillStyle = css('--accent'); g.fillText(`out ${volts(dOut)}/div`, box.l + 4, box.t + 26);
        }
        const trace = (get, d, color, width, dash) => {
          g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash); g.beginPath();
          for (let i = 0; i <= span; i++) { const y = Math.max(box.t, Math.min(box.b, Y(get(s0 + i), d))); i ? g.lineTo(X(i), y) : g.moveTo(X(i), y); }
          g.stroke(); g.setLineDash([]);
        };
        trace(inp, dIn, css('--ink-2'), 1.2, [4, 3]);
        trace(out, dOut, css('--accent'), 2, []);
      });
    },
  };
}

// ---- the Spectrum

export function spectrumView({ caption } = {}) {
  return {
    title: 'Spectrum',
    about: 'spectrum',
    perform: true,
    caption: caption ?? 'what goes in (dashed) and what comes out (solid), in dB of volts: 0 dBV is a sine of 1 V peak. The green line is the note you are playing, as the tuner hears it at the input, and the ticks along the top its harmonics.',
    mount(holder, api) {
      const canvas = document.createElement('canvas');
      holder.append(canvas);
      let dOut = null, dIn = null;
      animate(canvas, () => {
        const { g, w, h } = fit(canvas);
        g.clearRect(0, 0, w, h);
        const { x, y, box } = freqAxes(g, w, h, { fmin: 30, dbMin: -108, dbMax: 12, step: h < 260 ? 24 : 12 });
        g.textAlign = 'right'; g.fillStyle = css('--ink-2');
        g.fillText('dBV', box.l - 6, h - 6); // the unit, under the level axis's numbers
        if (!api.analyser || !api.input) { waiting(g, box); return; }
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
        line(dIn, api.input.fftSize, css('--ink-2'), 1, PEAK_DB, [4, 3]);
        line(dOut, api.analyser.fftSize, css('--accent'), 1.5, PEAK_DB + kdb, []);
      });
    },
  };
}
