// midi-panel.js — the MIDI card on a pedal's page: Web MIDI (Chrome and Edge) or the app's own
// MIDI (window.phuzzMidi(status, d1, d2)), the mappings from control changes to the page's
// controls (shared/midi.js), MIDI learn, a monitor of the last message, and a drawing of the FC-300
// that says what each of its pedals does here and lights as they arrive. The drawing shows twice:
// at the top of the card, and as the FC-300 view under the pedal, for playing. The shell hands it
// what the page can do (ui) and puts its elements in the page.
//
//   const midi = midiPanel({ PEDAL, h, store, key, ui });
//   ui = { setVolume(gain), bypassed(), setBypass(on), muted(), setMute(on), value(id), set(id, v),
//          presets: [names], applyPreset(name),
//          and if the page has them: tuning(), setTuning(on), tap() (→ the tempo, or null),
//          metronome(), setMetronome(on), program(n) (a program change; else the n-th preset),
//          extra: { targets, isOn(id), act(action) } (the Pedalboard's own) }
//   midi.el is the card, midi.view the FC-300 view's card.

import { MidiMap, FC300, audioTaper, SWITCH_MODES } from './midi.js';
import { fromUnit } from './params.js';

export function midiPanel({ PEDAL, h, store, key, ui, defaults = null }) {
  const only = ['volume', 'bypass', 'mute', ...(ui.setTuning ? ['tuner'] : []), ...(ui.tap ? ['tap'] : []), ...(ui.setMetronome ? ['metronome'] : [])];
  const saved = store.get(`${key}.midi`, null);
  const map = new MidiMap(PEDAL, saved, { extra: ui.extra?.targets ?? [], only, defaults });
  const all = [...map.targets.values()];
  const save = () => store.set(`${key}.midi`, map.mappings);
  let access = null, lastPreset = null, bpm = null;
  const value = new Map(); // CC → its last value, for the expression pedals' travel
  const boards = []; // the drawings of the FC-300: the card's and the view's
  const rowEls = [];

  const status = h('span', { class: 'midi-status' }, navigator.requestMIDIAccess ? 'not connected' : 'Web MIDI needs Chrome or Edge');
  const connectBtn = h('button', { type: 'button', class: 'ghost', hidden: !navigator.requestMIDIAccess, onclick: () => connect() }, 'Connect MIDI');
  const inSel = h('select', { 'aria-label': 'MIDI input', hidden: true, onchange: () => { store.set('phuzzbox.midiInput', inSel.value); listen(); } });
  const last = h('span', { class: 'pill midi-last', title: 'The last control change that arrived, on any input' }, 'last: –');
  const rowsEl = h('div', { class: 'midi-maps' });
  const addBtn = h('button', { type: 'button', class: 'ghost', onclick: () => { const i = map.add(); save(); draw(); map.learn(i); draw(); } }, '+ Add a pedal');
  const resetBtn = h('button', { type: 'button', class: 'ghost', title: 'Every pedal of the FC-300 as it leaves the factory in Control Change mode, mapped for playing this page (drawn above)', onclick: () => { map.reset(); save(); draw(); } }, 'FC-300 live layout');
  const help = h('p', { class: 'midi-help' }, 'A MIDI foot controller works this page: plug it in (an FC-300 through a USB MIDI interface such as a UM-ONE, its switch on TAB), put it in Control Change mode, and press Connect MIDI. The drawing says what each of its pedals does here; Learn, then move a pedal, teaches a row that pedal. ',
    ui.about ? h('button', { type: 'button', class: 'link', onclick: () => ui.about() }, 'Setting up the FC-300') : null);
  const boardEl = footboard(true);
  const el = h('section', { class: 'midi', 'aria-label': 'MIDI' },
    h('div', { class: 'midi-bar' }, h('b', {}, 'MIDI pedals'), status, connectBtn, inSel, last),
    help, boardEl.el, rowsEl, h('div', { class: 'midi-actions' }, addBtn, resetBtn));
  const viewBoard = footboard(false);
  const viewStatus = h('span', { class: 'fc-status' }, '');
  const view = h('figure', { class: 'card fc-card', 'aria-label': 'FC-300', 'data-view': 'FC-300', 'data-keep-text': '' },
    h('figcaption', {}, h('b', {}, 'FC-300'), viewStatus), viewBoard.el);

  // ---- the mappings
  function draw() {
    rowEls.length = 0;
    rowsEl.replaceChildren(...map.mappings.map((m, i) => {
      const t = map.targets.get(m.target);
      const cc = h('input', { type: 'number', min: 0, max: 119, value: m.cc, 'aria-label': 'Control change number' });
      cc.addEventListener('change', () => { m.cc = Math.max(0, Math.min(119, Math.round(+cc.value) || 0)); cc.value = m.cc; save(); drawBoards(); });
      const ch = h('select', { 'aria-label': 'MIDI channel', onchange: () => { m.channel = +ch.value; save(); } },
        h('option', { value: 0 }, 'any channel'), ...Array.from({ length: 16 }, (_, k) => h('option', { value: k + 1 }, `channel ${k + 1}`)));
      ch.value = m.channel;
      const target = h('select', { 'aria-label': 'What it moves', onchange: () => { m.target = target.value; save(); draw(); } },
        ...all.map((x) => h('option', { value: x.id }, x.label)));
      target.value = m.target;
      const isSwitch = t.kind === 'switch' || t.kind === 'press';
      const mode = h('select', { 'aria-label': 'Switch type', hidden: !isSwitch, onchange: () => { m.mode = mode.value; save(); } },
        ...SWITCH_MODES.filter(([v]) => t.kind === 'switch' || v !== 'latch').map(([v, l]) => h('option', { value: v }, t.kind === 'press' && v === 'toggle' ? 'latching (each message a press)' : l)));
      mode.value = t.kind === 'press' && m.mode === 'latch' ? 'toggle' : m.mode;
      const inv = h('input', { type: 'checkbox', 'aria-label': 'Reverse the pedal' });
      inv.checked = !!m.invert;
      inv.addEventListener('change', () => { m.invert = inv.checked; save(); });
      const learning = map.learning === i;
      const learn = h('button', { type: 'button', class: `ghost learn${learning ? ' on' : ''}`, 'aria-pressed': String(learning), onclick: () => { if (map.learning === i) map.cancelLearn(); else map.learn(i); draw(); } }, learning ? 'Move a pedal…' : 'Learn');
      const del = h('button', { type: 'button', class: 'ghost', 'aria-label': 'Remove this pedal', onclick: () => { map.remove(i); save(); draw(); } }, '✕');
      const row = h('div', { class: 'mrow', 'data-cc': m.cc },
        h('label', { class: 'inline' }, 'CC ', cc), h('span', { class: 'fc-name' }, nameOf(m.cc)), ch, h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→'), target, mode,
        h('label', { class: 'inline', hidden: isSwitch }, inv, 'reverse'), learn, del);
      rowEls.push(row);
      return row;
    }));
    if (!map.mappings.length) rowsEl.append(h('p', { class: 'midi-help' }, 'No pedals mapped: + Add a pedal, then move it, or FC-300 live layout.'));
    drawBoards();
  }

  // ---- the FC-300, drawn: what each of its pedals does on this page, lit while it is on
  // the FC-300's name for a CC, in Control Change mode as it leaves the factory
  function nameOf(cc) {
    const k = FC300.pedals.indexOf(cc);
    if (k >= 0) return `pedal ${k + 1}`;
    if (cc === FC300.exp1) return 'EXP 1';
    if (cc === FC300.exp2) return 'EXP 2';
    if (FC300.ctl.includes(cc)) return `CTL ${FC300.ctl.indexOf(cc) + 1}`;
    if (FC300.expSw.includes(cc)) return `EXP ${FC300.expSw.indexOf(cc) + 1} toe`;
    return '';
  }
  const short = (t) => {
    if (!t) return '';
    if (t.short) return t.short();
    if (t.id === 'bypass') return 'On/off';
    if (t.id === 'tap') return bpm ? `Tap · ${bpm}/min` : 'Tap tempo';
    if (t.id === 'tuner') return 'Tuner';
    if (t.id === 'volume') return 'Volume';
    if (t.preset) return t.preset;
    return t.label;
  };
  const isOn = (t) => {
    if (t.id === 'bypass') return !ui.bypassed();
    if (t.id === 'tuner') return !!ui.tuning?.();
    if (t.id === 'mute') return ui.muted();
    if (t.id === 'metronome') return !!ui.metronome?.();
    if (t.preset) return t.preset === lastPreset;
    if (t.param?.type === 'checkbox') return !!ui.value(t.param.id);
    if (ui.extra?.targets.some((x) => x.id === t.id)) return ui.extra.isOn(t.id);
    return null;
  };
  function footboard(teach) {
    const cells = [];
    // one line: a CC's number or bank, what it does, and its light
    const line = (cc, tag) => {
      const led = h('i', { class: 'fc-led', 'aria-hidden': 'true' }), what = h('span', { class: 'fc-what' });
      const el = h('span', { class: 'fc-line' }, tag ? h('small', {}, tag) : null, what, led);
      cells.push({ cc, line: el, what, led });
      return el;
    };
    const cell = (cls, name, ...lines) => {
      const c = h(teach ? 'button' : 'div', { class: `fc-pedal ${cls}`, ...(teach ? { type: 'button', title: 'Show its rows below' } : {}) }, h('b', {}, name), ...lines);
      if (teach) c.addEventListener('click', () => { const ccs = [...c.querySelectorAll('.fc-line')].map((l) => +l.dataset.cc); const r = rowEls.filter((x) => ccs.includes(+x.dataset.cc)); r[0]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); for (const x of r) flash(x); c.blur(); });
      return c;
    };
    const exp = (n) => {
      const travel = h('i', { class: 'fc-travel', 'aria-hidden': 'true' });
      const c = cell('fc-exp', `EXP ${n + 1}`, line(n ? FC300.exp2 : FC300.exp1), h('span', { class: 'fc-rail', 'aria-hidden': 'true' }, travel), line(FC300.expSw[n], 'toe'));
      cells.push({ cc: n ? FC300.exp2 : FC300.exp1, travel });
      return c;
    };
    // drawn as a map of its controls, not to scale: the control pedals and the expression pedals
    // (each with its toe switch) above, the five number pedals (1–5, or 6–10 after the bank pedal)
    const el = h('div', { class: 'fc300', role: 'group', 'aria-label': 'What the FC-300\'s pedals do here' },
      h('div', { class: 'fc-top' }, ...FC300.ctl.map((cc, i) => cell('fc-ctl', `CTL ${i + 1}`, line(cc))), exp(0), exp(1)),
      h('div', { class: 'fc-nums' }, ...[0, 1, 2, 3, 4].map((k) => cell('fc-num', `${k + 1} · ${k + 6}`, line(FC300.pedals[k], `${k + 1}`), line(FC300.pedals[k + 5], `${k + 6}`)))));
    for (const c of cells) if (c.line) c.line.dataset.cc = c.cc;
    const b = { el, cells };
    boards.push(b);
    return b;
  }
  function drawBoards() {
    for (const b of boards) for (const c of b.cells) {
      if (c.travel) { const v = value.get(c.cc); c.travel.style.setProperty('--x', v == null ? 0.5 : v / 127); continue; }
      const ts = map.of(c.cc);
      const what = ts.length ? ts.map(short).join(' + ') : '–';
      if (c.what.textContent !== what) c.what.textContent = what; // unchanged, left alone: the page doesn't lay out again
      c.line.title = `${nameOf(c.cc)}, CC ${c.cc}: ${ts.length ? ts.map(short).join(' and ') : 'nothing yet (Learn teaches it)'}`;
      c.line.classList.toggle('free', !ts.length);
      const on = ts.map(isOn).filter((x) => x !== null);
      c.led.hidden = !on.length;
      c.led.classList.toggle('on', on.some(Boolean));
    }
  }
  function flash(x) { x.classList.remove('hit'); void x.offsetWidth; x.classList.add('hit'); }
  draw();
  // the screen moves what the pedals move too: the lights follow it
  setInterval(() => { if (!document.hidden && (el.isConnected || view.isConnected)) drawBoards(); }, 300);

  // ---- what a message does
  function act(a) {
    if (a.program !== undefined) {
      if (ui.program) return ui.program(a.program);
      const name = ui.presets[a.program];
      if (name) { lastPreset = name; ui.applyPreset(name); }
      return;
    }
    const on = (now) => (a.toggle ? !now : a.value);
    const t = map.targets.get(a.target);
    if (a.target === 'volume') ui.setVolume(audioTaper(a.value));
    else if (a.target === 'bypass') ui.setBypass(!on(!ui.bypassed()));
    else if (a.target === 'tuner') ui.setTuning(on(ui.tuning()));
    else if (a.target === 'mute') ui.setMute(on(ui.muted()));
    else if (a.target === 'metronome') ui.setMetronome(on(ui.metronome()));
    else if (a.target === 'tap') bpm = ui.tap() ?? bpm;
    else if (t.preset) { lastPreset = t.preset; ui.applyPreset(t.preset); }
    else if (t.param) {
      const p = t.param;
      if (p.type === 'checkbox') ui.set(p.id, on(!!ui.value(p.id)));
      else if (p.type === 'select') ui.set(p.id, p.options[a.value][0]);
      else ui.set(p.id, fromUnit(p, a.value));
    } else ui.extra?.act({ ...a, on: a.toggle ? !ui.extra.isOn(a.target) : a.value });
  }
  function feed(data) {
    const r = map.message(data);
    if (!r) return;
    if (r.cc !== undefined) {
      const name = nameOf(r.cc);
      last.textContent = `last: ${name ? `${name}, ` : ''}CC ${r.cc} = ${r.value} · ch ${r.channel}`;
      value.set(r.cc, r.value);
    } else last.textContent = `last: program ${r.program + 1} · ch ${r.channel}`;
    if (r.learned >= 0) { save(); draw(); }
    for (const a of r.actions) act(a);
    if (r.cc !== undefined) {
      map.mappings.forEach((m, i) => { if (m.cc === r.cc && rowEls[i]) flash(rowEls[i]); });
      for (const b of boards) for (const c of b.cells) if (c.cc === r.cc && c.line) flash(c.line.closest('.fc-pedal'));
    }
    drawBoards();
  }
  // the app's window has no Web MIDI; its program hands the page the bytes
  window.phuzzMidi = (s, d1, d2) => { setStatus('from the app'); feed([s, d1, d2]); };
  const setStatus = (s) => { status.textContent = s; viewStatus.textContent = s; };

  // ---- Web MIDI
  function listen() {
    if (!access) return;
    const inputs = [...access.inputs.values()];
    const want = store.get('phuzzbox.midiInput', '');
    inSel.replaceChildren(h('option', { value: '' }, 'every MIDI input'), ...inputs.map((p) => h('option', { value: p.id }, p.name)));
    inSel.value = inputs.some((p) => p.id === want) ? want : '';
    inSel.hidden = !inputs.length;
    for (const p of inputs) p.onmidimessage = !inSel.value || inSel.value === p.id ? (e) => feed(e.data) : null;
    setStatus(inputs.length ? `listening to ${inputs.length === 1 ? inputs[0].name : `${inputs.length} inputs`}` : 'connected, but no MIDI input: plug in the interface');
  }
  async function connect() {
    if (!navigator.requestMIDIAccess) return;
    try {
      access = await navigator.requestMIDIAccess({ sysex: false });
      access.onstatechange = () => listen();
      connectBtn.hidden = true;
      listen();
    } catch (err) {
      setStatus(`MIDI was not allowed (${err.message})`);
    }
  }
  setStatus(status.textContent);
  // connect without asking when the browser already allows it
  navigator.permissions?.query({ name: 'midi' }).then((s) => { if (s.state === 'granted') connect(); }).catch(() => {});

  return { el, view, map, feed, setStatus, refresh: drawBoards };
}
