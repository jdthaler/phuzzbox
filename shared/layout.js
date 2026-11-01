// layout.js — the layout of every pedal page, after Forte's (github.com/jdthaler/forte,
// shared/layout.js): the page fills the screen, with nothing to scroll but the panels themselves.
//
//   header    Phuzzbox, the pedal's name (the menu of pedals), How it works; audio on the right
//   rack      the pedal itself, on the left, the height of the page (a toggle in the views' bar)
//   views     a bar, then the views turned on, sharing the room in rows. The bar has a toggle for
//             each (the pedal, the tuner and the page's views), then Discover | Perform and a
//             button that folds the views away
//   controls  a bar, then the Controls panel: the pedal's groups of parameters, the rig (the
//             interface and Full scale) and the MIDI pedals, side by side. The bar has a toggle
//             for each group, the presets and a fold button; its top edge is a handle that shares
//             the height between the views and the controls
//   dock      the test bass, pinned to the bottom, shown while it is the input
//
// Perform is for playing: the views turned on fill the room with no captions and no text drawn
// on their canvases, the Controls panel folded away until More controls. A phone has no room to
// share: there the page scrolls, the rack and the views above the controls, the dock stuck to the
// bottom. What is turned on is remembered per pedal; the mode and the share for every pedal.
//
//   const layout = createLayout({ id, h, store, app, header, rack, views, groups, presets, dock })
//   views  = [{ key, name, card, on }]   (on: shown at first)
//   groups = [{ key, name, el }]
//   returns { showViews(names | null), viewNames(), tourSlot, arrange() }

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const CHEVRON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 6 8 10.5 12.5 6"/></svg>';
const SHARE = 0.6; // the views' usual share of the room the views and the controls have
const phoneQuery = matchMedia('(max-width: 600px), (max-width: 1050px) and (max-height: 500px)'); // as layout.css

