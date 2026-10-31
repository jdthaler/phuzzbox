// midi-panel.js — the MIDI card on a pedal's page: Web MIDI (Chrome and Edge) or the app's own
// MIDI (window.phuzzMidi(status, d1, d2)), the mappings from control changes to the page's
// controls (shared/midi.js), MIDI learn, and a monitor of the last message, so you can see a
// pedal arrive. The shell hands it what the page can do (ui) and puts its element in the page.
//
//   const midi = midiPanel({ PEDAL, h, store, key, ui });
//   ui = { setVolume(gain), bypassed(), setBypass(on), muted(), setMute(on), value(id), set(id, v),
//          presets: [names], applyPreset(name) }

import { MidiMap, defaultMappings, targets, audioTaper, SWITCH_MODES } from './midi.js';
import { fromUnit } from './params.js';

export function midiPanel({ PEDAL, h, store, key, ui }) {
  const map = new MidiMap(PEDAL, store.get(`${key}.midi`, null) ?? defaultMappings(PEDAL));
  const all = targets(PEDAL);
  const save = () => store.set(`${key}.midi`, map.mappings);
  let access = null;

  const status = h('span', { class: 'midi-status' }, navigator.requestMIDIAccess ? 'not connected' : 'Web MIDI needs Chrome or Edge');
  const connectBtn = h('button', { type: 'button', class: 'ghost', hidden: !navigator.requestMIDIAccess, onclick: () => connect() }, 'Connect MIDI');
  const inSel = h('select', { 'aria-label': 'MIDI input', hidden: true, onchange: () => { store.set('phuzzbox.midiInput', inSel.value); listen(); } });
  const last = h('span', { class: 'pill midi-last', title: 'The last control change that arrived, on any input' }, 'last: –');
  const rowsEl = h('div', { class: 'midi-maps' });
  const addBtn = h('button', { type: 'button', class: 'ghost', onclick: () => { const i = map.add(); save(); draw(); map.learn(i); draw(); } }, '+ Add a pedal');
  const resetBtn = h('button', { type: 'button', class: 'ghost', title: 'Expression pedal 1 (CC 7) the volume, expression pedal 2 (CC 1) the pedal\'s expression control, number pedal 1 (CC 65) the footswitch, number pedal 2 (CC 66) the tuner\'s mute', onclick: () => { map.reset(); save(); draw(); } }, 'FC-300 defaults');
  const el = h('section', { class: 'midi', 'aria-label': 'MIDI' },
    h('div', { class: 'midi-bar' }, h('b', {}, 'MIDI pedals'), status, connectBtn, inSel, last),
    h('p', { class: 'midi-help' }, 'A MIDI foot controller moves the controls below: plug it in (an FC-300 through a USB MIDI interface such as a UM-ONE, its switch on TAB), set it to Control Change mode, and press Connect MIDI. Learn, then move a pedal, teaches a row that pedal.'),
    rowsEl, h('div', { class: 'midi-actions' }, addBtn, resetBtn));

  // ---- the mappings
  const rowEls = [];
  function draw() {
    rowEls.length = 0;
    rowsEl.replaceChildren(...map.mappings.map((m, i) => {
      const t = map.targets.get(m.target);
      const cc = h('input', { type: 'number', min: 0, max: 119, value: m.cc, 'aria-label': 'Control change number' });
      cc.addEventListener('change', () => { m.cc = Math.max(0, Math.min(119, Math.round(+cc.value) || 0)); cc.value = m.cc; save(); });
      const ch = h('select', { 'aria-label': 'MIDI channel', onchange: () => { m.channel = +ch.value; save(); } },
        h('option', { value: 0 }, 'any channel'), ...Array.from({ length: 16 }, (_, k) => h('option', { value: k + 1 }, `channel ${k + 1}`)));
      ch.value = m.channel;
      const target = h('select', { 'aria-label': 'What it moves', onchange: () => { m.target = target.value; save(); draw(); } },
        ...all.map((x) => h('option', { value: x.id }, x.label)));
      target.value = m.target;
      const mode = h('select', { 'aria-label': 'Switch type', hidden: t.kind !== 'switch', onchange: () => { m.mode = mode.value; save(); } },
        ...SWITCH_MODES.map(([v, l]) => h('option', { value: v }, l)));
      mode.value = m.mode;
      const inv = h('input', { type: 'checkbox', 'aria-label': 'Reverse the pedal' });
      inv.checked = !!m.invert;
      inv.addEventListener('change', () => { m.invert = inv.checked; save(); });
      const learning = map.learning === i;
      const learn = h('button', { type: 'button', class: `ghost learn${learning ? ' on' : ''}`, 'aria-pressed': String(learning), onclick: () => { if (map.learning === i) map.cancelLearn(); else map.learn(i); draw(); } }, learning ? 'Move a pedal…' : 'Learn');
      const del = h('button', { type: 'button', class: 'ghost', 'aria-label': 'Remove this pedal', onclick: () => { map.remove(i); save(); draw(); } }, '✕');
      const row = h('div', { class: 'mrow' },
        h('label', { class: 'inline' }, 'CC ', cc), ch, h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→'), target, mode,
        h('label', { class: 'inline', hidden: t.kind === 'switch' }, inv, 'reverse'), learn, del);
      rowEls.push(row);
      return row;
    }));
    if (!map.mappings.length) rowsEl.append(h('p', { class: 'midi-help' }, 'No pedals mapped: + Add a pedal, then move it.'));
  }
  draw();

  // ---- what a message does
  function act(a) {
    if (a.program !== undefined) { const name = ui.presets[a.program]; if (name) ui.applyPreset(name); return; }
    const on = (now) => (a.toggle ? !now : a.value);
    if (a.target === 'volume') ui.setVolume(audioTaper(a.value));
    else if (a.target === 'bypass') ui.setBypass(!on(!ui.bypassed()));
    else if (a.target === 'mute') ui.setMute(on(ui.muted()));
    else {
      const p = map.targets.get(a.target).param;
      if (p.type === 'checkbox') ui.set(p.id, on(!!ui.value(p.id)));
      else if (p.type === 'select') ui.set(p.id, p.options[a.value][0]);
      else ui.set(p.id, fromUnit(p, a.value));
    }
  }
  function feed(data) {
    const r = map.message(data);
    if (!r) return;
    if (r.cc !== undefined) last.textContent = `last: CC ${r.cc} = ${r.value} · ch ${r.channel}`;
    else last.textContent = `last: program ${r.program + 1} · ch ${r.channel}`;
    if (r.learned >= 0) { save(); draw(); }
    for (const a of r.actions) act(a);
    if (r.cc !== undefined) map.mappings.forEach((m, i) => { if (m.cc === r.cc && rowEls[i]) { rowEls[i].classList.remove('hit'); void rowEls[i].offsetWidth; rowEls[i].classList.add('hit'); } });
  }
  // the app's window has no Web MIDI; its program hands the page the bytes
  window.phuzzMidi = (s, d1, d2) => { status.textContent = 'from the app'; feed([s, d1, d2]); };

  // ---- Web MIDI
  function listen() {
    if (!access) return;
    const inputs = [...access.inputs.values()];
    const want = store.get('phuzzbox.midiInput', '');
    inSel.replaceChildren(h('option', { value: '' }, 'every MIDI input'), ...inputs.map((p) => h('option', { value: p.id }, p.name)));
    inSel.value = inputs.some((p) => p.id === want) ? want : '';
    inSel.hidden = !inputs.length;
    for (const p of inputs) p.onmidimessage = !inSel.value || inSel.value === p.id ? (e) => feed(e.data) : null;
    status.textContent = inputs.length ? `listening to ${inputs.length === 1 ? inputs[0].name : `${inputs.length} inputs`}` : 'connected, but no MIDI input: plug in the interface';
  }
  async function connect() {
    if (!navigator.requestMIDIAccess) return;
    try {
      access = await navigator.requestMIDIAccess({ sysex: false });
      access.onstatechange = () => listen();
      connectBtn.hidden = true;
      listen();
    } catch (err) {
      status.textContent = `MIDI was not allowed (${err.message})`;
    }
  }
  // connect without asking when the browser already allows it
  navigator.permissions?.query({ name: 'midi' }).then((s) => { if (s.state === 'granted') connect(); }).catch(() => {});

  return { el, map, feed };
}
