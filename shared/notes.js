// notes.js — How it works: a README rendered in a dialog, as Forte's pages have it, so the physics
// is one tap from the pedal. On a pedal's page the dialog has three tabs: the pedal's own README,
// the test bass's (testbass/README.md) and the tuner's (tuner/README.md), since every page plays
// the one and shows the other. The landing page opens the test bass's and the tuner's.
// A README's "Files" section (for developers) is left out, and its links point at the repository.
// Hashes open it straight away: …/#about (the pedal), #testbass, #tuner.
//
//   const notes = howItWorks({ pedal: { id, name, version } });   // on a pedal's page
//   notes.button(key?, label?)        a "How it works" button (for the header, or for one of them)
//   notes.open('pedal' | 'testbass' | 'tuner')

import { renderMarkdown } from './markdown.js';

const REPO = 'https://github.com/jdthaler/phuzzbox/blob/live/';
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
    { key: 'tuner', hash: '#tuner', name: 'Tuner', dir: 'tuner/' },
  ];
  const what = { pedal: 'pedal', testbass: 'bass made of physics', tuner: 'tuner' };
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
    // the contents' own links scroll within the notes, a README's links to its own sections too
    body.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || !at) return;
      const href = a.getAttribute('href'), own = `${REPO}${at.dir}README.md#`;
      const id = href.startsWith('#') ? href.slice(1) : href.startsWith(own) ? `about-${href.slice(own.length)}` : null;
      if (id === null) return;
      e.preventDefault();
      body.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    document.body.append(dialog);
  }

  function load(d) {
    if (!loaded.has(d.key)) {
      loaded.set(d.key, fetch(new URL(`${d.dir}README.md`, SITE))
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
        .then((md) => {
          // the README's line for GitHub readers says nothing on the page itself
          md = md.replace(/^Part of \[Phuzzbox\]\([^)]*\)\.?[ \t]*\n/m, '');
          const { html, sections } = renderMarkdown(md, { base: REPO + d.dir, skip: ['Files'], idPrefix: 'about-' });
          const toc = sections.length > 2
            ? `<nav class="pz-notes-toc" aria-label="Contents">${sections.map((s) => `<a href="#${s.id}">${esc(s.text)}</a>`).join('')}</nav>`
            : '';
          return `${toc}<article class="pz-notes-text">${html}</article>
            <p class="pz-notes-src">These notes are this ${what[d.key]}'s <a href="${REPO}${d.dir}README.md" target="_blank" rel="noopener">README</a>, beside its source code.</p>`;
        })
        .catch(() => {
          loaded.delete(d.key); // try again next time
          return `<p class="pz-notes-status">The notes didn't load. Read them on <a href="${REPO}${d.dir}README.md" target="_blank" rel="noopener">GitHub</a>.</p>`;
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
    b.title = d.key === 'pedal' ? `The physics of the ${pedal.name}, the test bass and the tuner` : `How the ${d.name.toLowerCase()} works`;
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
