// nav.js — the one menu at the top left of every page, as Forte's (shared/nav.js there): its button
// is PhuzzBox's mark and the pedal's name; it opens on the landing page, every pedal by the physics
// it is made of (registry.js's SECTIONS), the Pedalboard, and the credits with the site's only link
// to GitHub. Each pedal carries a dot of its enclosure's colour.
//
//   const menu = navMenu({ h, here: 'phuzz', title: 'Phuzz', root: '../' })   → a <details>

import { PEDALS, SECTIONS, PHUZZBOX_VERSION, SOURCE } from './registry.js';

export const BOARD = { id: 'board', name: 'Pedalboard', after: 'the pedals in a chain, each loading the next' };

export function navMenu({ h, here, title, root = '../' }) {
  const item = (p, extra = '') => h('a', { href: `${root}${p.id}/`, class: `menu-item${extra}`, 'aria-current': p.id === here ? 'page' : false, style: p.enclosure ? `--dot:${p.enclosure[0]}` : false },
    h('i', { 'aria-hidden': 'true' }), h('b', {}, p.name), h('small', {}, p.after));
  const menu = h('details', { class: 'pedal-menu' },
    h('summary', { title: 'PhuzzBox: every pedal, and the home page' },
      h('span', { class: 'pz-mark', 'aria-hidden': 'true' }), h('h1', {}, title), h('span', { class: 'caret', 'aria-hidden': 'true' }, '▾')),
    h('div', { class: 'menu-list' },
      h('a', { href: root, class: 'menu-home' }, h('b', {}, 'PhuzzBox'), h('small', {}, 'Every pedal, and what PhuzzBox is')),
      ...SECTIONS.flatMap((s) => {
        const list = PEDALS.filter((p) => p.ready && p.section === s.id);
        return list.length ? [h('div', { class: 'menu-sec', title: s.blurb }, s.title), ...list.map((p) => item(p))] : [];
      }),
      h('div', { class: 'menu-sec' }, 'The rig'),
      item(BOARD, ' menu-board'),
      // the credits, with the site's only link to GitHub
      h('div', { class: 'menu-foot' }, `PhuzzBox ${PHUZZBOX_VERSION} · Vibe coded by Jesse Thaler · `, h('a', { href: SOURCE, target: '_blank', rel: 'noopener' }, 'source'))));
  // it closes on a click elsewhere, and on Escape (the focus back on its button)
  addEventListener('pointerdown', (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); } });
  return menu;
}
