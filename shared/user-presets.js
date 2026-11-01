// user-presets.js — your own presets on every pedal page, in the Presets menu beside the
// factory ones (as Forte's shared/user-presets.js):
//   Your presets               the ones saved in this browser: pick one to play it
//   Save these settings…       names them and saves them in this browser
//   Copy a link to these settings
//                              a link that opens the page with them (shared/presets.js)
//   Your presets and files…    the list (play, link, save to a file, delete), and opening a
//                              preset file
// Opening a link made that way applies its settings and takes them off the address.
//
//   attachPresets({ PEDAL, version, sel, get: () => P, set: (values) => …, store })
// sel is the page's Presets menu; get gives the page's parameters; set takes every parameter's
// value by id and applies them as choosing a preset does; store is the page's localStorage wrapper.

import { presetParams, presetFile, readPresetFile, linkHash, readLinkHash, complete, cleanName } from './presets.js';
import { PEDALS } from './registry.js';
import { notesStyle } from './notes.js';

const NAMES = Object.fromEntries(PEDALS.map((p) => [p.id, p.name]));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fileName = (s) => `${s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').trim() || 'PhuzzBox preset'}.json`;
const USER = '__user:';

// a short message at the foot of the screen
let toastEl = null, toastTimer = 0;
export function toast(text) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'pz-toast';
    toastEl.setAttribute('role', 'status');
    document.body.append(toastEl);
  }
  toastEl.textContent = text;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('on'), 4500);
}

