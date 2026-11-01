// app.js — the PhuzzBox app's window: the pedal's face, the tuner, the audio settings and the
// Controls, drawn from the same descriptors and modules as the site's page (shell.js), talking to
// the program through window.phuzz(method, …args) (main.cpp's Program::call). It runs in the
// program's web view as one page, bundled by tools/bundle-app.mjs. The menu in the header picks
// the pedal: the program swaps it and the window is drawn again for it. MIDI foot controllers are
// the site's MIDI card (shared/midi-panel.js), fed by the program's MIDI (window.phuzzMidi).

import { params, defaults, fmt, toUnit, fromUnit, nativeValue } from '../../shared/params.js';
import { Tuner, OPEN_STRINGS } from '../../shared/tuner.js';
import { INTERFACES, byInterface, fullScaleVolts } from '../../shared/interfaces.js';
import { midiPanel } from '../../shared/midi-panel.js';
import { createLayout } from '../../shared/layout.js';
// every pedal the app plays, as native/app/pedals.cpp lists them (test/native-tests.mjs checks)
import { PEDAL as BUFFER } from '../../buffer/src/buffer-pedal.js';
import { PEDAL as PHUZZ } from '../../phuzz/src/phuzz-pedal.js';
import { PEDAL as WAH } from '../../wah/src/wah-pedal.js';
import { PEDAL as PREAMP } from '../../preamp/src/preamp-pedal.js';
const DESCRIPTORS = Object.fromEntries([BUFFER, PHUZZ, WAH, PREAMP].map((d) => [d.id, d]));

const call = (...args) => window.phuzz(...args);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
};

const FRAMES = [16, 32, 64, 128, 256, 512];
// the window is drawn again for each pedal; what is left running (the poll, the keys) checks it
// still belongs to the window as drawn now
let drawn = 0;

