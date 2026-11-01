// treadle.js — a rocker pedal on a pedal's face, for the control a foot rocks (the Wah's Rocker):
// the treadle seen from the side, its rubber on top, rocking on its axle over the cast base, heel
// down at 0 and toe down at 1. It is worked as a knob is: drag up or right to rock it toward the
// toe, Shift for fine, a double tap for its default, arrows too. A parameter asks for one with
// `face: 'treadle'`; the pages (shared/shell.js), the Pedalboard and the app's window use it.
//
//   treadleFor(p, get, put, h) → the element; el.refresh() draws get(), el.show(u) draws u for a
//   while instead (the Wah's envelope follower rocking it in Auto), el.show(null) gives it back.

import { toUnit, fromUnit, fmt } from './params.js';

const SVG = 'http://www.w3.org/2000/svg';
const TILT = 9; // degrees either side of level, about a real wah's travel
let ids = 0;

const svg = (tag, attrs = {}, ...kids) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  for (const k of kids) e.append(k);
  return e;
};

// the angle of the treadle for a unit position: heel down (left end low) to toe down (right end low)
export const tiltOf = (u) => -TILT + 2 * TILT * Math.min(1, Math.max(0, u));

export function treadleFor(p, get, put, h) {
  const id = `tr${++ids}`;
  const metal = svg('linearGradient', { id: `${id}m`, x1: 0, y1: 0, x2: 0, y2: 1 },
    svg('stop', { offset: 0, 'stop-color': '#8d8d94' }), svg('stop', { offset: 0.35, 'stop-color': '#4a4a50' }), svg('stop', { offset: 1, 'stop-color': '#1a1a1d' }));
  const cast = svg('linearGradient', { id: `${id}c`, x1: 0, y1: 0, x2: 0, y2: 1 },
    svg('stop', { offset: 0, 'stop-color': '#3c3c42' }), svg('stop', { offset: 1, 'stop-color': '#0c0c0e' }));
  const shine = svg('linearGradient', { id: `${id}s`, x1: 0, y1: 0, x2: 1, y2: 0 },
    svg('stop', { offset: 0, 'stop-color': 'rgb(255 255 255 / 0)' }), svg('stop', { offset: 0.45, 'stop-color': 'rgb(255 255 255 / 0.16)' }), svg('stop', { offset: 1, 'stop-color': 'rgb(255 255 255 / 0)' }));
  // the rubber's ridges, across the treadle
  const ridges = [];
  for (let x = 18; x < 202; x += 6.5) ridges.push(svg('rect', { x, y: 15, width: 3.6, height: 4, rx: 1.2, fill: '#1c1c1f' }));
  // the treadle, about its axle at (110, 40): a casting with rubber on top
  const treadle = svg('g', {},
    svg('path', { d: 'M9 26 Q9 19 16 19 L204 19 Q212 19 212 27 L211 34 Q210 40 203 40 L18 40 Q10 40 9 34 Z', fill: `url(#${id}c)`, stroke: '#000', 'stroke-width': 0.8 }),
    svg('path', { d: 'M12 22 L208 22', stroke: `url(#${id}s)`, 'stroke-width': 1.5 }),
    svg('rect', { x: 14, y: 17, width: 192, height: 5, rx: 2, fill: '#0b0b0c' }), // the rubber
    ...ridges);
  const pic = svg('svg', { viewBox: '0 0 220 84', 'aria-hidden': 'true', focusable: 'false' },
    svg('defs', {}, metal, cast, shine),
    svg('ellipse', { cx: 110, cy: 79, rx: 104, ry: 4, fill: 'rgb(0 0 0 / 0.45)' }), // its shadow
    svg('path', { d: 'M96 58 L103 40 L117 40 L124 58 Z', fill: '#141416' }), // the bracket, between the treadle and the base
    svg('path', { d: 'M11 78 L17 62 Q19 58 26 58 L194 58 Q201 58 203 62 L209 78 Z', fill: `url(#${id}m)`, stroke: '#000', 'stroke-width': 0.8 }), // the base
    svg('path', { d: 'M20 60 L200 60', stroke: `url(#${id}s)`, 'stroke-width': 1.2 }),
    svg('text', { x: 28, y: 73, class: 'tr-end' }, 'HEEL'), svg('text', { x: 192, y: 73, class: 'tr-end', 'text-anchor': 'end' }, 'TOE'),
    treadle,
    svg('circle', { cx: 110, cy: 40, r: 3.4, fill: '#d9d9d9', stroke: '#2a2a2a', 'stroke-width': 1 })); // the axle
  const label = p.label.replace(/\s*\(.*\)$/, '');
  const plate = h('div', { class: 'treadle-pic', role: 'slider', tabindex: 0, 'aria-label': p.label, title: p.hint ?? '', 'aria-valuemin': '0', 'aria-valuemax': '100' }, pic);
  const val = h('div', { class: 'kval' });
  const el = h('div', { class: 'knob treadle', 'data-param': p.id }, plate, h('div', { class: 'klabel' }, label), val);
  let shown = null; // a position drawn instead of get(), while something else rocks it
  const draw = () => {
    const u = shown ?? toUnit(p, get());
    treadle.setAttribute('transform', `rotate(${tiltOf(u).toFixed(2)} 110 40)`);
  };
  el.refresh = () => {
    const u = toUnit(p, get());
    plate.setAttribute('aria-valuetext', fmt(p, get()));
    plate.setAttribute('aria-valuenow', String(Math.round(u * 100)));
    val.textContent = fmt(p, get());
    draw();
  };
  el.show = (u) => { shown = u; draw(); };
  let start = null;
  plate.addEventListener('pointerdown', (e) => { plate.setPointerCapture(e.pointerId); start = { x: e.clientX, y: e.clientY, u: toUnit(p, get()) }; });
  plate.addEventListener('pointermove', (e) => {
    if (!start) return;
    const d = ((e.clientX - start.x) - (e.clientY - start.y)) / (e.shiftKey ? 800 : 200);
    put(fromUnit(p, start.u + d));
  });
  const end = () => { start = null; };
  plate.addEventListener('pointerup', end);
  plate.addEventListener('pointercancel', end);
  plate.addEventListener('dblclick', () => put(p.def));
  plate.addEventListener('keydown', (e) => {
    const step = { ArrowUp: 0.02, ArrowRight: 0.02, ArrowDown: -0.02, ArrowLeft: -0.02 }[e.key];
    if (step) { e.preventDefault(); e.stopPropagation(); put(fromUnit(p, toUnit(p, get()) + step * (e.shiftKey ? 0.25 : 1))); }
  });
  return el;
}