export function createLayout({ id, h, store, app, header, rack, views, groups, presets, dock }) {
  const body = document.body;
  body.classList.add('one-screen');
  const KEY = `phuzzbox.${id}.layout`;
  const saved = store.get(KEY, {}) ?? {};
  const flags = (o) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([, v]) => typeof v === 'boolean'));
  const prefs = { views: flags(saved.views), groups: flags(saved.groups), moreControls: saved.moreControls === true };
  const save = () => store.set(KEY, prefs);
  const split = (() => {
    const s = store.get('phuzzbox.split', {}) ?? {};
    const ok = (v, d, ends) => (Number.isFinite(v) && v >= 0 && v <= 1 && (ends || (v > 0 && v < 1)) ? v : d);
    return { views: ok(s.views, SHARE, true), open: ok(s.open, SHARE, false) };
  })();
  const saveSplit = () => store.set('phuzzbox.split', split);
  let mode = store.get('phuzzbox.mode', 'discover') === 'perform' ? 'perform' : 'discover';
  const performing = () => mode === 'perform';
  let touring = null; // a tour's views, shown for a while without changing the player's choice

  // ---- the bars
  function bar(kind, label, panel) {
    const row = h('div', { class: 'toggles', role: 'group', 'aria-label': `${label} to show` }, h('span', { class: 'toggles-label' }, label));
    const tools = h('div', { class: 'bar-tools' });
    const fold = h('button', { type: 'button', class: 'fold', 'aria-controls': panel.id });
    fold.innerHTML = CHEVRON;
    const el = h('div', { class: `bar ${kind}-bar` }, row, tools, fold);
    return { el, row, tools, fold };
  }
  const toggle = (name, title, on, click) => {
    const b = h('button', { type: 'button', 'aria-pressed': String(on), title }, name);
    b.addEventListener('click', () => { click(); b.blur(); });
    return b;
  };

  // ---- the views: the rack (the pedal) first, then the cards in a stage
  const viewsEl = h('section', { class: 'views', id: 'views', 'aria-label': 'Views' });
  const stage = h('div', { class: 'view-grid' });
  const noView = h('p', { class: 'no-view', hidden: true }, 'Every view is off: turn one on above.');
  stage.append(...views.map((v) => v.card), noView);
  viewsEl.append(stage);
  const pedalView = { key: 'pedal', name: 'Pedal', card: rack, on: true };
  const all = [pedalView, ...views];
  for (const v of all) v.shown = () => (touring && v !== pedalView ? touring.has(v.name.toLowerCase()) : prefs.views[v.key] ?? v.on);
  const vbar = bar('views', 'Views', viewsEl);
  for (const v of all) {
    v.toggle = toggle(v.name, 'Show or hide this view', v.shown(), () => {
      if (touring && v !== pedalView) { const n = v.name.toLowerCase(); if (!touring.delete(n)) touring.add(n); } else { prefs.views[v.key] = !v.shown(); save(); }
      apply();
    });
    vbar.row.append(v.toggle);
  }
  // Discover | Perform
  const modeBtns = ['discover', 'perform'].map((m) => toggle(m === 'discover' ? 'Discover' : 'Perform',
    m === 'discover' ? 'Every view with its explanations, and the Controls panel' : 'The views fill the room, with no text in them; the controls wait behind More controls',
    mode === m, () => { mode = m; store.set('phuzzbox.mode', m); apply(); }));
  vbar.tools.append(h('div', { class: 'mode', role: 'group', 'aria-label': 'Mode' }, ...modeBtns));

  // ---- the controls
  const controlsEl = h('section', { class: 'controls', id: 'controls', 'aria-label': 'Controls' });
  const noGroup = h('p', { class: 'no-view', hidden: true }, 'Every group of controls is off: turn one on above.');
  const groupsEl = h('div', { class: 'groups' }, ...groups.map((g) => g.el));
  controlsEl.append(noGroup, groupsEl);
  const cbar = bar('controls', 'Controls', controlsEl);
  for (const g of groups) {
    g.shown = () => prefs.groups[g.key] ?? true;
    g.toggle = toggle(g.name, 'Show or hide these controls', g.shown(), () => { prefs.groups[g.key] = !g.shown(); save(); apply(); });
    cbar.row.append(g.toggle);
  }
  if (presets) cbar.tools.append(presets);

  // the page: the header, the work (the rack beside the views and the controls), the dock
  const work = h('div', { class: 'work' }, rack, vbar.el, viewsEl, cbar.el, controlsEl);
  app.replaceChildren(header, work, dock);

  // ---- the views share the stage in rows, as even as they go: as many abreast (up to four) as
  // gives each the most room, so a short stage puts them side by side and a tall one stacks them
  const GAP = 12, ASPECT = 1.6, NARROWEST = 240;
  let cols = 1;
  function columns(n) {
    if (phoneQuery.matches) return matchMedia('(orientation: portrait)').matches ? 1 : Math.min(n, 2);
    const W = stage.clientWidth, H = stage.clientHeight;
    if (!W || !H) return null;
    let best = 1, room = 0;
    for (let c = 1; c <= Math.min(n, 4); c++) {
      const r = Math.ceil(n / c), w = (W - GAP * (c - 1)) / c, hh = (H - GAP * (r - 1)) / r;
      if (c > 1 && w < NARROWEST) break;
      const fit = Math.min(w / ASPECT, hh);
      if (fit > room + 1) { room = fit; best = c; }
    }
    return best;
  }
  function arrange() {
    const on = views.filter((v) => v.shown()), n = on.length;
    cols = columns(n) ?? cols;
    const rows = Math.ceil(n / Math.max(1, Math.min(cols, n)));
    let i = 0;
    for (let r = 0; r < rows; r++) {
      const k = Math.ceil((n - i) / (rows - r));
      for (let j = 0; j < k; j++, i++) on[i].card.style.gridColumn = `span ${12 / k}`;
    }
    stage.style.setProperty('--rows', Math.max(1, rows));
    noView.hidden = n > 0 || pedalView.shown();
  }

  // ---- sharing the height: the views' share (0 folds them away, 1 the controls)
  function share() {
    if (performing()) return prefs.moreControls ? (phoneQuery.matches ? 0 : split.views > 0 && split.views < 1 ? split.views : split.open) : 1;
    return touring && split.views === 0 ? split.open : split.views;
  }
  function setShare(v, keep = true) {
    split.views = clamp(v, 0, 1);
    if (keep) { if (split.views > 0 && split.views < 1) split.open = split.views; saveSplit(); }
    apply();
  }
  const handle = h('div', { class: 'split', tabindex: 0, role: 'separator', 'aria-orientation': 'horizontal', 'aria-controls': 'views controls',
    'aria-label': 'Share the height between the views and the controls', 'aria-valuemin': 0, 'aria-valuemax': 100,
    title: 'Drag to share the height between the views and the controls (double-click: as it was)' });
  cbar.el.prepend(handle);
  {
    const SNAP = 56;
    let drag = null, tapped = 0;
    cbar.el.addEventListener('pointerdown', (e) => {
      if (performing() || phoneQuery.matches || e.button > 0) return;
      if (e.target !== handle && e.target.closest('button, select, input, a, label')) return;
      e.preventDefault();
      try { cbar.el.setPointerCapture(e.pointerId); } catch { /* gone */ }
      const v = viewsEl.getBoundingClientRect().height, c = controlsEl.getBoundingClientRect().height;
      drag = { id: e.pointerId, y: e.clientY, v: viewsEl.hidden ? 0 : v, total: (viewsEl.hidden ? 0 : v) + (controlsEl.hidden ? 0 : c), moved: false, onHandle: e.target === handle };
      body.classList.add('sharing');
    });
    cbar.el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id || !drag.total) return;
      if (Math.abs(e.clientY - drag.y) > 3) drag.moved = true;
      if (!drag.moved) return;
      let v = clamp(drag.v + e.clientY - drag.y, 0, drag.total);
      if (v < SNAP) v = 0; else if (drag.total - v < SNAP) v = drag.total;
      setShare(v / drag.total, false);
    });
    for (const ev of ['pointerup', 'pointercancel']) {
      cbar.el.addEventListener(ev, (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const { moved, onHandle } = drag;
        drag = null; body.classList.remove('sharing');
        if (moved) { setShare(split.views); return; }
        if (onHandle && e.timeStamp - tapped < 400) { tapped = 0; setShare(SHARE); } else tapped = onHandle ? e.timeStamp : 0;
      });
    }
    handle.addEventListener('keydown', (e) => {
      const to = { ArrowUp: split.views - 0.05, ArrowDown: split.views + 0.05, Home: 0, End: 1 }[e.key];
      if (to === undefined || performing()) return;
      e.preventDefault();
      setShare(Math.round(to * 20) / 20);
    });
  }
  // each bar's chevron folds its panel away and brings it back at the share it had; in Perform
  // the controls' one is More controls
  vbar.fold.addEventListener('click', () => { setShare(split.views === 0 ? split.open : 0); vbar.fold.blur(); });
  cbar.fold.addEventListener('click', () => {
    if (performing()) { prefs.moreControls = !prefs.moreControls; save(); apply(); }
    else if (phoneQuery.matches && split.views === 1) { setShare(split.open); controlsEl.scrollIntoView({ behavior: 'smooth' }); }
    else setShare(split.views === 1 ? split.open : 1);
    cbar.fold.blur();
  });

  // ---- in Perform the views carry no text, including what their canvases draw (a card marked
  // data-keep-text, the tuner, keeps its own)
  const proto = window.CanvasRenderingContext2D?.prototype;
  for (const name of ['fillText', 'strokeText']) {
    const draw = proto?.[name];
    if (draw && !draw.phuzzQuiet) {
      proto[name] = function (...args) { if (!(document.body.classList.contains('perform') && this.canvas?.closest?.('.views') && !this.canvas.closest('[data-keep-text]'))) draw.apply(this, args); };
      proto[name].phuzzQuiet = true;
    }
  }

  // ---- everything as chosen
  function apply() {
    body.classList.toggle('perform', performing());
    body.classList.toggle('touring', !!touring);
    for (const b of modeBtns) b.setAttribute('aria-pressed', String(b.textContent.toLowerCase() === mode));
    for (const v of all) { v.card.hidden = !v.shown(); v.toggle.setAttribute('aria-pressed', String(v.shown())); }
    body.classList.toggle('no-rack', !pedalView.shown());
    for (const g of groups) { g.el.hidden = !g.shown(); g.toggle.setAttribute('aria-pressed', String(g.shown())); }
    noGroup.hidden = groups.some((g) => g.shown());
    const v = share();
    viewsEl.hidden = v === 0;
    controlsEl.hidden = v === 1;
    body.classList.toggle('views-folded', v === 0);
    body.classList.toggle('controls-folded', v === 1);
    const track = (x) => (x === 0 ? '0px' : `minmax(0, ${+x.toFixed(3)}fr)`);
    work.style.setProperty('--work-rows', `auto ${track(v)} auto ${track(1 - v)}`);
    handle.setAttribute('aria-valuenow', String(Math.round(v * 100)));
    // the chevrons: which way they point, and what they say
    vbar.fold.setAttribute('aria-expanded', String(v !== 0));
    vbar.fold.title = v === 0 ? 'Show the views' : 'Hide the views: the controls take their room';
    cbar.fold.setAttribute('aria-expanded', String(v !== 1));
    cbar.fold.title = performing() ? (v === 1 ? 'More controls' : 'Fewer controls: the views take the room')
      : v === 1 ? 'Show the controls' : 'Hide the controls: the views take their room';
    for (const b of [vbar.fold, cbar.fold]) b.setAttribute('aria-label', b.title);
    arrange();
  }
  new ResizeObserver(() => arrange()).observe(stage);
  phoneQuery.addEventListener?.('change', apply);
  apply();

  // a tour (shared/tour.js) shows only the views it is about (by title, any case), for a while;
  // the pedal stays
  const tourSlot = h('div', { class: 'tour-slot' });
  dock.prepend(tourSlot);
  return {
    tourSlot,
    arrange,
    viewNames: () => all.map((v) => v.name),
    showViews(names) { touring = names ? new Set(names.map((n) => n.toLowerCase())) : null; apply(); },
  };
}
