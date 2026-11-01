// schematic.js — circuit diagrams as SVG text, for the READMEs (How it works) and the tours. A
// pedal draws its diagrams in <slug>/src/<slug>-schematics.js; tools/gen-schematics.mjs writes
// them to <slug>/schematics/<name>.svg, which the README shows as a figure:
//
//   ![The attenuator: 47 kΩ and the photocell](schematics/attenuator.svg)
//
//   const s = schematic({ w: 24, h: 10, title: 'The attenuator' }); // in grid units (20 px)
//   s.terminal([1, 3], 'in');
//   s.resistor([1, 3], [7, 3], '47 kΩ');          // two-terminal parts lie between two points
//   s.ldr([7, 3], [7, 7], { label: 'cell', accent: true });
//   s.ground([7, 7]);
//   const v = s.triode([12, 5], { label: 'V1a' }); // three-terminal parts return their pins
//   s.wire(v.plate, [12, 1], [20, 1]);
//   return s.svg();
//
// Points are [x, y] in grid units, y down. A two-terminal part's points must share an x or a y;
// its body (two units long) sits in the middle and wires run to the points. Labels go above a
// horizontal part and to the right of a vertical one (opts.side: 'left' or 'below' to swap).
// Each diagram is drawn on its own dark panel, in the site's colours, so it reads alike on the
// site and on GitHub. opts.accent draws a part in the accent colour: the part a figure is about.

const G = 20; // px per grid unit
const C = { bg: '#151518', line: '#2b2a30', ink: '#ece8e1', ink2: '#9b958b', accent: '#fb923c', accent2: '#60a5fa', good: '#4ade80' };
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ESC[c]);
const n = (v) => Math.round(v * 100) / 100;

