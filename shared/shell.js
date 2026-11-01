// shell.js — everything a pedal page shares: the audio graph (the interface's input or the test
// bass → the pedal's AudioWorklet → volume → a safety curve → the speakers), the pedal's face
// (knobs for its `perform` controls, the footswitch and its LED), meters, a tuner, the latency,
// the Controls panel with every parameter, the rig and the presets, the MIDI pedals, the test
// bass's fretboard, and How it works (the READMEs: shared/notes.js). shared/layout.js lays them out on one
// screen, as Forte does, with a toggle for each view and group of controls. The page brings its
// descriptor, its worklet module and its views; a guided tour (shared/tour.js) drives the page
// through `pageReady`.
//
//   createPedal({ PEDAL, worklet: new URL('./x-worklet.js', import.meta.url), views: [view, …] })
//   (the Pedalboard adds rack: (api) => an element below the face, and load: async () => what its
//   worklet's processorOptions need besides the test bass, by default { pedal: the .wasm's bytes })
//   view = { title, caption, perform?, mount(canvasHolder, api) }  (perform: shown at first; by
//            default the first two are) where api = { P, ctx, analyser (the output, in full-scale
//            units), input (an analyser of the input, in volts), fullScale() (volts), note (what
//            the tuner hears: { f, letter, octave, cents, live } or null), on(event, fn) } and
//            events are 'params' and 'audio' (fn(api)), and 'pedal' (fn(messages, api): what the
//            pedal posted, [{ type, values }])

import { params, defaults, fmt, toUnit, fromUnit } from './params.js';
import { midiPanel } from './midi-panel.js';
import { fetchBytes } from './wasm.js';
import { TESTBASS_URL, RIFF, RIFF_BPM } from './testbass.js';
import { tune, Tuner, OPEN_STRINGS } from './tuner.js';
import { howItWorks } from './notes.js';
import { scopeView, spectrumView } from './views.js';
import { byId, PEDALS, PHUZZBOX_VERSION, SOURCE } from './registry.js';
import { createLayout } from './layout.js';
import { INTERFACES, byInterface, fullScaleVolts } from './interfaces.js';
import { registerApp, offerInstall } from './app.js';
import { safetyCurve, SAFE_SPAN } from './safety.js';

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
};

// The bass's fretboard on the computer keys: each row of letters a string, as tablature has them
// (the bottom row the low E), from the open string up nine frets.
const ROWS = [
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'],
  ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'],
];
const OPEN = [28, 33, 38, 43];
const STRING_NAMES = ['E', 'A', 'D', 'G'];

// a knob: drag up or right to turn it, Shift for fine, a double tap for its default, arrows too.
// get() is its value, put(v) sets it (the Pedalboard's pedals have knobs of their own)
export function knobFor(p, get, put) {
  const dial = h('div', { class: 'dial', role: 'slider', tabindex: 0, 'aria-label': p.label, title: p.hint ?? '' }, h('span', { class: 'mark' }));
  const val = h('div', { class: 'kval' });
  const el = h('div', { class: 'knob', 'data-param': p.id }, dial, h('div', { class: 'klabel' }, p.label.replace(/\s*\(.*\)$/, '')), val);
  el.refresh = () => {
    const u = toUnit(p, get());
    dial.style.setProperty('--turn', `${-135 + 270 * u}deg`);
    dial.setAttribute('aria-valuetext', fmt(p, get()));
    dial.setAttribute('aria-valuenow', String(Math.round(u * 100)));
    val.textContent = fmt(p, get());
  };
  let start = null;
  dial.addEventListener('pointerdown', (e) => { dial.setPointerCapture(e.pointerId); start = { x: e.clientX, y: e.clientY, u: toUnit(p, get()) }; });
  dial.addEventListener('pointermove', (e) => {
    if (!start) return;
    const d = ((e.clientX - start.x) - (e.clientY - start.y)) / (e.shiftKey ? 800 : 200);
    put(fromUnit(p, start.u + d));
  });
  dial.addEventListener('pointerup', () => { start = null; });
  dial.addEventListener('dblclick', () => put(p.def));
  dial.addEventListener('keydown', (e) => {
    const step = { ArrowUp: 0.02, ArrowRight: 0.02, ArrowDown: -0.02, ArrowLeft: -0.02 }[e.key];
    if (step) { e.preventDefault(); e.stopPropagation(); put(fromUnit(p, toUnit(p, get()) + step * (e.shiftKey ? 0.25 : 1))); }
  });
  return el;
}

// the page, once createPedal has built it: what a guided tour (shared/tour.js) drives
let pageIs;
export const pageReady = new Promise((r) => { pageIs = r; });

