// face.js — a pedal's face as a picture, for the landing page: its enclosure in its colours, its
// knobs (its `perform` controls) where they are set, its name, and the LED and footswitch, drawn
// with the same parts as the page's face (shared/pedal.css) but nothing to turn.
//
//   miniFace({ h, D: the descriptor, P: the values to show, enclosure: [colour, ink], name, after })

import { params, fmt, toUnit } from './params.js';

export function miniFace({ h, D, P, enclosure: [enc, ink] = ['#3f6f5a', '#f5f1e8'], name = D.name, after = '' }) {
  const knobs = h('div', { class: 'knobs' });
  for (const p of params(D.groups).filter((q) => q.perform && q.type !== 'select')) {
    const label = p.label.replace(/\s*\(.*\)$/, '');
    if (p.type === 'checkbox') {
      knobs.append(h('div', { class: 'knob toggle' },
        h('span', { class: 'rocker', 'aria-pressed': String(!!P[p.id]) }, h('span', { class: 'rocker-led' })),
        h('div', { class: 'klabel' }, label), h('div', { class: 'kval' }, P[p.id] ? 'on' : 'off')));
      continue;
    }
    const u = Math.min(1, Math.max(0, toUnit(p, P[p.id])));
    const dial = h('span', { class: 'dial' }, h('span', { class: 'mark' }));
    dial.style.setProperty('--turn', `${-135 + 270 * u}deg`);
    knobs.append(h('div', { class: 'knob' }, dial, h('div', { class: 'klabel' }, label), h('div', { class: 'kval' }, fmt(p, P[p.id]))));
  }
  const face = h('div', { class: 'pedal face', 'aria-hidden': 'true' },
    knobs,
    h('div', { class: 'name' }, h('span', {}, name), after ? h('small', {}, after) : null),
    h('div', { class: 'switchrow' }, h('span', { class: 'led on' }), h('span', { class: 'footswitch' })));
  face.style.setProperty('--enclosure', enc);
  face.style.setProperty('--enclosure-ink', ink);
  return face;
}
