// face.js — a pedal's face as a picture, for the landing page: its enclosure in its colours, its
// name, and the LED and footswitch, drawn with the same parts as the page's face (shared/pedal.css)
// but no knobs, so a board of them stays small (Jesse, 2026-11-01); its page has the knobs.
//
//   miniFace({ h, D: the descriptor, enclosure: [colour, ink], name, after })

export function miniFace({ h, D, enclosure: [enc, ink] = ['#3f6f5a', '#f5f1e8'], name = D.name, after = '' }) {
  const face = h('div', { class: 'pedal face', 'aria-hidden': 'true' },
    h('div', { class: 'name' }, h('span', {}, name), after ? h('small', {}, after) : null),
    h('div', { class: 'switchrow' }, h('span', { class: 'led on' }), h('span', { class: 'footswitch' })));
  face.style.setProperty('--enclosure', enc);
  face.style.setProperty('--enclosure-ink', ink);
  return face;
}
