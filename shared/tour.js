// tour.js — a guided tour of a pedal's physics, on its page, as Forte's instruments have. A few
// steps, each setting the pedal up, showing the views it is about and playing the test bass
// through it, while a card under the pedal's face says what to listen for and to look at, and
// why. Tour, in the header before How it works, starts it; the card's Back and Next step through
// it, ▶ Play plays a step again, and ✕ (or Esc) ends it. The tour changes nothing for good: the
// settings, the footswitch, the tuner's mute and the source the player chose come back as they
// were, and the views all come back. A link to …/#tour opens the card at its first step.
//
// Each pedal writes its tour in <slug>/src/<slug>-tour.js, which its page loads after its main
// module (<script type="module" src="src/<slug>-tour.js"></script>):
//
//   import { tour, note, run, riff, sweep } from '../../shared/tour.js';
//   export const TOUR = tour('phuzz', [
//     { title: 'A few words', views: ['The transistors', 'Scope'], preset: 'Full fuzz',
//       set: { temp: 38 }, play: [riff(), note('E1', { at: 4, dur: 3, vel: 0.9 }), { at: 6, bypass: true }],
//       text: 'What to listen for and look at, and why, in the READMEs\' Markdown (shared/markdown.js).' },
//   ]);
//
// A step:
//   title   a few words
//   text    what to listen for and look at, and why (Markdown: paragraphs, lists, **bold**,
//           *italics*, `code`, links; a paragraph indented by two spaces is a display equation)
//   views   the views it shows, by their titles (and 'Tuner'): the rest step aside during the
//           step (a step without views keeps the last step's)
//   preset  one of the pedal's presets, by name: the step starts from it, otherwise from the
//           defaults; either way the player's own bass and how it is plugged in (the
//           descriptor's `keep`) stay as they set them
//   set     parameters (by id) changed from there
//   bypass  true: the step starts with the pedal bypassed (otherwise engaged)
//   play    what the test bass plays from the start of the step: notes { key, at, dur, vel }
//           (key a MIDI number or a name such as 'E1', 'F#2' or 'Bb1'; at and dur in seconds;
//           vel from 0 to 1, how hard the string is plucked), { at, set } (parameters changed
//           partway) and { at, bypass } (the footswitch). Arrays nest; note, run, riff and sweep
//           (below) make them.
// test/tour-tests.mjs checks every tour against its pedal: views, presets, parameters and notes.

import { RIFF, RIFF_BPM } from './testbass.js';

// the test bass's notes: its open E (E1, 28) to the 24th fret of its G (G3, 67)
export const RANGE = [28, 67];

const NOTE = /^([A-Ga-g])([#♯b♭]?)(-?\d)$/;
const STEPS = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
// a note's MIDI number, from a number or a name ('E1' is 28, the open low E)
export function midi(k) {
  if (typeof k === 'number') return k;
  const m = NOTE.exec(String(k).trim());
  if (!m) throw new Error(`not a note: ${k}`);
  const acc = { '#': 1, '♯': 1, b: -1, '♭': -1 }[m[2]] ?? 0;
  return 12 * (+m[3] + 1) + STEPS[m[1].toLowerCase()] + acc;
}
const keysOf = (ks) => (Array.isArray(ks) ? ks : String(ks).trim().split(/\s+/)).map(midi);
// one note: { at = 0, dur = 1, vel = 0.7 }
export const note = (k, { at = 0, dur = 1, vel = 0.7 } = {}) => ({ key: midi(k), at, dur, vel });
// notes one after another, every `step` seconds; each holds for `dur` (default: until the next)
export const run = (ks, { at = 0, step = 0.4, dur, vel = 0.7 } = {}) =>
  keysOf(ks).map((k, i) => note(k, { at: at + i * step, dur: dur ?? step * 0.9, vel }));
// the page's riff (Play a riff), `times` times over from `at`
export function riff({ at = 0, times = 1, vel = 0.65 } = {}) {
  const beat = 60 / RIFF_BPM, out = [];
  let t = at;
  for (let n = 0; n < times; n++) {
    RIFF.forEach(([k, b], i) => {
      if (k) out.push(note(k, { at: t, dur: b * beat * 0.85, vel: Math.min(1, vel + 0.15 * (i % 4 === 0)) }));
      t += b * beat;
    });
  }
  return out;
}
// a parameter moved from one value to another over `dur` seconds, in `steps` sets (`log` for a
// parameter that moves in ratios, such as a cable's length)
export function sweep(id, from, to, { at = 0, dur = 2, steps = 30, log = false } = {}) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const u = i / steps, v = log ? from * (to / from) ** u : from + (to - from) * u;
    return { at: at + u * dur, set: { [id]: +v.toPrecision(6) } };
  });
}

