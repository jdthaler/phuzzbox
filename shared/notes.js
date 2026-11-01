// notes.js — How it works: a README rendered in a dialog, as Forte's pages have it, so the physics
// is one tap from the pedal. On a pedal's page the dialog has a tab for the pedal's own README and
// one for each thing every page has: the test bass (testbass/README.md) and guitar
// (testguitar/README.md), the tuner
// (tuner/README.md), the scope (scope/README.md) and the spectrum (spectrum/README.md). The landing
// page opens all but the pedal's.
// A README's "Files" section (for developers) is left out. The notes link only to the site and to
// sources elsewhere (papers, standards), never to the repository for information (Jesse,
// 2026-11-01): a link to another README opens its notes (the tab, or that pedal's page), a link to
// any other file of the repository is left as plain text, and the credits link to the source.
// Hashes open it straight away: …/#about (the pedal), #testbass, #testguitar, #tuner, #scope, #spectrum.
//
//   const notes = howItWorks({ pedal: { id, name, version } });   // on a pedal's page
//   notes.button(key?, label?)        a "How it works" button (for the header, or for one of them)
//   notes.open('pedal' | 'testbass' | 'testguitar' | 'tuner' | 'scope' | 'spectrum')

import { renderMarkdown } from './markdown.js';

const SITE = new URL('../', import.meta.url); // the site's root, wherever it is served
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// the notes.css that styles the dialog, the buttons and the tour, once per page
export function notesStyle() {
  const href = new URL('./notes.css', import.meta.url).href;
  if ([...document.querySelectorAll('link[rel=stylesheet]')].some((l) => l.href === href)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

export function howItWorks({ pedal = null } = {}) {
  notesStyle();
  const docs = [
    ...(pedal ? [{ key: 'pedal', hash: '#about', name: pedal.name, dir: `${pedal.id}/`, version: pedal.version }] : []),
    { key: 'testbass', hash: '#testbass', name: 'Test bass', dir: 'testbass/' },
    { key: 'testguitar', hash: '#testguitar', name: 'Test guitar', dir: 'testguitar/' },
    { key: 'tuner', hash: '#tuner', name: 'Tuner', dir: 'tuner/' },
    { key: 'scope', hash: '#scope', name: 'Scope', dir: 'scope/' },
    { key: 'spectrum', hash: '#spectrum', name: 'Spectrum', dir: 'spectrum/' },
  ];
  let dialog = null, body = null, heading = null, ver = null, tabs = [], at = null;
  const loaded = new Map();

  function build() {
    dialog = document.createElement('dialog');
    dialog.className = 'pz-notes';
    dialog.setAttribute('aria-labelledby', 'pz-notes-title');
    dialog.innerHTML = `
      <div class="pz-notes-bar">
        <div class="pz-notes-head"><span class="pz-notes-kicker">How it works</span><span class="pz-notes-ver"></span><h2 id="pz-notes-title"></h2></div>
        <button type="button" class="pz-notes-close">Close ✕</button>
      </div>
      <div class="pz-notes-tabs" role="tablist" aria-label="Notes"></div>
      <div class="pz-notes-body" tabindex="-1"></div>`;
    heading = dialog.querySelector('h2');
    ver = dialog.querySelector('.pz-notes-ver');
    body = dialog.querySelector('.pz-notes-body');
    const tabRow = dialog.querySelector('.pz-notes-tabs');
    tabs = docs.map((d) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.textContent = d.name;
      b.addEventListener('click', () => open(d.key));
      tabRow.append(b);
      return b;
    });
    if (docs.length < 2) tabRow.hidden = true;
    dialog.querySelector('.pz-notes-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // the backdrop
    // keys pressed in the notes scroll them; they don't play the test bass or press the footswitch
    const pressed = new Set();
    dialog.addEventListener('keydown', (e) => { pressed.add(e.code); e.stopPropagation(); });
    dialog.addEventListener('keyup', (e) => { if (pressed.delete(e.code)) e.stopPropagation(); });
    dialog.addEventListener('close', () => {
      pressed.clear();
      if (docs.some((d) => d.hash === location.hash)) history.replaceState(null, '', location.pathname + location.search);
    });
    // the contents' own links stay in the notes: to a section, or to another tab and its section
    body.addEventListener('click', async (e) => {
      const a = e.target.closest('a[href]');
      if (!a || !at) return;
      const href = a.getAttribute('href');
      const doc = href.startsWith('#') ? at.key : a.dataset.doc;
      if (!doc) return;
      e.preventDefault();
      const id = href.startsWith('#') ? href.slice(1) : a.dataset.at ? `about-${a.dataset.at}` : null;
      if (doc !== at.key) await open(doc);
      if (id) body.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    document.body.append(dialog);
  }

  // A README's links, made the site's: one to a README whose notes are tabs here opens that tab
  // (data-doc, and data-at its section); one to another pedal's README opens that pedal's page at
  // its notes; one to any other file of the site's repository, or to GitHub, becomes plain text;
  // the rest (papers, standards, other sites) open in a new tab.
  function siteLinks(html, d) {
    const t = document.createElement('template');
    t.innerHTML = html;
    for (const a of t.content.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href');
      if (href.startsWith('#')) continue;
      let u;
      try { u = new URL(href); } catch { continue; }
      const site = u.origin === SITE.origin && u.pathname.startsWith(SITE.pathname);
      if (!site) {
        if (!/(^|\.)github\.com$/.test(u.hostname)) continue;
        a.replaceWith(...a.childNodes);
        continue;
      }
      const rel = u.pathname.slice(SITE.pathname.length); // e.g. 'tuner/README.md', 'phuzz/', 'shared/x.js'
      const dir = rel.replace(/README\.md$/, '');
      const anchor = u.hash.slice(1);
      const tab = (rel.endsWith('README.md') || rel === d.dir) ? docs.find((x) => x.dir === dir) : null;
      a.removeAttribute('target'); a.removeAttribute('rel');
      if (tab) { a.dataset.doc = tab.key; if (anchor) a.dataset.at = anchor; a.setAttribute('href', `${location.pathname}${location.search}${tab.hash}`); }
      else if (/^[a-z0-9-]+\/README\.md$/.test(rel)) a.setAttribute('href', `${SITE.pathname}${dir}#about`); // another pedal's page
      else if (rel === 'README.md' || rel === '') a.setAttribute('href', SITE.pathname); // the landing page
      else a.replaceWith(...a.childNodes);
    }
    return t.innerHTML;
  }

  function load(d) {
    if (!loaded.has(d.key)) {
      loaded.set(d.key, fetch(new URL(`${d.dir}README.md`, SITE))
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
        .then((md) => {
          // the README's line for GitHub readers says nothing on the page itself
          md = md.replace(/^Part of \[Phuzz[Bb]ox\]\([^)]*\)\.?[ \t]*\n/m, '');
          const { html, sections } = renderMarkdown(md, { base: new URL(d.dir, SITE).href, skip: ['Files'], idPrefix: 'about-' });
          const toc = sections.length > 2
            ? `<nav class="pz-notes-toc" aria-label="Contents">${sections.map((s) => `<a href="#${s.id}">${esc(s.text)}</a>`).join('')}</nav>`
            : '';
          return `${toc}<article class="pz-notes-text">${siteLinks(html, d)}</article>`;
        })
        .catch(() => {
          loaded.delete(d.key); // try again next time
          return '<p class="pz-notes-status">The notes didn\'t load. Close them and try again once the page can reach the site.</p>';
        }));
    }
    return loaded.get(d.key);
  }

  async function open(key = docs[0].key) {
    if (!dialog) build();
    const d = docs.find((x) => x.key === key) ?? docs[0];
    at = d;
    heading.textContent = d.name;
    ver.textContent = d.version ? `v${d.version}` : '';
    tabs.forEach((t, i) => t.setAttribute('aria-selected', String(docs[i] === d)));
    if (!dialog.open) { if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', ''); }
    if (location.hash !== d.hash) history.replaceState(null, '', d.hash);
    body.innerHTML = '<p class="pz-notes-status">Loading…</p>';
    const html = await load(d);
    if (at !== d) return;
    body.innerHTML = html;
    body.scrollTop = 0;
    body.focus({ preventScroll: true });
  }

  // a button that opens the notes (`key` one of them; `label` what it says)
  function button(key = docs[0].key, label = 'How it works') {
    const d = docs.find((x) => x.key === key) ?? docs[0];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pz-about';
    b.title = d.key === 'pedal' ? `The physics of the ${pedal.name}, the test bass, the tuner, the scope and the spectrum` : `How the ${d.name.toLowerCase()} works`;
    b.setAttribute('aria-label', label === 'How it works' ? label : `How it works: ${label}`);
    b.innerHTML = '<span class="pz-about-i" aria-hidden="true">i</span><span class="pz-about-label"></span>';
    b.querySelector('.pz-about-label').textContent = label;
    b.addEventListener('click', () => open(d.key));
    return b;
  }

  const fromHash = () => { const d = docs.find((x) => x.hash === location.hash); if (d) open(d.key); };
  addEventListener('hashchange', fromHash);
  queueMicrotask(fromHash);
  return { open, button, docs };
}