export function createPedal({ PEDAL, worklet, views = [], rack: more = null, load = null }) {
  const reg = byId(PEDAL.id) ?? {};
  const all = params(PEDAL.groups);
  const key = `phuzzbox.${PEDAL.id}`;
  const P = { ...defaults(PEDAL.groups), ...store.get(`${key}.params`, {}) };
  for (const p of all) if (!(p.id in P)) P[p.id] = p.def;
  const state = { bypass: store.get(`${key}.bypass`, false), source: 'bass', fullScale: store.get('phuzzbox.fullScale', 1), volume: store.get('phuzzbox.volume', 0.8), channel: 0, mute: false };
  const listeners = { params: [], audio: [], pedal: [] };
  const api = { P, PEDAL, note: null, ctx: null, analyser: null, input: null, fullScale: () => state.fullScale, on: (ev, fn) => listeners[ev].push(fn), send: (m) => send(m) };
  let ctx = null, node = null, volume = null, micSource = null, micStream = null, tunerAnalyser = null, splitter = null;
  const send = (m) => node?.port.postMessage(m);
  const emit = (ev) => listeners[ev].forEach((fn) => fn(api));
  const knob = (p) => knobFor(p, () => P[p.id], (v) => set(p.id, v));

  // ---- the page (shared/layout.js arranges it: the header, the pedal beside the views and the
  // controls, the test bass pinned below while it is the input)
  document.title = `${PEDAL.name} · PhuzzBox`;
  const app = document.getElementById('app');
  const status = h('span', { class: 'status' });
  const startBtn = h('button', { class: 'primary start', type: 'button', onclick: () => start() }, 'Start audio');
  const sourceSel = h('select', { 'aria-label': 'Input', title: 'What plays into the pedal: the test bass, or your interface\'s input', onchange: () => setSource(sourceSel.value) },
    h('option', { value: 'bass' }, 'Test bass (keys)'));
  const chanSel = h('select', { 'aria-label': 'Input channel', class: 'chan', onchange: () => { state.channel = +chanSel.value; connectMic(); } },
    h('option', { value: 0 }, 'In 1'), h('option', { value: 1 }, 'In 2'));
  const latency = h('span', { class: 'pill', title: 'The browser\'s estimate of the delay from input to output' }, 'latency –');
  const sinkSel = h('select', { 'aria-label': 'Output', class: 'sink', hidden: true, onchange: () => setSink(sinkSel.value) });
  const measureBtn = h('button', { type: 'button', class: 'ghost', hidden: true, title: 'Measure the real round trip: connect a cable from your interface\'s output to the input you chose, and turn its direct monitoring off', onclick: () => measure() }, 'Measure latency');
  const cpu = h('span', { class: 'pill cpu', title: 'The share of the audio thread\'s time the pedal takes' }, 'CPU –');
  const notes = howItWorks({ pedal: { id: PEDAL.id, name: PEDAL.name, version: reg.version } });
  const notesBtn = notes.button();
  // How the tuner works, how the test bass works: their tabs in the notes
  const about = (k, what) => h('button', { type: 'button', class: 'info', 'aria-label': `How the ${what} works`, title: `How the ${what} works`, onclick: () => notes.open(k) }, 'i');
  const installBtn = h('button', { type: 'button', class: 'ghost', title: 'Install PhuzzBox as an app with its own window, which opens without the browser\'s tabs and works without the server' }, 'Install app');
  registerApp();
  offerInstall(installBtn);
  // the volume after the pedal, beside the audio: a fader, as on a mixer
  const volInput = h('input', { type: 'range', class: 'fader', min: 0, max: 1.5, step: 0.01, value: state.volume, 'aria-label': 'Volume' });
  volInput.addEventListener('input', () => { state.volume = +volInput.value; store.set('phuzzbox.volume', state.volume); if (volume) volume.gain.value = state.volume; });
  // the pedal's name is the menu of pedals, as an instrument's is in Forte
  const menu = h('details', { class: 'pedal-menu' },
    h('summary', { title: 'Choose a pedal' }, h('h1', {}, PEDAL.name), h('span', { class: 'caret', 'aria-hidden': 'true' }, '▾')),
    h('div', { class: 'menu-list' },
      ...PEDALS.filter((p) => p.ready).map((p) => h('a', { href: `../${p.id}/`, 'aria-current': p.id === PEDAL.id ? 'page' : false }, h('b', {}, p.name), h('small', {}, p.after))),
      h('a', { href: '../board/', class: 'menu-board', 'aria-current': PEDAL.id === 'board' ? 'page' : false }, h('b', {}, 'Pedalboard'), h('small', {}, 'the pedals in a chain, each loading the next')),
      h('a', { href: '../', class: 'menu-home' }, h('b', {}, 'All pedals'), h('small', {}, 'physics, not samples')),
      // the credits, with the site's only link to GitHub
      h('div', { class: 'menu-foot' }, `PhuzzBox ${PHUZZBOX_VERSION} · Vibe coded by Jesse Thaler · `, h('a', { href: SOURCE, target: '_blank', rel: 'noopener' }, 'source'))));
  addEventListener('pointerdown', (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); } });
  const header = h('header', { class: 'top' },
    h('div', { class: 'brand' }, h('a', { class: 'home', href: '../', title: 'Every pedal' }, 'PhuzzBox'), menu, notesBtn, installBtn),
    h('div', { class: 'audio' }, startBtn, cpu, sourceSel, chanSel, sinkSel, latency, measureBtn,
      h('label', { class: 'volume', title: 'The level after the pedal, before the speakers (a MIDI volume pedal moves it too)' }, 'Volume', volInput), status));

  // the pedal's face
  const led = h('span', { class: 'led', 'aria-hidden': 'true' });
  const foot = h('button', { class: 'footswitch', type: 'button', 'aria-pressed': String(!state.bypass), title: 'Engage or bypass the pedal (Space)', onclick: () => setBypass(!state.bypass) }, h('span', { class: 'sr' }, 'Engage'));
  const knobs = h('div', { class: 'knobs' });
  const meterIn = meter('In'), meterOut = meter('Out');
  const face = h('section', { class: 'pedal', 'aria-label': `${PEDAL.name} pedal` },
    h('div', { class: 'jacks' }, meterIn.el, meterOut.el),
    knobs,
    h('div', { class: 'name' }, h('span', {}, PEDAL.name), h('small', {}, PEDAL.after ?? reg.after ?? '')),
    h('div', { class: 'switchrow' }, led, foot));
  const rack = h('aside', { class: 'rack', 'data-view': 'Pedal' }, face);
  if (more) rack.append(more(api));

  // an explanation waits behind ⓘ: a tap shows it, as in Forte
  const info = (label, target, cls = 'notes-open') => {
    const b = h('button', { type: 'button', class: 'info', 'aria-label': label, 'aria-expanded': 'false' }, 'i');
    b.addEventListener('click', () => { b.setAttribute('aria-expanded', String(target().classList.toggle(cls))); b.blur(); });
    return b;
  };

  // the tuner: the input's fundamental (the interface's or the test bass's), on a needle
  const tuning = new Tuner({ a4: store.get('phuzzbox.a4', 440) });
  const tNote = h('span', {}, '–'), tOct = h('sub', {}, ''), tNeedle = h('span', { class: 't-needle' });
  const tCents = h('span', { class: 't-cents' }, ''), tHz = h('span', {}, 'Start audio and play a note'), tString = h('span', {}, '');
  const a4Input = h('input', { type: 'number', min: 415, max: 466, step: 0.5, value: tuning.a4, 'aria-label': 'Reference pitch, A4 in hertz' });
  a4Input.addEventListener('change', () => { tuning.a4 = Math.min(466, Math.max(415, +a4Input.value || 440)); a4Input.value = tuning.a4; store.set('phuzzbox.a4', tuning.a4); });
  const muteBtn = h('button', { type: 'button', class: 'ghost mute', 'aria-pressed': 'false', title: 'Silence the output while you tune, as a tuner pedal does; the tuner still hears the input', onclick: () => setMute(!state.mute) }, 'Mute while tuning');
  const scale = h('div', { class: 't-scale', 'aria-hidden': 'true' }, h('span', { class: 't-zone' }),
    ...[-50, -25, 0, 25, 50].map((c) => { const t = h('span', { class: 't-tick' }, h('i', {}, c > 0 ? `+${c}` : c < 0 ? `−${-c}` : '0')); t.style.left = `${50 + c}%`; return t; }), tNeedle);
  const tunerCard = h('figure', { class: 'card tunercard idle', 'aria-label': 'Tuner', 'data-view': 'Tuner', 'data-keep-text': '' },
    h('figcaption', {}, h('b', {}, 'Tuner'), about('tuner', 'tuner'),
      h('span', { class: 'a4' }, 'A4 =', a4Input, 'Hz'), muteBtn),
    h('div', { class: 't-body' }, h('div', { class: 't-name', role: 'status' }, tNote, tOct), scale, h('div', { class: 't-read' }, tCents, tHz, tString)));

  // views
  const viewList = [{ key: 'tuner', name: 'Tuner', card: tunerCard, on: true }];
  // every page has a Scope and a Spectrum (shared/views.js), its own if it brings them
  const has = (t) => views.some((v) => v.title === t);
  views = [...views, ...(has('Spectrum') ? [] : [spectrumView()]), ...(has('Scope') ? [] : [scopeView()])];
  views.forEach((v, i) => {
    const holder = h('div', { class: 'canvas' });
    const card = h('figure', { class: 'card', 'data-view': v.title });
    const what = v.title.replace(/^The /, 'the ');
    card.append(h('figcaption', {}, h('b', {}, v.title), v.caption ? info(`What ${what} shows`, () => card) : null), holder,
      v.caption ? h('p', { class: 'caption' }, v.caption.replace(/^./, (c) => c.toUpperCase()),
        v.about ? [' ', h('button', { type: 'button', class: 'link', onclick: () => notes.open(v.about) }, `How the ${v.title.toLowerCase()} works`)] : null) : null);
    viewList.push({ key: v.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: v.title, card, on: v.perform ?? i < 2 });
    v.mount(holder, api);
  });

  // the test bass, pinned below while it is the input
  const riffBtn = h('button', { type: 'button', class: 'ghost', onclick: () => toggleRiff() }, 'Play a riff');
  const fretGrid = h('div', { class: 'frets' });
  const fretOf = new Map(); // a computer key's code → its fret, to light it
  const fretOfKey = new Map(); // a note's fret, on the highest string that plays it (for the tours)
  for (let s = 3; s >= 0; s--) {
    const row = h('div', { class: `string s${s}` }, h('span', { class: 'sname' }, STRING_NAMES[s]));
    for (let f = 0; f < 10; f++) {
      const k = OPEN[s] + f;
      const b = h('button', { type: 'button', class: `${f === 0 ? 'open' : ''}${s === 2 && [3, 5, 7, 9].includes(f) ? ' inlay' : ''}`, 'aria-label': `${STRING_NAMES[s]} string, fret ${f}`, title: ROWS[s][f].replace(/^Key|^Digit/, '') });
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); b.classList.add('down'); play(k, 0.75); });
      const up = () => { b.classList.remove('down'); stop(k); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      fretOf.set(ROWS[s][f], b);
      if (!fretOfKey.has(k)) fretOfKey.set(k, b);
      row.append(b);
    }
    fretGrid.append(row);
  }
  const bassFold = h('button', { type: 'button', class: 'fold', 'aria-controls': 'frets' });
  bassFold.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 6 8 10.5 12.5 6"/></svg>';
  fretGrid.id = 'frets';
  const bass = h('section', { class: 'bass', 'aria-label': 'Test bass' },
    h('div', { class: 'bar bass-bar' }, h('span', { class: 'toggles-label' }, 'Test bass'),
      about('testbass', 'test bass'),
      h('span', { class: 'bass-hint' }, 'a bass made of physics: the rows of letter keys are its strings (Z row the low E, then A, Q and the numbers), open to the ninth fret'),
      h('span', { class: 'spacer' }), riffBtn, bassFold),
    fretGrid);
  const setBassOpen = (open) => {
    store.set('phuzzbox.bassOpen', open);
    fretGrid.hidden = !open;
    bassFold.setAttribute('aria-expanded', String(open));
    bassFold.title = open ? 'Fold the fretboard away' : 'Show the fretboard';
    bassFold.setAttribute('aria-label', bassFold.title);
  };
  bassFold.addEventListener('click', () => { setBassOpen(fretGrid.hidden); bassFold.blur(); });
  setBassOpen(store.get('phuzzbox.bassOpen', true));
  const dock = h('footer', { class: 'dock' }, bass);

  // the Controls panel: the pedal's groups, the rig, the MIDI pedals
  const presetSel = h('select', { class: 'presets', 'aria-label': 'Presets', onchange: () => { if (presetSel.value) applyPreset(presetSel.value); presetSel.value = ''; } },
    h('option', { value: '' }, 'Presets…'), ...Object.keys(PEDAL.presets ?? {}).map((n) => h('option', { value: n }, n)),
    h('option', { value: '__defaults' }, 'Default settings'));
  const fsInput = h('input', { type: 'number', min: 0.05, max: 20, step: 0.05, value: state.fullScale, 'aria-label': 'Volts at full scale' });
  fsInput.addEventListener('change', () => { state.fullScale = Math.max(0.05, +fsInput.value || 1); store.set('phuzzbox.fullScale', state.fullScale); send({ type: 'fullScale', volts: state.fullScale }); });
  // Full scale from the interface's specification and its gain, or typed in
  const ifaceSel = h('select', { 'aria-label': 'Audio interface', onchange: () => setInterface() },
    h('option', { value: '' }, 'Other interface'), ...INTERFACES.map((i) => h('option', { value: i.id }, i.name)));
  const gainInput = h('input', { type: 'number', min: 0, max: 62, step: 1, value: store.get('phuzzbox.gain', 20), 'aria-label': 'Interface gain in decibels' });
  gainInput.addEventListener('change', () => setInterface());
  const gainLabel = h('label', { class: 'inline' }, 'Gain ', gainInput, ' dB');
  ifaceSel.value = store.get('phuzzbox.interface', '');
  const ifaceInput = all.find((p) => p.role === 'interface-input');
  function setInterface() {
    const iface = byInterface(ifaceSel.value);
    store.set('phuzzbox.interface', ifaceSel.value);
    gainLabel.hidden = !iface;
    fsInput.disabled = !!iface;
    if (!iface) { fsInput.title = ''; return; }
    gainInput.max = iface.gainRange;
    const g = Math.min(iface.gainRange, Math.max(0, +gainInput.value || 0));
    gainInput.value = g;
    store.set('phuzzbox.gain', g);
    gainLabel.title = `${iface.note} At 0 dB a sine of +${iface.maxDbu} dBu just reaches full scale.`;
    state.fullScale = +fullScaleVolts(iface, g).toPrecision(3);
    fsInput.value = state.fullScale;
    fsInput.title = `Set from the ${iface.name} at ${g} dB of gain`;
    store.set('phuzzbox.fullScale', state.fullScale);
    send({ type: 'fullScale', volts: state.fullScale });
    if (ifaceInput && P[ifaceInput.id] !== iface.inputZ) set(ifaceInput.id, iface.inputZ);
  }
  const rows = [];
  const groupList = [], groupBoxes = [];
  for (const g of PEDAL.groups) {
    const box = h('fieldset', { class: 'group' }, h('legend', {}, g.name));
    for (const p of g.params) {
      const val = h('output', {});
      let input;
      if (p.type === 'checkbox') {
        input = h('input', { type: 'checkbox', class: 'switch', id: `p-${p.id}` });
        input.addEventListener('change', () => set(p.id, input.checked));
      } else if (p.type === 'select') {
        input = h('select', { id: `p-${p.id}` }, ...p.options.map(([v, l]) => h('option', { value: v }, l)));
        input.addEventListener('change', () => set(p.id, input.value));
      } else {
        input = h('input', { type: 'range', class: 'fader', min: 0, max: 1000, step: 1, id: `p-${p.id}` });
        input.addEventListener('input', () => set(p.id, fromUnit(p, input.value / 1000)));
      }
      const row = h('div', { class: 'row', 'data-param': p.id });
      const more = p.hint ? info(`About ${p.label}`, () => row, 'hint-open') : null;
      row.append(h('label', { for: `p-${p.id}` }, p.label), more, input, val, p.hint ? h('p', { class: 'hint' }, p.hint) : null);
      rows.push({ p, row, input, val });
      box.append(row);
    }
    // a group whose every control is irrelevant now (showIf) says so rather than standing empty
    const empty = h('p', { class: 'group-empty' }, 'Not used with these settings.');
    empty.hidden = true;
    box.append(empty);
    groupBoxes.push({ empty, rows: rows.slice(rows.length - g.params.length) });
    groupList.push({ key: g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: g.name, el: box });
  }
  // the rig: what turns the browser's numbers into volts at the input jack
  const rig = h('fieldset', { class: 'group rig' }, h('legend', {}, 'Rig'),
    h('div', { class: 'row' }, h('label', {}, 'Audio interface'), ifaceSel, gainLabel),
    h('div', { class: 'row', title: 'How many volts at the input jack make a full-scale signal in the browser: from your interface and its gain, or typed in. Set it so the test bass and your bass read alike on the In meter; it matters for the pedals that distort.' },
      h('label', { for: 'p-fullscale' }, 'Full scale'), h('span', { class: 'inline' }, fsInput, ' V')),
    h('p', { class: 'rig-note' }, 'Choose your interface and its gain, and the page works out Full scale from the maker\'s specification.'));
  fsInput.id = 'p-fullscale';
  groupList.push({ key: 'rig', name: 'Rig', el: rig });

  // MIDI foot controllers (shared/midi-panel.js): what each control change moves
  const midi = midiPanel({ PEDAL, h, store, key, ui: {
    setVolume: (g) => { volInput.value = g; setVolume(g); }, bypassed: () => state.bypass, setBypass, muted: () => state.mute, setMute,
    value: (id) => P[id], set, presets: Object.keys(PEDAL.presets ?? {}), applyPreset,
  } });
  midi.el.classList.add('group');
  groupList.push({ key: 'midi', name: 'MIDI pedals', el: midi.el });
  api.midi = midi;

  const layout = createLayout({ id: PEDAL.id, h, store, app, header, rack, views: viewList, groups: groupList, presets: presetSel, dock });
  api.layout = layout;

  for (const p of all.filter((q) => q.perform && q.type !== 'checkbox' && q.type !== 'select')) knobs.append(knob(p));

  // ---- state
  function refresh() {
    for (const { p, row, input, val } of rows) {
      if (p.type === 'checkbox') input.checked = !!P[p.id];
      else if (p.type === 'select') input.value = P[p.id];
      else input.value = Math.round(1000 * toUnit(p, P[p.id]));
      val.textContent = p.type === 'checkbox' ? '' : fmt(p, P[p.id]);
      row.hidden = p.showIf ? !p.showIf(P) : false;
    }
    for (const g of groupBoxes) g.empty.hidden = g.rows.some((r) => !r.row.hidden);
    for (const k of knobs.children) k.refresh?.();
  }
  function set(id, v, quiet) {
    P[id] = v;
    store.set(`${key}.params`, P);
    send({ type: 'params', P: { ...P } });
    if (!quiet) refresh();
    emit('params');
  }
  function applyPreset(name) {
    if (name === '__defaults') Object.assign(P, defaults(PEDAL.groups));
    else Object.assign(P, PEDAL.presets[name]);
    store.set(`${key}.params`, P);
    send({ type: 'params', P: { ...P } });
    refresh();
    emit('params');
  }
  // the volume after the pedal, from a MIDI volume pedal: it glides over 10 ms rather than stepping
  function setVolume(g) {
    state.volume = g;
    store.set('phuzzbox.volume', g);
    if (volume) volume.gain.setTargetAtTime(g, ctx.currentTime, 0.01);
  }
  function setBypass(on) {
    state.bypass = on;
    store.set(`${key}.bypass`, on);
    foot.setAttribute('aria-pressed', String(!on));
    led.classList.toggle('on', !on);
    send({ type: 'bypass', on });
  }


  function meter(label) {
    const bar = h('span', { class: 'bar' });
    const txt = h('span', { class: 'mtxt' }, '–');
    const el = h('div', { class: 'meter' }, h('span', { class: 'mlabel' }, label), h('span', { class: 'track' }, bar), txt);
    return {
      el,
      set(volts, clip) {
        const dbv = volts > 0 ? 20 * Math.log10(volts) : -Infinity;
        bar.style.width = `${Math.max(0, Math.min(100, ((dbv + 48) / 54) * 100))}%`;
        txt.textContent = Number.isFinite(dbv) ? `${(1000 * volts).toFixed(0)} mV` : '–';
        el.classList.toggle('clip', !!clip);
      },
    };
  }

  // ---- audio
  async function start() {
    if (ctx) { await ctx.resume(); return; }
    startBtn.disabled = true;
    status.textContent = 'starting…';
    try {
      // the smallest buffer the browser will give (a number is seconds; 0 asks for its minimum)
      ctx = new AudioContext({ latencyHint: 0 });
      const [own, bass] = await Promise.all([load ? load() : fetchBytes(PEDAL.wasm.binary()).then((pedal) => ({ pedal })), fetchBytes(TESTBASS_URL())]);
      await ctx.audioWorklet.addModule(worklet);
      node = new AudioWorkletNode(ctx, 'phuzzbox', { numberOfInputs: 1, numberOfOutputs: 2, outputChannelCount: [2, 1], processorOptions: { ...own, bass } });
      node.port.onmessage = (e) => onMessage(e.data);
      volume = new GainNode(ctx, { gain: state.volume });
      // a safety curve before the speakers, so a distortion pedal at full tilt can't hurt anyone:
      // static, so it adds no delay, where a compressor would look 6 ms ahead (shared/safety.js)
      const span = new GainNode(ctx, { gain: 1 / SAFE_SPAN });
      const safety = new WaveShaperNode(ctx, { curve: safetyCurve(), oversample: 'none' });
      node.connect(volume).connect(span).connect(safety).connect(ctx.destination);
      // the views' analysers, the output's and the input's alike, so the Spectrum compares like
      // with like: blocks of about 0.17 s at any sample rate (8192 samples at 44.1 or 48 kHz),
      // bins about 6 Hz apart (shared/views.js, spectrum/README.md)
      const N = Math.min(32768, 8192 * 2 ** Math.max(0, Math.round(Math.log2(ctx.sampleRate / 48000))));
      const analyser = new AnalyserNode(ctx, { fftSize: N, smoothingTimeConstant: 0.6 });
      const inputAnalyser = new AnalyserNode(ctx, { fftSize: N, smoothingTimeConstant: 0.6 });
      node.connect(analyser);
      node.connect(inputAnalyser, 1);
      tunerAnalyser = new AnalyserNode(ctx, { fftSize: 16384 });
      node.connect(tunerAnalyser, 1);
      api.ctx = ctx; api.analyser = analyser; api.input = inputAnalyser;
      send({ type: 'params', P: { ...P } });
      send({ type: 'bypass', on: state.bypass });
      send({ type: 'fullScale', volts: state.fullScale });
      send({ type: 'source', which: state.source });
      send({ type: 'mute', on: state.mute });
      tHz.textContent = 'Play a note';
      startBtn.textContent = 'Audio on';
      document.body.classList.add('audio-on');
      status.textContent = '';
      showLatency();
      emit('audio');
      await listInputs();
    } catch (err) {
      status.textContent = `Audio failed: ${err.message}`;
      startBtn.disabled = false;
    }
  }
  async function listInputs() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
    for (const o of [...sourceSel.options]) if (o.value !== 'bass') o.remove();
    if (devices.length && devices.every((d) => !d.label)) sourceSel.append(h('option', { value: 'ask' }, 'Audio input…'));
    else for (const d of devices) sourceSel.append(h('option', { value: d.deviceId }, d.label || 'Audio input'));
    // where the sound goes: the interface itself, if it is chosen here, saves the browser resampling
    // between two devices' clocks (Chrome and Edge; elsewhere the system's output)
    const outs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput' && d.label);
    if (!ctx?.setSinkId || !outs.length) return;
    const was = sinkSel.value || store.get('phuzzbox.sink', '');
    const sys = outs.find((d) => d.deviceId === 'default');
    sinkSel.replaceChildren(h('option', { value: '', 'data-group': sys?.groupId }, 'System output'), ...outs.filter((d) => d.deviceId !== 'default').map((d) => h('option', { value: d.deviceId, 'data-group': d.groupId }, `→ ${d.label}`)));
    sinkSel.hidden = false;
    if ([...sinkSel.options].some((o) => o.value === was)) { sinkSel.value = was; if (was) setSink(was); }
  }
  async function setSink(id) {
    try { await ctx.setSinkId(id); store.set('phuzzbox.sink', id); measured = null; showLatency(); } catch (err) { status.textContent = `Output: ${err.message}`; }
  }
  function measure() {
    if (state.source !== 'input') return;
    status.textContent = 'Measuring: a click goes out and back…';
    measureBtn.disabled = true;
    send({ type: 'measure' });
  }
  async function setSource(v) {
    if (!ctx) await start();
    if (v === 'bass') { state.source = 'bass'; send({ type: 'source', which: 'bass' }); chanSel.hidden = true; measureBtn.hidden = true; showBass(); return; }
    try {
      micStream?.getTracks().forEach((t) => t.stop());
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: v === 'ask' ? undefined : { exact: v }, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 } },
      });
      if (v === 'ask') { await listInputs(); const id = micStream.getAudioTracks()[0]?.getSettings().deviceId; if (id) sourceSel.value = id; }
      connectMic();
      measured = null;
      state.source = 'input';
      send({ type: 'source', which: 'input' });
      chanSel.hidden = false; measureBtn.hidden = false;
      showBass();
      showLatency();
    } catch (err) {
      status.textContent = `No input: ${err.message}`;
      sourceSel.value = 'bass';
      setSource('bass');
    }
  }
  function connectMic() {
    if (!micStream || !ctx) return;
    micSource?.disconnect(); splitter?.disconnect();
    micSource = new MediaStreamAudioSourceNode(ctx, { mediaStream: micStream });
    const n = micSource.channelCount;
    splitter = new ChannelSplitterNode(ctx, { numberOfOutputs: Math.max(1, n) });
    micSource.connect(splitter);
    const ch = Math.min(state.channel, Math.max(0, n - 1));
    const mono = new GainNode(ctx, { channelCount: 1, channelCountMode: 'explicit' });
    splitter.connect(mono, ch);
    mono.connect(node);
  }
  let measured = null;
  function showLatency() {
    if (!ctx) return;
    if (measured != null) {
      latency.textContent = `round trip ${measured.toFixed(1)} ms (measured)`;
      latency.title = 'Measured with a cable from the output back to the input';
      latency.classList.toggle('warn', measured > 15);
      return;
    }
    const track = micStream?.getAudioTracks()[0]?.getSettings();
    const input = state.source === 'input' ? track?.latency || 0 : 0, base = ctx.baseLatency || 0, output = ctx.outputLatency || 0;
    const ms = 1000 * (input + base + output);
    latency.textContent = ms ? `latency ≈ ${ms.toFixed(0)} ms` : 'latency –';
    latency.classList.toggle('warn', ms > 40);
    // where the estimate comes from, and the usual reason it is large (the output is yours to choose)
    const f = (x) => `${(1000 * x).toFixed(1)} ms`;
    const parts = [`The browser's estimate of the delay from input to output, at ${(ctx.sampleRate / 1000).toFixed(1)} kHz:`];
    if (state.source === 'input') parts.push(`input ${f(input)}`);
    parts.push(`processing ${f(base)}`, `output ${f(output)}`);
    const group = track?.groupId, out = sinkSel.selectedOptions[0];
    if (state.source === 'input' && group && !sinkSel.hidden && out?.dataset.group !== group) parts.push('The output is not on the interface the input is: choosing that interface\'s output usually saves the most.');
    latency.title = parts.join('\n');
  }
  function onMessage(m) {
    if (m.type === 'levels') {
      meterIn.set(m.inPeak, state.source === 'input' && m.inPeak / state.fullScale > 0.98);
      meterOut.set(m.outPeak, m.outPeak / state.fullScale > 0.98);
    } else if (m.type === 'stats') {
      cpu.textContent = `CPU ${(100 * m.load).toFixed(1)}%`;
      showLatency();
    } else if (m.type === 'measured') {
      measureBtn.disabled = false;
      if (m.ms == null) { status.textContent = 'Nothing came back: is a cable connected from the output to this input?'; return; }
      status.textContent = '';
      measured = m.ms;
      showLatency();
    } else if (m.type === 'pedal') for (const fn of listeners.pedal) fn(m.messages, api);
    else if (m.type === 'error') status.textContent = m.message;
  }
  // the tuner, ten times a second
  function setMute(on) {
    state.mute = on;
    send({ type: 'mute', on });
    muteBtn.setAttribute('aria-pressed', String(on));
    muteBtn.textContent = on ? 'Muted: unmute' : 'Mute while tuning';
  }
  const buf = new Float32Array(16384);
  setInterval(() => {
    if (!tunerAnalyser || document.hidden) return;
    tunerAnalyser.getFloatTimeDomainData(buf);
    const n = tuning.push(tune(buf, ctx.sampleRate), ctx.currentTime);
    api.note = n; // for the views: the spectra mark the note being played (shared/plot.js markNote)
    tunerCard.classList.toggle('idle', !n);
    tunerCard.classList.toggle('stale', !!n && !n.live);
    tunerCard.classList.toggle('intune', !!n && Math.abs(n.cents) < 3);
    if (!n) { tNote.textContent = '–'; tOct.textContent = ''; tCents.textContent = ''; tHz.textContent = 'Play a note'; tString.textContent = ''; return; }
    tNote.textContent = n.letter; tOct.textContent = n.octave;
    tCents.textContent = `${n.cents >= 0.05 ? '+' : n.cents <= -0.05 ? '−' : '±'}${Math.abs(n.cents).toFixed(1)}¢`;
    tHz.textContent = `${n.f.toFixed(2)} Hz, in tune at ${n.target.toFixed(2)}`;
    tString.textContent = OPEN_STRINGS.includes(n.key) ? `open ${n.letter} string` : '';
    tNeedle.style.left = `${50 + Math.max(-50, Math.min(50, n.cents))}%`;
  }, 100);

  // ---- the test bass: on screen only while it is the input
  const held = new Set();
  function showBass() {
    const on = state.source === 'bass';
    if (!on && riff) toggleRiff();
    bass.hidden = !on;
    document.body.classList.toggle('bass-off', !on);
    layout.arrange();
  }
  async function play(k, v) {
    if (!ctx) await start();
    if (state.source !== 'bass') { sourceSel.value = 'bass'; await setSource('bass'); }
    send({ type: 'note', key: k, velocity: v });
  }
  const stop = (k) => send({ type: 'noteOff', key: k });
  let riff = null;
  function toggleRiff() {
    if (riff) { clearTimeout(riff); riff = null; riffBtn.textContent = 'Play a riff'; return; }
    riffBtn.textContent = 'Stop';
    let i = 0;
    const beat = 60 / RIFF_BPM;
    const next = () => {
      const [k, b] = RIFF[i % RIFF.length];
      // each note lights its fret while it sounds, so the riff can be followed on the board
      if (k) { fretOfKey.get(k)?.classList.add('down'); play(k, 0.6 + 0.2 * ((i % 4) === 0)); setTimeout(() => { fretOfKey.get(k)?.classList.remove('down'); stop(k); }, 1000 * b * beat * 0.85); }
      i++;
      riff = setTimeout(next, 1000 * b * beat);
    };
    next();
  }
  const codeKey = new Map(ROWS.flatMap((row, s) => row.map((c, f) => [c, OPEN[s] + f])));
  addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.('input, select, textarea, [role=slider]')) return;
    const k = codeKey.get(e.code);
    if (k !== undefined && state.source === 'bass') { e.preventDefault(); held.add(e.code); fretOf.get(e.code)?.classList.add('down'); play(k, 0.75); }
    else if (e.code === 'Space') {
      // Space is the footswitch, except on a button, menu or link reached with the keyboard
      // (:focus-visible), which Space presses as usual; one clicked with the mouse keeps focus
      // without it, and Space there is still the footswitch
      const t = e.target;
      if (t !== foot && t.closest?.('button, summary, a[href], [role=button], [role=tab]') && t.matches?.(':focus-visible')) return;
      e.preventDefault(); setBypass(!state.bypass);
    }
  });
  addEventListener('keyup', (e) => { const k = codeKey.get(e.code); if (k !== undefined && held.delete(e.code)) { fretOf.get(e.code)?.classList.remove('down'); stop(k); } });

  // ---- what a guided tour (shared/tour.js) drives: the settings, the footswitch, the source,
  // the test bass (its frets lit as it plays), the views and the controls a step changes
  // (the tour's only way into the page: a new layout keeps these and the tour follows it)
  api.page = {
    notesBtn, // Tour goes just before it
    tourSlot: layout.tourSlot, // the tour's card is appended here (above the test bass)
    start,
    // every parameter at once, and the same for the page's Controls, knobs, views and storage
    get: () => ({ ...P }),
    setAll(want) {
      Object.assign(P, want);
      store.set(`${key}.params`, P);
      send({ type: 'params', P: { ...P } });
      refresh();
      emit('params');
    },
    defaults: () => defaults(PEDAL.groups),
    bypassed: () => state.bypass, setBypass,
    muted: () => state.mute, setMute,
    // the tour plays the test bass; the source the player chose comes back when it ends
    source: () => sourceSel.value,
    useBass() { if (state.source !== 'bass') { sourceSel.value = 'bass'; state.source = 'bass'; send({ type: 'source', which: 'bass' }); showBass(); } },
    restoreSource(v) {
      if (!v || v === 'bass' || !micStream || ![...sourceSel.options].some((o) => o.value === v)) return;
      sourceSel.value = v; state.source = 'input'; send({ type: 'source', which: 'input' }); showBass();
    },
    press(k, vel) { fretOfKey.get(k)?.classList.add('down'); play(k, vel); },
    release(k) { fretOfKey.get(k)?.classList.remove('down'); stop(k); },
    // the controls of these parameters: their rows in Controls, and their knobs
    controls: (ids) => ids.flatMap((id) => [document.getElementById(`p-${id}`)?.closest('.row'), knobs.querySelector(`[data-param="${id}"]`)]).filter(Boolean),
    // only these views, by title ('Tuner' too; the pedal stays), for a while; null brings them all back
    showViews: layout.showViews,
    viewNames: () => layout.viewNames().filter((n) => n !== 'Pedal'),
  };

  setBypass(state.bypass);
  setInterface();
  chanSel.hidden = true;
  refresh();
  pageIs(api);
  return api;
}