// a step's score: every event, flattened and in time order
export const score = (step) => [step.play ?? []].flat(Infinity).filter(Boolean).sort((a, b) => a.at - b.at);
// how long a step plays, s
export const length = (step) => score(step).reduce((t, e) => Math.max(t, e.at + (e.dur ?? 0)), 0);

// A tour: its pedal's id and its steps. In a browser, it also puts Tour in the page's header.
export function tour(id, steps) {
  const t = { id, steps };
  if (typeof document !== 'undefined') mount(t);
  return t;
}

// ---------------------------------------------------------------------------
// the page: the button, the card and the playing (browser only)

async function mount(t) {
  const [{ pageReady }, { renderMarkdown }] = await Promise.all([import('./shell.js'), import('./markdown.js')]);
  const api = await pageReady, page = api.page;
  if (!page || !t.steps.length) return;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const btn = (text, title, cls) => { const b = el('button', cls, text); b.type = 'button'; if (title) { b.title = title; b.setAttribute('aria-label', title); } return b; };

  // Tour, in the header just before How it works, in its look
  const start = btn('', 'A guided tour of the physics: it plays the test bass through the pedal while it shows you what to listen for', 'pz-about pz-tour-start');
  start.setAttribute('aria-label', 'Tour: a guided tour of the physics');
  start.setAttribute('aria-pressed', 'false');
  const glyph = el('span', 'pz-about-i pz-tour-glyph', '▶');
  glyph.setAttribute('aria-hidden', 'true');
  start.append(glyph, el('span', 'pz-about-label', 'Tour'));
  page.notesBtn.before(start);

  // the card, under the pedal's face
  const card = el('section', 'pz-tour');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-labelledby', 'pz-tour-title');
  card.hidden = true;
  const head = el('div', 'pz-tour-head');
  const kicker = el('span', 'pz-tour-kicker');
  const fold = btn('', 'Fold the tour away', 'pz-tour-fold');
  fold.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 6 8 10.5 12.5 6"/></svg>';
  fold.setAttribute('aria-expanded', 'true');
  const close = btn('✕', 'End the tour (Esc): your settings come back', 'pz-tour-close');
  head.append(kicker, fold, close);
  const title = el('h2', 'pz-tour-title');
  title.id = 'pz-tour-title';
  const text = el('div', 'pz-tour-text');
  const nav = el('div', 'pz-tour-nav');
  const back = btn('◀ Back', 'The step before', 'pz-tour-back');
  const again = btn('▶ Play', 'Play this step again', 'pz-tour-play');
  const next = btn('Next ▶', 'The next step', 'pz-tour-next');
  nav.append(back, again, next);
  card.append(head, title, text, nav);
  page.tourSlot.append(card);

  const narrow = matchMedia('(max-width: 760px)'); // one column (shared/pedal.css .stage)
  // the card in sight: on one column it is above the views, so its top goes to the top of the window
  const inSight = () => {
    const r = card.getBoundingClientRect();
    if (narrow.matches) { if (r.top < 0 || r.top > innerHeight / 3) scrollTo({ top: Math.max(0, scrollY + r.top - 8) }); } else if (r.bottom > innerHeight || r.top < 0) scrollTo({ top: 0 });
  };

  let at = -1, saved = null, timers = [], pressed = new Set(), playing = false, marked = [];

  function hush() {
    for (const id of timers) clearTimeout(id);
    timers = [];
    for (const k of pressed) page.release(k);
    pressed.clear();
    playing = false;
    again.textContent = '▶ Play';
    again.title = 'Play this step again';
  }
  // the pedal as the step has it: the defaults or a preset, the player's own bass, the step's changes
  function setUp(step) {
    const keep = Object.fromEntries((api.PEDAL.keep ?? []).map((k) => [k, saved.P[k]]));
    page.setAll({ ...page.defaults(), ...keep, ...(step.preset ? api.PEDAL.presets[step.preset] : {}), ...step.set });
    page.setBypass(!!step.bypass);
  }
  // the controls a step changes, marked while it lasts
  function mark(ids) {
    for (const m of marked) m.classList.remove('pz-mark');
    marked = page.controls(ids);
    for (const m of marked) m.classList.add('pz-mark');
  }

  // the audio, started by a click; notes wait until it runs (for a few seconds at most)
  async function ready() {
    for (let i = 0; i < 80 && api.ctx?.state !== 'running'; i++) await new Promise((r) => setTimeout(r, 100));
    await new Promise((r) => setTimeout(r, 120));
  }
  async function play() {
    hush();
    page.start(); // within the click: it lets the audio start, or resume
    const step = t.steps[at], events = score(step), mine = at;
    if (!events.length) return;
    playing = true;
    again.textContent = '■ Stop';
    again.title = 'Stop playing';
    await ready();
    if (at !== mine || !playing) return;
    page.useBass();
    const later = (s, fn) => timers.push(setTimeout(fn, Math.max(0, s * 1000)));
    for (const e of events) {
      if (e.key !== undefined) {
        later(e.at, () => { if (pressed.has(e.key)) page.release(e.key); page.press(e.key, e.vel ?? 0.7); pressed.add(e.key); });
        later(e.at + (e.dur ?? 1), () => { if (pressed.delete(e.key)) page.release(e.key); });
      } else if (e.set) later(e.at, () => page.setAll(e.set));
      else if (e.bypass !== undefined) later(e.at, () => page.setBypass(!!e.bypass));
    }
    later(length(step) + 0.05, () => { if (at === mine) hush(); });
  }

  function go(i, { sound = true } = {}) {
    hush();
    at = Math.max(0, Math.min(t.steps.length - 1, i));
    const step = t.steps[at];
    setUp(step);
    if (step.views) page.showViews(step.views);
    mark([...new Set([step.set ?? {}, ...score(step).filter((e) => e.set).map((e) => e.set)].flatMap(Object.keys))]);
    kicker.textContent = `Physics tour · ${at + 1} of ${t.steps.length}`;
    title.textContent = step.title;
    text.innerHTML = renderMarkdown(step.text ?? '', { assets: location.href }).html;
    text.scrollTop = 0;
    back.disabled = at === 0;
    next.textContent = at === t.steps.length - 1 ? 'Done' : 'Next ▶';
    next.title = at === t.steps.length - 1 ? 'End the tour: your settings come back' : 'The next step';
    again.disabled = !score(step).length;
    inSight();
    if (sound) play();
  }

  // the page's saved settings (phuzzbox.<id>.params and .bypass), kept as they were: a player who
  // never changed a setting still has none saved after the tour, and so gets a later version's defaults
  const KEYS = ['params', 'bypass'].map((k) => `phuzzbox.${api.PEDAL.id}.${k}`);
  const stored = () => { try { return KEYS.map((k) => localStorage.getItem(k)); } catch { return []; } };
  const restore = (was) => { try { KEYS.forEach((k, i) => (was[i] == null ? localStorage.removeItem(k) : localStorage.setItem(k, was[i]))); } catch { /* storage blocked: nothing was saved either */ } };

  function begin({ sound = true } = {}) {
    if (saved) return;
    saved = { P: page.get(), bypass: page.bypassed(), mute: page.muted(), source: page.source(), stored: stored() };
    if (saved.mute) page.setMute(false);
    card.hidden = false;
    card.classList.remove('folded');
    document.body.classList.add('touring');
    start.setAttribute('aria-pressed', 'true');
    go(0, { sound });
    next.focus({ preventScroll: true });
  }
  function end() {
    if (!saved) return;
    hush();
    mark([]);
    page.showViews(null);
    const was = saved;
    saved = null;
    page.setAll(was.P);
    page.setBypass(was.bypass);
    if (was.mute) page.setMute(true);
    page.restoreSource(was.source);
    restore(was.stored);
    card.hidden = true;
    document.body.classList.remove('touring');
    start.setAttribute('aria-pressed', 'false');
    if (location.hash === '#tour') history.replaceState(null, '', location.pathname + location.search);
    at = -1;
  }

  start.addEventListener('click', () => { if (saved) end(); else begin(); start.blur(); });
  close.addEventListener('click', () => { end(); start.focus({ preventScroll: true }); });
  back.addEventListener('click', () => go(at - 1));
  next.addEventListener('click', () => { if (at === t.steps.length - 1) end(); else go(at + 1); });
  again.addEventListener('click', () => { if (playing) hush(); else play(); again.blur(); });
  fold.addEventListener('click', () => {
    const f = card.classList.toggle('folded');
    fold.title = f ? 'Show the tour' : 'Fold the tour away';
    fold.setAttribute('aria-label', fold.title);
    fold.setAttribute('aria-expanded', String(!f));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && saved && !document.querySelector('dialog[open]')) end(); });
  // leaving the page mid-tour leaves the player's settings as they were, not the tour's
  addEventListener('pagehide', end);
  // …/#tour: the card at its first step, waiting for ▶ Play (the browser wants a click before sound)
  const fromHash = () => { if (location.hash === '#tour' && !saved) begin({ sound: false }); };
  addEventListener('hashchange', fromHash);
  fromHash();
}
