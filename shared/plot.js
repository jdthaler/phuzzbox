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

// A log-frequency, decibel plot area with its grid: { x(f), y(db), box }.
export function freqAxes(g, w, h, { fmin = 20, fmax = 20000, dbMin = -30, dbMax = 12 } = {}) {
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
  for (let d = Math.ceil(dbMin / 6) * 6; d <= dbMax; d += 6) {
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