export function schematic({ w, h, title = '' }) {
  const parts = [];
  const px = ([x, y]) => [x * G, y * G];
  const colour = (o) => (o.accent ? C.accent : o.colour ? C[o.colour] ?? o.colour : C.ink);
  const path = (d, o = {}) => parts.push(`<path d="${d}" fill="none" stroke="${colour(o)}" stroke-width="${o.width ?? 1.6}" stroke-linecap="round" stroke-linejoin="round"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`);
  const text = (x, y, t, { anchor = 'middle', colour: c = C.ink2, size = 12, weight = 400 } = {}) =>
    parts.push(`<text x="${n(x)}" y="${n(y)}" text-anchor="${anchor}" fill="${c}" font-size="${size}" font-weight="${weight}">${esc(t)}</text>`);
  const line = (pts, o) => path(pts.map((p, i) => `${i ? 'L' : 'M'}${n(p[0])} ${n(p[1])}`).join(' '), o);

  // a two-terminal part: wires from a and b to a body of length L px, drawn by body(g) along +x
  function twoTerminal(a, b, o, L, body) {
    const [ax, ay] = px(a), [bx, by] = px(b);
    if (ax !== bx && ay !== by) throw new Error(`schematic: ${o.label ?? 'a part'} must lie along a grid line`);
    const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len;
    const s = (len - L) / 2;
    line([[ax, ay], [ax + ux * s, ay + uy * s]], {});
    line([[ax + ux * (s + L), ay + uy * (s + L)], [bx, by]], {});
    const angle = (Math.atan2(uy, ux) * 180) / Math.PI;
    const inner = [];
    const save = parts.length;
    body(L, o);
    inner.push(...parts.splice(save));
    parts.push(`<g transform="translate(${n(ax + ux * s)} ${n(ay + uy * s)}) rotate(${n(angle)})">${inner.join('')}</g>`);
    // the label and value beside the body's middle
    const mx = (ax + bx) / 2, my = (ay + by) / 2, vertical = ax === bx;
    const lines = [o.label, o.value].filter(Boolean);
    lines.forEach((t, k) => {
      const c = k === 0 && o.accent ? C.accent : k === 0 ? C.ink : C.ink2;
      if (vertical) {
        const left = o.side === 'left';
        text(mx + (left ? -14 : 14), my + 4 + (k - (lines.length - 1) / 2) * 14, t, { anchor: left ? 'end' : 'start', colour: c });
      } else {
        const below = o.side === 'below';
        text(mx, below ? my + 22 + k * 14 : my - 12 - (lines.length - 1 - k) * 14, t, { colour: c });
      }
    });
  }
  const opts = (o) => (typeof o === 'string' ? { label: o } : o ?? {});
  const zigzag = (L, o) => {
    const k = 6, step = L / (2 * k);
    const d = [[0, 0], ...Array.from({ length: 2 * k - 1 }, (_, i) => [(i + 1) * step, i % 2 ? 6 : -6]), [L, 0]];
    line(d, o);
  };

  const api = {
    wire(...pts) { line(pts.map(px), {}); return api; },
    dot(p) { const [x, y] = px(p); parts.push(`<circle cx="${x}" cy="${y}" r="3" fill="${C.ink}"/>`); return api; },
    terminal(p, label, { side = 'left' } = {}) {
      const [x, y] = px(p);
      parts.push(`<circle cx="${x}" cy="${y}" r="4" fill="${C.bg}" stroke="${C.ink}" stroke-width="1.6"/>`);
      if (label) {
        const where = { left: [x - 9, y + 4, 'end'], right: [x + 9, y + 4, 'start'], above: [x, y - 10, 'middle'], below: [x, y + 20, 'middle'] }[side];
        text(where[0], where[1], label, { anchor: where[2], colour: C.ink });
      }
      return api;
    },
    label(p, t, { anchor = 'middle', colour: c = 'ink2', size = 12, weight = 400 } = {}) { const [x, y] = px(p); text(x, y, t, { anchor, colour: C[c] ?? c, size, weight }); return api; },
    ground(p) {
      const [x, y] = px(p);
      line([[x, y], [x, y + 8]], {});
      line([[x - 9, y + 8], [x + 9, y + 8]], {});
      line([[x - 5.5, y + 12], [x + 5.5, y + 12]], {});
      line([[x - 2, y + 16], [x + 2, y + 16]], {});
      return api;
    },
    resistor(a, b, o) { o = opts(o); twoTerminal(a, b, o, 36, (L) => zigzag(L, o)); return api; },
    capacitor(a, b, o) {
      o = opts(o);
      twoTerminal(a, b, o, 8, (L) => { line([[0, -10], [0, 10]], { ...o, width: 2.2 }); line([[L, -10], [L, 10]], { ...o, width: 2.2 }); });
      return api;
    },
    inductor(a, b, o) {
      o = opts(o);
      twoTerminal(a, b, o, 36, (L) => { const r = L / 8; path(`M0 0 ${[0, 1, 2, 3].map((i) => `A${r} ${r} 0 0 1 ${n((2 * i + 2) * r)} 0`).join(' ')}`, o); });
      return api;
    },
    // a resistor lit from outside: two arrows coming in
    ldr(a, b, o) {
      o = opts(o);
      twoTerminal(a, b, o, 36, (L) => {
        zigzag(L, o);
        for (const dx of [8, 20]) { line([[dx - 10, 24], [dx, 12]], { colour: C.good }); line([[dx, 12], [dx - 6, 14]], { colour: C.good }); line([[dx, 12], [dx - 2, 18]], { colour: C.good }); }
      });
      return api;
    },
    diode(a, b, o) {
      o = opts(o);
      twoTerminal(a, b, o, 16, (L) => { line([[0, -8], [0, 8], [L, 0], [0, -8]], o); line([[L, -8], [L, 8]], o); });
      return api;
    },
    // a pot from a to b, its wiper an arrow from the point w onto the track's middle (w level with
    // the middle, beside the track)
    pot(a, b, w, o) {
      o = opts(o);
      api.resistor(a, b, { accent: o.accent });
      const [ax, ay] = px(a), [bx, by] = px(b), [wx, wy] = px(w), mx = (ax + bx) / 2, my = (ay + by) / 2;
      const vertical = ax === bx, side = vertical ? Math.sign(wx - mx) : Math.sign(wy - my);
      const tip = vertical ? [mx + side * 8, my] : [mx, my + side * 8];
      line(vertical ? [[wx, wy], [wx, my], tip] : [[wx, wy], [mx, wy], tip], {});
      const t = vertical ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2);
      line([[tip[0] - 7 * Math.cos(t - 0.5), tip[1] - 7 * Math.sin(t - 0.5)], tip, [tip[0] - 7 * Math.cos(t + 0.5), tip[1] - 7 * Math.sin(t + 0.5)]], {});
      const lines = [o.label, o.value].filter(Boolean);
      lines.forEach((t2, k) => {
        const c = k === 0 ? (o.accent ? C.accent : C.ink) : C.ink2;
        if (vertical) text(mx - side * 14, my + 4 + (k - (lines.length - 1) / 2) * 14, t2, { anchor: side > 0 ? 'end' : 'start', colour: c });
        else text(mx, side > 0 ? my - 12 - (lines.length - 1 - k) * 14 : my + 22 + k * 14, t2, { colour: c });
      });
      return api;
    },
    // an amplifier: a triangle pointing right, its input at p, its output 3 units on; the label inside
    amp(p, o) {
      o = opts(o);
      const [x, y] = px(p), L = (o.length ?? 3) * G, H = (o.height ?? 2.4) * G;
      line([[x, y - H / 2], [x + L, y], [x, y + H / 2], [x, y - H / 2]], o);
      if (o.label) text(x + L * 0.38, y + 4, o.label, { colour: o.accent ? C.accent : C.ink, size: 11 });
      return { in: p, out: [p[0] + (o.length ?? 3), p[1]] };
    },
    // a box: top-left p, w by h units, a label (and a second line) in the middle
    block(p, w, h, o) {
      o = opts(o);
      const [x, y] = px(p);
      parts.push(`<rect x="${x}" y="${y}" width="${w * G}" height="${h * G}" rx="6" fill="none" stroke="${colour(o)}" stroke-width="1.6"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`);
      const lines = [o.label, o.value].filter(Boolean);
      lines.forEach((t, k) => text(x + (w * G) / 2, y + (h * G) / 2 + 4 + (k - (lines.length - 1) / 2) * 15, t, { colour: k ? C.ink2 : o.accent ? C.accent : C.ink }));
      return { left: [p[0], p[1] + h / 2], right: [p[0] + w, p[1] + h / 2], top: [p[0] + w / 2, p[1]], bottom: [p[0] + w / 2, p[1] + h] };
    },
    // an arrow from a to b (light, flow, a signal's direction)
    arrow(a, b, { colour: c = 'ink2', dash } = {}) {
      const [ax, ay] = px(a), [bx, by] = px(b), t = Math.atan2(by - ay, bx - ax);
      line([[ax, ay], [bx, by]], { colour: C[c] ?? c, dash });
      line([[bx - 8 * Math.cos(t - 0.45), by - 8 * Math.sin(t - 0.45)], [bx, by], [bx - 8 * Math.cos(t + 0.45), by - 8 * Math.sin(t + 0.45)]], { colour: C[c] ?? c });
      return api;
    },
    // a triode centred on p: plate 2 units up, grid 2 left, cathode 2 down
    triode(p, o) {
      o = opts(o);
      const [x, y] = px(p), r = 1.3 * G;
      parts.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${colour(o)}" stroke-width="1.6"/>`);
      line([[x - 10, y - 12], [x + 10, y - 12]], { ...o, width: 2.2 }); line([[x, y - 12], [x, y - 2 * G]], {});
      line([[x - 12, y], [x + 12, y]], { ...o, dash: '3 3' }); line([[x - 12, y], [x - 2 * G, y]], {});
      line([[x - 10, y + 12], [x + 6, y + 12], [x + 6, y + 18]], o); line([[x, y + 12], [x, y + 2 * G]], {});
      if (o.label) text(x + r + 6, y + 4, o.label, { anchor: 'start', colour: o.accent ? C.accent : C.ink });
      return { plate: [p[0], p[1] - 2], grid: [p[0] - 2, p[1]], cathode: [p[0], p[1] + 2] };
    },
    // an NPN transistor (PNP with pnp: true) centred on p: base 2 units left, collector up, emitter down
    npn(p, o) {
      o = opts(o);
      const [x, y] = px(p), r = 1.2 * G;
      parts.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${colour(o)}" stroke-width="1.6"/>`);
      line([[x - 7, y - 11], [x - 7, y + 11]], { ...o, width: 2.4 }); line([[x - 7, y], [x - 2 * G, y]], {});
      line([[x - 7, y - 5], [x + 8, y - 14], [x + 8, y - 2 * G]], o);
      line([[x - 7, y + 5], [x + 8, y + 14], [x + 8, y + 2 * G]], o);
      const [ex, ey, sx, sy] = o.pnp ? [x - 7, y + 5, x + 8, y + 14] : [x + 8, y + 14, x - 7, y + 5];
      const t = Math.atan2(ey - sy, ex - sx), m = [(ex + sx) / 2 + 2 * Math.cos(t), (ey + sy) / 2 + 2 * Math.sin(t)];
      line([[m[0] - 7 * Math.cos(t - 0.5), m[1] - 7 * Math.sin(t - 0.5)], m, [m[0] - 7 * Math.cos(t + 0.5), m[1] - 7 * Math.sin(t + 0.5)]], o);
      if (o.label) text(x + r + 8, y + 4, o.label, { anchor: 'start', colour: o.accent ? C.accent : C.ink });
      return { base: [p[0] - 2, p[1]], collector: [p[0] + 0.4, p[1] - 2], emitter: [p[0] + 0.4, p[1] + 2] };
    },
    // a transformer or gyrator between two windings: a, b the left winding's ends (vertical), and the
    // right winding 2 units to the right; the label between them
    coupling(a, b, o) {
      o = opts(o);
      api.inductor(a, b, {});
      const a2 = [a[0] + 2, a[1]], b2 = [b[0] + 2, b[1]];
      api.inductor(a2, b2, {});
      const [x1, y1] = px(a), [, y2] = px(b);
      if (!o.gyrator) for (const dx of [17, 23]) line([[x1 + dx, y1 + 12], [x1 + dx, y2 - 12]], {});
      if (o.label) text(x1 + G, (y1 + y2) / 2 - (y2 - y1) / 2 - 8, o.label, { colour: o.accent ? C.accent : C.ink });
      return { left: [a, b], right: [a2, b2] };
    },
    svg() {
      const W = w * G, H = h * G;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui, -apple-system, Segoe UI, sans-serif" role="img"${title ? ` aria-label="${esc(title)}"` : ''}>\n` +
        (title ? `<title>${esc(title)}</title>\n` : '') +
        `<rect width="${W}" height="${H}" rx="10" fill="${C.bg}" stroke="${C.line}"/>\n${parts.join('\n')}\n</svg>\n`;
    },
  };
  return api;
}
