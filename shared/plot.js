// plot.js — the pages' drawing helpers: a canvas sized to its box at the screen's resolution, the
// page's colours, and a log-frequency axis.

export function fit(canvas) {
  const r = canvas.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const g = canvas.getContext('2d');
  g.setTransform(d, 0, 0, d, 0, 0);
  return { g, w: r.width, h: r.height };
}
export const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// A log-frequency, decibel plot area with its grid (a line every `step` dB): { x(f), y(db), box }.
export function freqAxes(g, w, h, { fmin = 20, fmax = 20000, dbMin = -30, dbMax = 12, step = 6 } = {}) {
  const box = { l: 40, r: w - 10, t: 10, b: h - 22 };
  const x = (f) => box.l + ((box.r - box.l) * Math.log(f / fmin)) / Math.log(fmax / fmin);
  const y = (d) => box.t + ((box.b - box.t) * (dbMax - d)) / (dbMax - dbMin);
  g.strokeStyle = css('--grid'); g.fillStyle = css('--ink-2'); g.lineWidth = 1;
  g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
  for (const f of [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]) {
    if (f < fmin || f > fmax) continue;
    g.beginPath(); g.moveTo(x(f), box.t); g.lineTo(x(f), box.b); g.stroke();
    if (w > 320 || [100, 1000, 10000].includes(f)) g.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x(f), h - 6);
  }
  g.textAlign = 'right';
  for (let d = Math.ceil(dbMin / step) * step; d <= dbMax; d += step) {
    g.beginPath(); g.moveTo(box.l, y(d)); g.lineTo(box.r, y(d)); g.stroke();
    g.fillText(`${d}`, box.l - 6, y(d) + 4);
  }
  return { x, y, box };
}

// Run draw() each frame while the canvas is visible.
export function animate(canvas, draw) {
  const tick = () => { if (canvas.offsetParent !== null) draw(); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

// The note being played, as the tuner hears it at the input (api.note: { f, letter, octave, live }),
// marked on a frequency plot: a line at its fundamental, labelled with its name, and ticks along
// the top at its harmonics n·f₁, so the peaks that belong to the note can be told from the rest.
// Dimmed while the note is held after the string has gone quiet.
export function markNote(g, x, box, note) {
  if (!note?.f) return;
  const X = x(note.f);
  if (!(X >= box.l && X <= box.r)) return;
  g.save();
  g.globalAlpha = note.live ? 1 : 0.4;
  const c = css('--good');
  g.strokeStyle = c; g.lineWidth = 1;
  for (let n = 2; n <= 16; n++) {
    const xn = x(n * note.f);
    if (xn > box.r) break;
    g.globalAlpha = (note.live ? 1 : 0.4) * Math.max(0.25, 1 - n / 12);
    g.beginPath(); g.moveTo(xn, box.t); g.lineTo(xn, box.t + 7); g.stroke();
  }
  g.globalAlpha = note.live ? 1 : 0.4;
  g.setLineDash([3, 3]); g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(X, box.t); g.lineTo(X, box.b); g.stroke(); g.setLineDash([]);
  const label = `${note.letter}${note.octave} · ${note.f.toFixed(1)} Hz`;
  g.font = '600 12px system-ui, sans-serif';
  const w = g.measureText(label).width + 10, lx = Math.min(box.r - w, X + 4);
  g.fillStyle = css('--panel'); g.fillRect(lx, box.t + 10, w, 18);
  g.fillStyle = c; g.textAlign = 'left'; g.fillText(label, lx + 5, box.t + 23);
  g.restore();
}
