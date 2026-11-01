// landing.js — the front page: every pedal drawn as itself (shared/face.js: its enclosure, its
// knobs where you left them, its footswitch), on boards by the physics it is made of (registry.js's
// SECTIONS), a row of links to each section, then the rig (the Pedalboard), and the notes of the
// test bass, the tuner, the scope and the spectrum.

import { PEDALS, SECTIONS, PHUZZBOX_VERSION, SOURCE } from './shared/registry.js';
import { BOARD_PEDALS } from './board/src/board-pedals.js';
import { BOARDS } from './board/src/board-params.js';
import { defaults } from './shared/params.js';
import { miniFace } from './shared/face.js';
import { INSTRUMENT_KEY, paramsKey, instrumentDefaults } from './shared/instruments.js';
import { registerApp, offerInstall } from './shared/app.js';
import { howItWorks } from './shared/notes.js';

const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
};
// a pedal's knobs as you left them, for the instrument you play (bass or guitar: shared/instruments.js)
const played = (() => { try { return JSON.parse(localStorage.getItem(INSTRUMENT_KEY) ?? '"bass"'); } catch { return 'bass'; } })();
const stored = (id) => { try { return JSON.parse(localStorage.getItem(paramsKey(id, played)) ?? '{}') ?? {}; } catch { return {}; } };

registerApp();
offerInstall(document.getElementById('install'));
document.getElementById('ver').textContent = PHUZZBOX_VERSION;
document.getElementById('source').href = SOURCE; // the credits' link, the site's only one to GitHub

const about = (href, title, label, glyph = 'i', cls = '') => h('a', { class: `pz-about${cls}`, href, title },
  h('span', { class: `pz-about-i${glyph === 'i' ? '' : ' pz-tour-glyph'}`, 'aria-hidden': 'true' }, glyph), h('span', { class: 'pz-about-label' }, label));

// a pedal: its face opens its page; under it what it is after, a line about it, its tour, How it
// works, and its version
function tile(p) {
  const D = BOARD_PEDALS[p.id];
  const face = D ? miniFace({ h, D, P: { ...instrumentDefaults(D, defaults(D.groups), played), ...stored(p.id) }, enclosure: p.enclosure }) : h('div', { class: 'pedal face blank' }, h('div', { class: 'name' }, h('span', {}, p.name)));
  const el = h('article', { class: `tile${p.ready ? '' : ' soon'}`, 'data-pedal': p.id });
  el.append(
    p.ready ? h('a', { class: 'go', href: `${p.id}/`, 'aria-label': `${p.name}: open the pedal` }, face) : face,
    h('div', { class: 'tile-text' },
      h('h3', {}, p.ready ? h('a', { href: `${p.id}/` }, p.name) : p.name, h('span', { class: 'ver', title: `${p.name} ${p.version}; PhuzzBox ${PHUZZBOX_VERSION}` }, `v${p.version}`)),
      h('small', {}, `after ${p.after}`),
      h('p', {}, p.blurb),
      p.ready
        ? h('div', { class: 'more' },
          about(`${p.id}/#tour`, 'A guided tour of the physics, played on the test bass', 'Tour', '▶', ' pz-tour-start'),
          about(`${p.id}/#about`, `The physics of the ${p.name}`, 'How it works'))
        : h('span', { class: 'tag' }, 'in the workshop')));
  return el;
}

// the Pedalboard: a board with a chain of little enclosures on it, as its first board has them
function boardTile() {
  const [first] = Object.values(BOARDS);
  const chips = first.map(([id]) => {
    const p = PEDALS.find((q) => q.id === id);
    const c = h('span', { class: 'chip' }, h('i', {}), h('b', {}, p.name));
    c.style.setProperty('--enclosure', p.enclosure[0]);
    c.style.setProperty('--enclosure-ink', p.enclosure[1]);
    return c;
  });
  const art = h('div', { class: 'board-art', 'aria-hidden': 'true' }, h('span', { class: 'end' }, 'bass'), ...chips, h('span', { class: 'end' }, 'amp'));
  return h('article', { class: 'tile wide', 'data-pedal': 'board' },
    h('a', { class: 'go', href: 'board/', 'aria-label': 'Pedalboard: open it' }, art),
    h('div', { class: 'tile-text' },
      h('h3', {}, h('a', { href: 'board/' }, 'Pedalboard')),
      h('small', {}, 'every pedal here, in a chain'),
      h('p', {}, 'Chain the pedals from your bass to the amp. The ones whose circuits include their jacks load the pedal before them and drive the one after through real cables, so a fuzz first feels your pickup, and after a buffer it doesn\'t.'),
      h('div', { class: 'more' }, about('board/#about', 'How the Pedalboard wires its pedals', 'How it works'))));
}

// the sections, and the row of links to them
const main = document.getElementById('pedals'), cats = document.getElementById('cats');
const sections = [
  ...SECTIONS.map((s) => ({ ...s, list: PEDALS.filter((p) => p.section === s.id) })).filter((s) => s.list.length),
  { id: 'rig', title: 'The rig', short: 'Rig', blurb: 'The pedals together, as on a real board.', board: true },
];
for (const s of sections) {
  const n = s.board ? 1 : s.list.filter((p) => p.ready).length;
  cats.append(h('a', { href: `#${s.id}`, title: s.title }, s.short, h('span', { class: 'n' }, String(n))));
  main.append(h('section', { class: 'sec', id: s.id, 'aria-labelledby': `${s.id}-h` },
    h('div', { class: 'sec-head' }, h('h2', { id: `${s.id}-h` }, s.title), h('p', {}, s.blurb)),
    h('div', { class: 'boardwalk' }, ...(s.board ? [boardTile()] : s.list.map(tile)))));
}

// the test bass's, the test guitar's, the tuner's, the scope's and the spectrum's notes, in the pedals' dialog
const notes = howItWorks();
for (const [key, label] of [['testbass', 'The test bass'], ['testguitar', 'The test guitar'], ['tuner', 'The tuner'], ['scope', 'The scope'], ['spectrum', 'The spectrum']]) document.getElementById('also').append(notes.button(key, label));