export function attachPresets({ PEDAL, version, sel, get, set, store }) {
  notesStyle();
  const params = presetParams(PEDAL);
  const name = PEDAL.name;
  const KEY = `phuzzbox.${PEDAL.id}.presets`;
  const now = () => complete(params, get());

  // ---- this browser's presets ----------------------------------------------------------------
  const load = () => {
    const s = store.get(KEY, []);
    return (Array.isArray(s) ? s : [])
      .filter((pr) => pr && typeof pr.name === 'string' && pr.values && typeof pr.values === 'object')
      .map((pr) => ({ name: cleanName(pr.name) || 'Preset', values: complete(params, pr.values) }));
  };
  let mine = load();
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(mine)); return true; } catch { toast('This browser won’t keep presets (its storage is off or full).'); return false; }
  };
  const find = (n) => mine.findIndex((pr) => pr.name.toLowerCase() === n.toLowerCase());
  // the name of the preset playing now, while the sound is still that preset's
  let playing = '', playingValues = null;
  const playingNow = (n, v) => { playing = n; playingValues = JSON.stringify(v); };
  const current = () => (playing && playingValues === JSON.stringify(now()) ? playing : '');

  // ---- the menu ----------------------------------------------------------------------------------
  const group = (label) => { const g = document.createElement('optgroup'); g.label = label; return g; };
  const yours = group('Your presets'), actions = group('Save and share');
  actions.append(new Option('Save these settings…', '__save'), new Option('Copy a link to these settings', '__link'), new Option('Your presets and files…', '__mine'));
  sel.append(actions);
  function menu() { // "Your presets" only while there are some (an empty group still shows its name)
    yours.replaceChildren(...mine.map((pr, i) => new Option(pr.name, USER + i)));
    if (mine.length) sel.insertBefore(yours, actions); else yours.remove();
    sel.value = '';
  }
  menu();

  // Before the page's own listener: these choices are not factory presets.
  document.addEventListener('change', (e) => {
    if (e.target !== sel || !sel.value.startsWith('__') || sel.value === '__defaults') return;
    e.stopImmediatePropagation();
    const v = sel.value;
    sel.value = '';
    sel.blur();
    if (v.startsWith(USER)) play(mine[+v.slice(USER.length)]);
    else if (v === '__save') openSheet({ save: true });
    else if (v === '__link') copyLink(now(), current());
    else if (v === '__mine') openSheet({});
  }, true);

  function play(pr) {
    if (!pr) return;
    set(complete(params, pr.values));
    playingNow(pr.name, complete(params, pr.values));
    toast(`Playing “${pr.name}”.`);
  }

  // ---- links ---------------------------------------------------------------------------------------
  const link = (vals, n) => `${location.origin}${location.pathname}${linkHash(params, vals, n)}`;
  async function copyLink(vals, n) {
    const url = link(vals, n);
    try {
      await navigator.clipboard.writeText(url);
      toast(`Link copied. It opens the ${name} with ${n ? `“${n}”` : 'these settings'}.`);
    } catch { openSheet({ url }); } // no clipboard (or no permission): show it to copy by hand
  }
  function fromLink() {
    const got = readLinkHash(location.hash, params);
    if (!got) return;
    history.replaceState(null, '', location.pathname + location.search);
    set(got.values);
    playingNow(got.name, got.values);
    toast(`Playing ${got.name ? `“${got.name}”` : 'the settings from the link'}. To keep them, save them from the Presets menu.`);
  }
  addEventListener('hashchange', fromLink);
  setTimeout(fromLink); // once the page has finished setting itself up

  // ---- files -------------------------------------------------------------------------------------
  function download(presets, file) {
    const blob = new Blob([presetFile(PEDAL, version, presets)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = fileName(file);
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }
  // a file's presets join yours (a name already taken gets a number); one alone plays at once
  async function open(file) {
    const { presets, warning } = readPresetFile(await file.text(), PEDAL, NAMES);
    let added = 0, first = null;
    for (const pr of presets) {
      const same = mine.find((m) => m.name.toLowerCase() === pr.name.toLowerCase());
      if (same && JSON.stringify(same.values) === JSON.stringify(pr.values)) { first ??= same; continue; }
      let n = pr.name;
      for (let k = 2; find(n) >= 0; k++) n = `${pr.name} ${k}`;
      const entry = { name: n, values: pr.values };
      mine.push(entry); added++; first ??= entry;
    }
    save(); menu();
    return { presets, added, first, warning };
  }

  // ---- the dialog: save, your presets, files and a link --------------------------------------------
  let d = null, msg = null;
  function build() {
    d = document.createElement('dialog');
    d.className = 'pz-notes pz-sheet';
    d.setAttribute('aria-labelledby', 'pz-presets-title');
    d.innerHTML = `
      <div class="pz-notes-bar">
        <div class="pz-notes-head"><span class="pz-notes-kicker">Presets</span><h2 id="pz-presets-title">${esc(name)}</h2></div>
        <button type="button" class="pz-notes-close">Close ✕</button>
      </div>
      <div class="pz-notes-body"><section class="pz-mypresets">
        <form class="pz-mypresets-save">
          <label for="pz-preset-name">Save these settings as</label>
          <div class="pz-mypresets-row"><input id="pz-preset-name" type="text" maxlength="80" autocomplete="off" enterkeyhint="done" placeholder="A name"><button type="submit" class="primary">Save</button></div>
        </form>
        <p class="pz-mypresets-msg" role="status"></p>
        <div class="pz-mypresets-link" hidden>
          <label for="pz-preset-link">A link to these settings</label>
          <div class="pz-mypresets-row"><input id="pz-preset-link" type="text" readonly><button type="button" data-act="copy">Copy</button><button type="button" data-act="share" hidden>Share…</button></div>
        </div>
        <h3>Your presets</h3>
        <ul class="pz-mypresets-list"></ul>
        <div class="pz-mypresets-files">
          <button type="button" data-act="open">Open a preset file…</button>
          <button type="button" data-act="all">Save all to a file</button>
          <input type="file" accept=".json,application/json" hidden>
        </div>
        <p class="pz-mypresets-more">Your presets stay in this browser. Save them to a file to keep them safe or to move them to another browser or computer. A link carries the settings themselves, so whoever opens it hears the ${esc(name)} as you set it.</p>
      </section></div>`;
    document.body.append(d);
    d.querySelector('.pz-notes-close').addEventListener('click', () => d.close());
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); }); // the backdrop
    // keys typed here don't play the test bass or press the footswitch
    d.addEventListener('keydown', (e) => e.stopPropagation());
    d.addEventListener('keyup', (e) => e.stopPropagation());
    const body = d.querySelector('.pz-notes-body');
    msg = body.querySelector('.pz-mypresets-msg');
    const input = body.querySelector('#pz-preset-name'), picker = body.querySelector('input[type=file]');
    body.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const n = cleanName(input.value);
      if (!n) { say('Give the preset a name.'); input.focus(); return; }
      const k = find(n);
      if (k >= 0 && !confirm(`Replace your preset “${mine[k].name}”?`)) return;
      const entry = { name: n, values: now() };
      if (k >= 0) mine[k] = entry; else mine.push(entry);
      if (!save()) return;
      menu();
      playingNow(n, entry.values);
      d.close();
      toast(`Saved “${n}” in this browser.`);
    });
    body.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      const act = b.dataset.act, k = +b.closest('li')?.dataset.k;
      if (act === 'play') { play(mine[k]); d.close(); }
      else if (act === 'link') showLink(link(mine[k].values, mine[k].name));
      else if (act === 'file') download([mine[k]], `${name} - ${mine[k].name}`);
      else if (act === 'delete') {
        if (!confirm(`Delete your preset “${mine[k].name}”?`)) return;
        mine.splice(k, 1); save(); menu(); list();
      } else if (act === 'open') picker.click();
      else if (act === 'all') { if (mine.length) download(mine, `${name} presets`); else say('There are no presets of yours to save yet.'); }
      else if (act === 'copy') {
        const f = body.querySelector('#pz-preset-link');
        try { await navigator.clipboard.writeText(f.value); say('Link copied.'); } catch { f.select(); say('Copy the link from the box.'); }
      } else if (act === 'share') navigator.share?.({ title: name, url: body.querySelector('#pz-preset-link').value }).catch(() => {});
    });
    picker.addEventListener('change', async () => {
      const f = picker.files?.[0];
      picker.value = '';
      if (!f) return;
      try {
        const r = await open(f);
        list();
        if (r.presets.length === 1) { play(r.first); d.close(); return; }
        say(`${r.added ? `Added ${r.added} of the file’s ${r.presets.length} presets.` : 'You have every preset in that file already.'}${r.warning ? ` ${r.warning}` : ''}`);
      } catch (err) { say(err.message); }
    });
  }
  function say(t) { msg.textContent = t; }
  function showLink(url) {
    const box = d.querySelector('.pz-mypresets-link');
    box.hidden = false;
    box.querySelector('input').value = url;
    box.querySelector('[data-act=share]').hidden = !navigator.share;
  }
  function list() {
    const ul = d.querySelector('.pz-mypresets-list');
    ul.innerHTML = mine.length
      ? mine.map((pr, k) => `<li data-k="${k}"><button type="button" class="pz-mypresets-name ghost" data-act="play" title="Play it">${esc(pr.name)}</button>
          <span class="pz-mypresets-acts"><button type="button" data-act="link" title="A link to it">Link</button><button type="button" data-act="file" title="Save it to a file">File</button><button type="button" data-act="delete" title="Delete it">Delete</button></span></li>`).join('')
      : '<li class="pz-mypresets-none">None yet. Set the controls the way you like, then save them above.</li>';
  }
  function openSheet({ save: saving = false, url = '' }) {
    if (!d) build();
    say('');
    d.querySelector('.pz-mypresets-link').hidden = true;
    if (url) showLink(url);
    list();
    const input = d.querySelector('#pz-preset-name');
    input.value = current();
    d.showModal();
    if (saving) { input.focus(); input.select(); }
  }

  return { params, open: openSheet, copyLink, presets: () => mine.map((pr) => ({ ...pr })) };
}