async function main(info, carry = {}) {
  const me = ++drawn;
  const PEDAL = DESCRIPTORS[info.pedal] ?? BUFFER;
  const all = params(PEDAL.groups);
  document.documentElement.dataset.pedal = PEDAL.id;
  const S = info.settings ?? {};
  const P = { ...defaults(PEDAL.groups), ...(info.params ?? {}) };
  for (const p of all) if (!(p.id in P)) P[p.id] = p.def;
  // the bass and how it is plugged in are the same whichever pedal it plays
  for (const id of PEDAL.keep ?? []) if (id in carry && all.some((p) => p.id === id)) P[id] = carry[id];
  const audio = { input: '', output: '', frames: 64, rate: 0, channel: 0, bypass: 0, fullScale: 1, interface: '', gain: 20, volume: 1, ...(S.audio ?? {}) };
  const ui = { a4: 440, ...(S.ui ?? {}) };
  let stream = info.stream;

  const app = document.getElementById('app');
  app.replaceChildren();
  const status = h('span', { class: 'status' });
  const pedalSel = h('select', { 'aria-label': 'Pedal', class: 'pedal-pick', title: 'The pedal to play; each keeps its own settings' },
    ...(info.pedals ?? []).filter((d) => DESCRIPTORS[d.slug]).map((d) => h('option', { value: d.slug }, d.name)));
  pedalSel.value = PEDAL.id;
  pedalSel.addEventListener('change', async () => {
    pedalSel.disabled = true;
    status.textContent = 'switching…';
    clearTimeout(saveTimer);
    await call('store', 'params', P);
    main(await call('pedal', pedalSel.value), Object.fromEntries((PEDAL.keep ?? []).map((id) => [id, P[id]])));
  });
  const streamPill = h('span', { class: 'pill', title: 'The sample rate and buffer, and the round trip the buffers make' }, '–');
  const cpu = h('span', { class: 'pill', title: 'The share of the audio thread\'s time the pedal takes' }, 'CPU –');

  // ---- audio: the interface, its channel, the output, the buffer, Full scale
  const inSel = h('select', { 'aria-label': 'Input' }, ...info.inputs.map((d) => h('option', { value: d.name }, d.name)));
  const chanSel = h('select', { 'aria-label': 'Input channel' });
  const outSel = h('select', { 'aria-label': 'Output' }, ...info.outputs.map((d) => h('option', { value: d.name }, d.name)));
  const frameSel = h('select', { 'aria-label': 'Buffer size' }, ...FRAMES.map((n) => h('option', { value: n }, `${n} samples`)));
  const measureBtn = h('button', { type: 'button', class: 'ghost', title: 'Measure the real round trip: a cable from the interface\'s output to the input you chose, with its direct monitoring off', onclick: () => measure() }, 'Measure latency');
  const measured = h('span', { class: 'pill', hidden: true });
  const ifaceSel = h('select', { 'aria-label': 'Audio interface' }, h('option', { value: '' }, 'Other interface'), ...INTERFACES.map((i) => h('option', { value: i.id }, i.name)));
  const gainInput = h('input', { type: 'number', min: 0, max: 62, step: 1, 'aria-label': 'Interface gain in decibels' });
  const gainLabel = h('label', { class: 'inline' }, 'Gain ', gainInput, ' dB');
  const fsInput = h('input', { type: 'number', min: 0.05, max: 20, step: 0.05, 'aria-label': 'Volts at full scale' });
  const volInput = h('input', { type: 'range', class: 'fader', min: 0, max: 1, step: 0.01, 'aria-label': 'Volume after the pedal' });
  const volOut = h('output', {});
  // the audio, in the Controls panel: where it comes from and goes, and the buffer
  const audioGroup = h('fieldset', { class: 'group rig audio-group' }, h('legend', {}, 'Audio'),
    h('div', { class: 'row' }, h('label', {}, 'Input'), inSel, chanSel),
    h('div', { class: 'row' }, h('label', {}, 'Output'), outSel),
    h('div', { class: 'row', title: 'Smaller is quicker; if you hear clicks, take the next size up' }, h('label', {}, 'Buffer'), frameSel),
    h('div', { class: 'measure-row' }, measureBtn, measured));
  // the rig: what turns the samples into volts at the input jack
  const rigGroup = h('fieldset', { class: 'group rig' }, h('legend', {}, 'Rig'),
    h('div', { class: 'row' }, h('label', {}, 'Audio interface'), ifaceSel, gainLabel),
    h('div', { class: 'row', title: 'How many volts at the input jack make a full-scale sample' }, h('label', {}, 'Full scale'), h('span', { class: 'inline' }, fsInput, ' V')),
    h('p', { class: 'rig-note' }, 'Choose your interface and its gain, and Full scale comes from the maker\'s specification.'));
  // the header: PhuzzBox, the pedal (its menu), then the stream, the CPU and the volume
  const header = h('header', { class: 'top' },
    h('div', { class: 'brand' }, h('span', { class: 'home' }, 'PhuzzBox'), h('h1', { class: 'pedal-head' }, pedalSel)),
    h('div', { class: 'audio' }, streamPill, cpu,
      h('label', { class: 'volume', title: 'The level after the pedal, as a volume pedal sets it (a MIDI expression pedal moves it)' }, 'Volume', volInput, volOut), status));
  inSel.value = audio.input || info.inputs[0]?.name || '';
  outSel.value = audio.output || info.outputs[0]?.name || '';
  frameSel.value = audio.frames;
  ifaceSel.value = audio.interface;
  gainInput.value = audio.gain;
  fsInput.value = audio.fullScale;
  volInput.addEventListener('input', () => setVolume(+volInput.value));
  let volTimer = null;
  function setVolume(g) {
    audio.volume = Math.min(1, Math.max(0, g));
    volInput.value = audio.volume;
    volOut.textContent = `${Math.round(100 * audio.volume)} %`;
    call('volume', audio.volume);
    clearTimeout(volTimer);
    volTimer = setTimeout(() => call('store', 'audio', audio), 300);
  }

  function fillChannels() {
    const n = info.inputs.find((d) => d.name === inSel.value)?.channels ?? 2;
    chanSel.replaceChildren(...Array.from({ length: Math.min(n, 8) }, (_, k) => h('option', { value: k }, `In ${k + 1}`)));
    chanSel.value = Math.min(audio.channel, Math.max(0, n - 1));
  }
  fillChannels();
  async function reopen() {
    Object.assign(audio, { input: inSel.value, output: outSel.value, frames: +frameSel.value });
    status.textContent = 'opening the audio…';
    stream = await call('audio', audio);
    showStream();
  }
  function showStream() {
    status.textContent = stream.error || '';
    if (!stream.open) { streamPill.textContent = 'no audio'; return; }
    streamPill.textContent = `${(stream.rate / 1000).toFixed(stream.rate % 1000 ? 1 : 0)} kHz · ${stream.frames} · ≈ ${stream.latencyMs.toFixed(1)} ms`;
    streamPill.title = `${stream.api}: ${stream.frames} samples a buffer at ${stream.rate} Hz; the buffers alone make a round trip of ${stream.latencyMs.toFixed(1)} ms, and the converters add a little`;
    frameSel.value = stream.frames;
  }
  inSel.addEventListener('change', () => { fillChannels(); reopen(); });
  outSel.addEventListener('change', reopen);
  frameSel.addEventListener('change', reopen);
  chanSel.addEventListener('change', () => { audio.channel = +chanSel.value; call('channel', audio.channel); call('store', 'audio', audio); });
  function setFullScale() {
    const iface = byInterface(ifaceSel.value);
    audio.interface = ifaceSel.value;
    gainLabel.hidden = !iface;
    fsInput.disabled = !!iface;
    if (iface) {
      gainInput.max = iface.gainRange;
      audio.gain = Math.min(iface.gainRange, Math.max(0, +gainInput.value || 0));
      gainInput.value = audio.gain;
      gainLabel.title = `${iface.note} At 0 dB a sine of +${iface.maxDbu} dBu just reaches full scale.`;
      audio.fullScale = +fullScaleVolts(iface, audio.gain).toPrecision(3);
      fsInput.value = audio.fullScale;
      const z = all.find((p) => p.role === 'interface-input');
      if (z && P[z.id] !== iface.inputZ) set(z.id, iface.inputZ);
    } else audio.fullScale = Math.max(0.05, +fsInput.value || 1);
    call('fullScale', audio.fullScale);
    call('store', 'audio', audio);
  }
  ifaceSel.addEventListener('change', setFullScale);
  gainInput.addEventListener('change', setFullScale);
  fsInput.addEventListener('change', setFullScale);
  function measure() {
    measureBtn.disabled = true;
    status.textContent = 'Measuring: a click goes out and back…';
    call('measure');
  }

  // ---- the pedal's face
  const led = h('span', { class: 'led', 'aria-hidden': 'true' });
  const foot = h('button', { class: 'footswitch', type: 'button', onclick: () => setBypass(!audio.bypass) }, h('span', { class: 'sr' }, 'Engage'));
  const muteBtn = h('button', { type: 'button', class: 'ghost mute', 'aria-pressed': 'false', title: 'Silence the output while you tune, as a tuner pedal does; the tuner still hears the input', onclick: () => setMute(!muted) }, 'Mute');
  const knobs = h('div', { class: 'knobs' });
  const meterIn = meter('In'), meterOut = meter('Out');
  const face = h('section', { class: 'pedal', 'aria-label': `${PEDAL.name} pedal` },
    h('div', { class: 'jacks' }, meterIn.el, meterOut.el), knobs,
    h('div', { class: 'name' }, h('span', {}, PEDAL.name), h('small', {}, PEDAL.description ?? '')),
    h('div', { class: 'switchrow' }, led, foot));

  // ---- the tuner (as the page's: shared/tuner.js smooths the program's readings)
  const tuning = new Tuner({ a4: ui.a4 });
  const tNote = h('span', {}, '–'), tOct = h('sub', {}, ''), tNeedle = h('span', { class: 't-needle' });
  const tCents = h('span', { class: 't-cents' }, ''), tHz = h('span', {}, 'Play a note'), tString = h('span', {}, '');
  const a4Input = h('input', { type: 'number', min: 415, max: 466, step: 0.5, value: tuning.a4, 'aria-label': 'Reference pitch, A4 in hertz' });
  a4Input.addEventListener('change', () => { tuning.a4 = Math.min(466, Math.max(415, +a4Input.value || 440)); a4Input.value = tuning.a4; ui.a4 = tuning.a4; call('store', 'ui', ui); });
  const scale = h('div', { class: 't-scale', 'aria-hidden': 'true' }, h('span', { class: 't-zone' }),
    ...[-50, -25, 0, 25, 50].map((c) => { const t = h('span', { class: 't-tick' }, h('i', {}, c > 0 ? `+${c}` : c < 0 ? `−${-c}` : '0')); t.style.left = `${50 + c}%`; return t; }), tNeedle);
  const tunerCard = h('figure', { class: 'card tunercard idle', 'aria-label': 'Tuner', 'data-view': 'Tuner', 'data-keep-text': '' },
    h('figcaption', {}, h('b', {}, 'Tuner'), h('span', { class: 'a4' }, 'A4 =', a4Input, 'Hz'), muteBtn),
    h('div', { class: 't-body' }, h('div', { class: 't-name', role: 'status' }, tNote, tOct), scale, h('div', { class: 't-read' }, tCents, tHz, tString)));

  // ---- Controls
  const presetSel = h('select', { class: 'presets', 'aria-label': 'Presets', onchange: () => { if (presetSel.value) applyPreset(presetSel.value); presetSel.value = ''; } },
    h('option', { value: '' }, 'Presets…'), ...Object.keys(PEDAL.presets ?? {}).map((n) => h('option', { value: n }, n)), h('option', { value: '__defaults' }, 'Default settings'));
  const rows = [];
  const groupList = [];
  for (const g of PEDAL.groups) {
    const box = h('fieldset', { class: 'group' }, h('legend', {}, g.name));
    for (const p of g.params) {
      const val = h('output', {});
      let input;
      if (p.type === 'checkbox') { input = h('input', { type: 'checkbox', class: 'switch', id: `p-${p.id}` }); input.addEventListener('change', () => set(p.id, input.checked)); }
      else if (p.type === 'select') { input = h('select', { id: `p-${p.id}` }, ...p.options.map(([v, l]) => h('option', { value: v }, l))); input.addEventListener('change', () => set(p.id, input.value)); }
      else { input = h('input', { type: 'range', class: 'fader', min: 0, max: 1000, step: 1, id: `p-${p.id}` }); input.addEventListener('input', () => set(p.id, fromUnit(p, input.value / 1000))); }
      const row = h('div', { class: 'row', 'data-param': p.id });
      const infoBtn = p.hint ? h('button', { type: 'button', class: 'info', 'aria-label': `About ${p.label}`, 'aria-expanded': 'false', onclick: () => infoBtn.setAttribute('aria-expanded', String(row.classList.toggle('hint-open'))) }, 'i') : null;
      row.append(h('label', { for: `p-${p.id}` }, p.label), infoBtn, input, val, p.hint ? h('p', { class: 'hint' }, p.hint) : null);
      rows.push({ p, row, input, val });
      box.append(row);
    }
    groupList.push({ key: g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: g.name, el: box });
  }

  // MIDI foot controllers: the site's card, its mappings kept in the settings file for each pedal
  const midiSaved = { ...(S.midi ?? {}) };
  const midiStore = {
    get: (k, d) => (k in midiSaved ? midiSaved[k] : d),
    set: (k, v) => { midiSaved[k] = v; call('store', 'midi', midiSaved); },
  };
  const midi = midiPanel({ PEDAL, h, store: midiStore, key: `phuzzbox.${PEDAL.id}`, ui: {
    setVolume, bypassed: () => !!audio.bypass, setBypass, muted: () => muted, setMute,
    value: (id) => P[id], set, presets: Object.keys(PEDAL.presets ?? {}), applyPreset,
  } });
  window.phuzzMidi = (status, d1, d2) => midi.feed([status, d1, d2]); // the card's status names the inputs instead
  const midiStatus = midi.el.querySelector('.midi-status'), midiHelp = midi.el.querySelector('.midi-help');
  for (const b of midi.el.querySelectorAll('.midi-bar button')) b.hidden = true; // Web MIDI's Connect: the program connects
  midiHelp.textContent = 'A MIDI foot controller moves the controls below: plug it in (an FC-300 through a USB MIDI interface such as a UM-ONE, its switch on TAB) and set it to Control Change mode. The app listens to every MIDI input. Learn, then move a pedal, teaches a row that pedal.';

  midi.el.classList.add('group');
  // on one screen, as the site's pages and Forte's: the pedal at the left, the tuner, the
  // Controls panel (the audio, the rig, the pedal's groups, the MIDI pedals) sharing the height
  // under their bars; what is shown is kept in the settings file
  const layoutSaved = { ...(S.layout ?? {}) };
  const layoutStore = {
    get: (k, d) => (k in layoutSaved ? layoutSaved[k] : d),
    set: (k, v) => { layoutSaved[k] = v; call('store', 'layout', layoutSaved); },
  };
  createLayout({ id: PEDAL.id, h, store: layoutStore, app, header, share: 0.36,
    rack: h('aside', { class: 'rack', 'data-view': 'Pedal' }, face),
    views: [{ key: 'tuner', name: 'Tuner', card: tunerCard, on: true }],
    groups: [{ key: 'audio', name: 'Audio', el: audioGroup }, { key: 'rig', name: 'Rig', el: rigGroup }, ...groupList, { key: 'midi', name: 'MIDI pedals', el: midi.el }],
    presets: presetSel,
    dock: h('footer', { class: 'dock app-foot' }, `${PEDAL.name} ${info.version} · PhuzzBox · physics, not samples · Space is the footswitch`) });
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
    for (const k of knobs.children) k.refresh?.();
  }
  function send(p) { call('set', p.id, nativeValue(p, P[p.id])); }
  let saveTimer = null;
  const saveParams = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => call('store', 'params', P), 300); };
  function set(id, v) {
    P[id] = v;
    send(all.find((p) => p.id === id));
    saveParams();
    refresh();
  }
  function applyPreset(name) {
    const keep = Object.fromEntries((PEDAL.keep ?? []).map((id) => [id, P[id]]));
    if (name === '__defaults') Object.assign(P, defaults(PEDAL.groups), keep);
    else Object.assign(P, PEDAL.presets[name]);
    for (const p of all) send(p);
    saveParams();
    refresh();
  }
  function setBypass(on) {
    audio.bypass = on ? 1 : 0;
    call('bypass', audio.bypass);
    call('store', 'audio', audio);
    led.classList.toggle('on', !on);
    foot.setAttribute('aria-pressed', String(!on));
  }
  let muted = false;
  function setMute(on) {
    muted = on;
    call('mute', on);
    muteBtn.setAttribute('aria-pressed', String(on));
    muteBtn.textContent = on ? 'Muted: unmute' : 'Mute';
  }
  function knob(p) {
    const dial = h('div', { class: 'dial', role: 'slider', tabindex: 0, 'aria-label': p.label, title: p.hint ?? '' }, h('span', { class: 'mark' }));
    const val = h('div', { class: 'kval' });
    const el = h('div', { class: 'knob' }, dial, h('div', { class: 'klabel' }, p.label.replace(/\s*\(.*\)$/, '')), val);
    el.refresh = () => {
      const u = toUnit(p, P[p.id]);
      dial.style.setProperty('--turn', `${-135 + 270 * u}deg`);
      dial.setAttribute('aria-valuetext', fmt(p, P[p.id]));
      val.textContent = fmt(p, P[p.id]);
    };
    let start = null;
    dial.addEventListener('pointerdown', (e) => { dial.setPointerCapture(e.pointerId); start = { x: e.clientX, y: e.clientY, u: toUnit(p, P[p.id]) }; });
    dial.addEventListener('pointermove', (e) => { if (start) set(p.id, fromUnit(p, start.u + ((e.clientX - start.x) - (e.clientY - start.y)) / (e.shiftKey ? 800 : 200))); });
    dial.addEventListener('pointerup', () => { start = null; });
    dial.addEventListener('dblclick', () => set(p.id, p.def));
    dial.addEventListener('keydown', (e) => {
      const step = { ArrowUp: 0.02, ArrowRight: 0.02, ArrowDown: -0.02, ArrowLeft: -0.02 }[e.key];
      if (step) { e.preventDefault(); set(p.id, fromUnit(p, toUnit(p, P[p.id]) + step * (e.shiftKey ? 0.25 : 1))); }
    });
    return el;
  }
  function meter(label) {
    const bar = h('span', { class: 'bar' }), txt = h('span', { class: 'mtxt' }, '–');
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
  onSpace = () => setBypass(!audio.bypass);

  // ---- the levels, the tuner and the measurement, ten times a second
  let t = 0, wasMeasuring = false, midiPorts = null;
  async function tick() {
    if (me !== drawn) return; // a newer window has its own
    const r = await call('poll');
    if (me !== drawn) return;
    t += 0.1;
    meterIn.set(r.in, r.in / audio.fullScale > 0.98);
    meterOut.set(r.out, r.out / audio.fullScale > 0.98);
    cpu.textContent = `CPU ${(100 * r.cpu).toFixed(1)}%`;
    const ports = (r.midi ?? []).join(', ');
    if (ports !== midiPorts) { midiPorts = ports; midiStatus.textContent = ports ? `listening to ${ports}` : 'no MIDI input: plug in the interface'; }
    if (r.measured === -1) wasMeasuring = true;
    else if (wasMeasuring) {
      wasMeasuring = false;
      measureBtn.disabled = false;
      if (r.measured === -2) status.textContent = 'Nothing came back: is a cable connected from the output to this input?';
      else { status.textContent = ''; measured.hidden = false; measured.textContent = `round trip ${r.measured.toFixed(1)} ms (measured)`; }
    }
    const n = tuning.push(r.f, t);
    tunerCard.classList.toggle('idle', !n);
    tunerCard.classList.toggle('stale', !!n && !n.live);
    tunerCard.classList.toggle('intune', !!n && Math.abs(n.cents) < 3);
    if (!n) { tNote.textContent = '–'; tOct.textContent = ''; tCents.textContent = ''; tHz.textContent = 'Play a note'; tString.textContent = ''; }
    else {
      tNote.textContent = n.letter; tOct.textContent = n.octave;
      tCents.textContent = `${n.cents >= 0.05 ? '+' : n.cents <= -0.05 ? '−' : '±'}${Math.abs(n.cents).toFixed(1)}¢`;
      tHz.textContent = `${n.f.toFixed(2)} Hz, in tune at ${n.target.toFixed(2)}`;
      tString.textContent = OPEN_STRINGS.includes(n.key) ? `open ${n.letter} string` : '';
      tNeedle.style.left = `${50 + Math.max(-50, Math.min(50, n.cents))}%`;
    }
    setTimeout(tick, 100);
  }

  // the program already holds the saved parameters; send them all once so both agree
  for (const p of all) send(p);
  if (Object.keys(carry).length) saveParams();
  setBypass(!!audio.bypass);
  setFullScale();
  setVolume(audio.volume);
  refresh();
  showStream();
  tick();
}

let onSpace = () => {};
addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat || e.target.closest?.('input, select, textarea, button, [role=slider]')) return;
  e.preventDefault();
  onSpace();
});

call('describe').then(main).catch((err) => { document.getElementById('app').textContent = `The window failed to start: ${err.message}`; });
