// shell.js — everything a pedal page shares: the audio graph (the interface's input or the test
// bass → the pedal's AudioWorklet → volume → a safety limiter → the speakers), the pedal's face
// (knobs for its `perform` controls, the footswitch and its LED), meters, a tuner, the latency,
// the Controls panel with every parameter and the presets, the test bass's fretboard, and How it
// works (the pedal's README). The page brings its descriptor, its worklet module and its views.
//
//   createPedal({ PEDAL, worklet: new URL('./x-worklet.js', import.meta.url), views: [view, …] })
//   view = { title, caption, perform?: true, mount(canvasHolder, api) }  where api = { P, ctx,
//            analyser (the output), on(event, fn) } and events are 'params' and 'audio'

import { params, defaults, fmt, toUnit, fromUnit } from './params.js';
import { fetchBytes } from './wasm.js';
import { TESTBASS_URL } from './testbass.js';
import { detectPitch, noteOf } from './tuner.js';
import { renderMarkdown } from './markdown.js';
import { byId } from './registry.js';

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
// An original two-bar line to hear a pedal with when nothing is plugged in: [key, beats], 0 a rest.
const RIFF = [[28, 0.5], [28, 0.5], [40, 0.5], [28, 0.5], [31, 0.5], [33, 0.5], [0, 0.5], [35, 0.5],
  [28, 0.5], [28, 0.5], [38, 0.5], [40, 0.25], [38, 0.25], [35, 0.5], [33, 0.5], [31, 1]];

export function createPedal({ PEDAL, worklet, views = [] }) {
  const reg = byId(PEDAL.id) ?? {};
  const all = params(PEDAL.groups);
  const key = `phuzzbox.${PEDAL.id}`;
  const P = { ...defaults(PEDAL.groups), ...store.get(`${key}.params`, {}) };
  for (const p of all) if (!(p.id in P)) P[p.id] = p.def;
  const state = { bypass: store.get(`${key}.bypass`, false), source: 'bass', fullScale: store.get('phuzzbox.fullScale', 1), volume: store.get('phuzzbox.volume', 0.8), channel: 0 };
  const listeners = { params: [], audio: [] };
  const api = { P, PEDAL, ctx: null, analyser: null, on: (ev, fn) => listeners[ev].push(fn) };
  let ctx = null, node = null, volume = null, micSource = null, micStream = null, inAnalyser = null, splitter = null;
  const send = (m) => node?.port.postMessage(m);
  const emit = (ev) => listeners[ev].forEach((fn) => fn(api));

  // ---- the page
  document.title = `${PEDAL.name} · Phuzzbox`;
  const app = document.getElementById('app');
  const status = h('span', { class: 'status' });
  const startBtn = h('button', { class: 'primary', type: 'button', onclick: () => start() }, 'Start audio');
  const sourceSel = h('select', { 'aria-label': 'Source', onchange: () => setSource(sourceSel.value) },
    h('option', { value: 'bass' }, 'Test bass (keys)'));
  const chanSel = h('select', { 'aria-label': 'Input channel', class: 'chan', onchange: () => { state.channel = +chanSel.value; connectMic(); } },
    h('option', { value: 0 }, 'In 1'), h('option', { value: 1 }, 'In 2'));
  const latency = h('span', { class: 'pill', title: 'The browser\'s estimate of the delay from input to output' }, 'latency –');
  const sinkSel = h('select', { 'aria-label': 'Output', class: 'sink', hidden: true, onchange: () => setSink(sinkSel.value) });
  const measureBtn = h('button', { type: 'button', class: 'ghost', hidden: true, title: 'Measure the real round trip: connect a cable from your interface\'s output to the input you chose, and turn its direct monitoring off', onclick: () => measure() }, 'Measure latency');
  const cpu = h('span', { class: 'pill', title: 'The share of the audio thread\'s time the pedal takes' }, 'CPU –');
  const notesBtn = h('button', { type: 'button', class: 'ghost', onclick: () => showNotes() }, 'How it works');
  app.append(h('header', { class: 'top' },
    h('a', { class: 'home', href: '../' }, 'Phuzzbox'),
    h('h1', {}, PEDAL.name),
    notesBtn,
    h('span', { class: 'spacer' }),
    startBtn, sourceSel, chanSel, sinkSel, latency, measureBtn, cpu, status));

  // the pedal's face
  const led = h('span', { class: 'led', 'aria-hidden': 'true' });
  const foot = h('button', { class: 'footswitch', type: 'button', 'aria-pressed': String(!state.bypass), onclick: () => setBypass(!state.bypass) }, h('span', { class: 'sr' }, 'Engage'));
  const knobs = h('div', { class: 'knobs' });
  const meterIn = meter('In'), meterOut = meter('Out');
  const tuner = h('div', { class: 'tuner', title: 'The input\'s pitch' }, h('span', { class: 'note' }, '–'), h('span', { class: 'cents' }, ''));
  const face = h('section', { class: 'pedal', 'aria-label': `${PEDAL.name} pedal` },
    h('div', { class: 'jacks' }, meterIn.el, meterOut.el),
    knobs,
    h('div', { class: 'name' }, h('span', {}, PEDAL.name), h('small', {}, reg.after ?? '')),
    h('div', { class: 'switchrow' }, led, foot),
    tuner);

  // views
  const viewWrap = h('section', { class: 'views' });
  for (const v of views) {
    const holder = h('div', { class: 'canvas' });
    const card = h('figure', { class: 'card' }, h('figcaption', {}, h('b', {}, v.title), ' ', h('span', {}, v.caption ?? '')), holder);
    viewWrap.append(card);
    v.mount(holder, api);
  }

  // the fretboard (test bass)
  const fret = h('section', { class: 'fretboard', 'aria-label': 'Test bass' });
  const riffBtn = h('button', { type: 'button', class: 'ghost', onclick: () => toggleRiff() }, 'Play a riff');
  const fretGrid = h('div', { class: 'frets' });
  for (let s = 3; s >= 0; s--) {
    const row = h('div', { class: 'string' }, h('span', { class: 'sname' }, STRING_NAMES[s]));
    for (let f = 0; f < 10; f++) {
      const k = OPEN[s] + f;
      const b = h('button', { type: 'button', class: f === 0 ? 'open' : '', 'aria-label': `${STRING_NAMES[s]} string, fret ${f}`, title: ROWS[s][f].replace(/^Key|^Digit/, '') });
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); play(k, 0.75); });
      b.addEventListener('pointerup', () => stop(k));
      b.addEventListener('pointercancel', () => stop(k));
      row.append(b);
    }
    fretGrid.append(row);
  }
  fret.append(h('div', { class: 'fret-head' }, h('b', {}, 'Test bass'), h('span', {}, ' a bass made of physics, for when nothing is plugged in: the rows of letter keys are its strings (Z row the low E, then A, Q and the numbers), open to the ninth fret.'), riffBtn), fretGrid);

  // the Controls panel
  const controls = h('section', { class: 'controls' });
  const presetSel = h('select', { 'aria-label': 'Presets', onchange: () => { if (presetSel.value) applyPreset(presetSel.value); presetSel.value = ''; } },
    h('option', { value: '' }, 'Presets…'), ...Object.keys(PEDAL.presets ?? {}).map((n) => h('option', { value: n }, n)),
    h('option', { value: '__defaults' }, 'Default settings'));
  const fsInput = h('input', { type: 'number', min: 0.05, max: 20, step: 0.05, value: state.fullScale, 'aria-label': 'Volts at full scale' });
  fsInput.addEventListener('change', () => { state.fullScale = Math.max(0.05, +fsInput.value || 1); store.set('phuzzbox.fullScale', state.fullScale); send({ type: 'fullScale', volts: state.fullScale }); });
  const volInput = h('input', { type: 'range', min: 0, max: 1.5, step: 0.01, value: state.volume, 'aria-label': 'Volume' });
  volInput.addEventListener('input', () => { state.volume = +volInput.value; store.set('phuzzbox.volume', state.volume); if (volume) volume.gain.value = state.volume; });
  controls.append(h('div', { class: 'controls-bar' }, h('b', {}, 'Controls'), presetSel,
    h('label', { class: 'inline', title: 'How many volts at the input jack make a full-scale signal in the browser. Set it so the test bass and your bass read alike on the In meter; it matters for the pedals that distort.' }, 'Full scale ', fsInput, ' V'),
    h('label', { class: 'inline' }, 'Volume ', volInput)));
  const rows = [];
  const groupsEl = h('div', { class: 'groups' });
  for (const g of PEDAL.groups) {
    const box = h('fieldset', { class: 'group' }, h('legend', {}, g.name));
    for (const p of g.params) {
      const val = h('output', {});
      let input;
      if (p.type === 'checkbox') {
        input = h('input', { type: 'checkbox', id: `p-${p.id}` });
        input.addEventListener('change', () => set(p.id, input.checked));
      } else if (p.type === 'select') {
        input = h('select', { id: `p-${p.id}` }, ...p.options.map(([v, l]) => h('option', { value: v }, l)));
        input.addEventListener('change', () => set(p.id, input.value));
      } else {
        input = h('input', { type: 'range', min: 0, max: 1000, step: 1, id: `p-${p.id}` });
        input.addEventListener('input', () => set(p.id, fromUnit(p, input.value / 1000)));
      }
      const info = p.hint ? h('button', { type: 'button', class: 'info', 'aria-label': `About ${p.label}`, onclick: () => hint.toggleAttribute('hidden') }, 'ⓘ') : null;
      const hint = h('p', { class: 'hint', hidden: true }, p.hint ?? '');
      const row = h('div', { class: 'row' }, h('label', { for: `p-${p.id}` }, p.label), info, input, val, hint);
      rows.push({ p, row, input, val });
      box.append(row);
    }
    groupsEl.append(box);
  }
  controls.append(groupsEl);

  app.append(h('div', { class: 'stage' }, face, viewWrap), fret, controls,
    h('footer', {}, `${PEDAL.name} ${reg.version ?? ''} · Phuzzbox · physics, not samples · `,
      h('a', { href: '../' }, 'all pedals')));

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
  function setBypass(on) {
    state.bypass = on;
    store.set(`${key}.bypass`, on);
    foot.setAttribute('aria-pressed', String(!on));
    led.classList.toggle('on', !on);
    send({ type: 'bypass', on });
  }

  // a knob: drag up or right to turn it, Shift for fine, a double tap for its default, arrows too
  function knob(p) {
    const dial = h('div', { class: 'dial', role: 'slider', tabindex: 0, 'aria-label': p.label, title: p.hint ?? '' }, h('span', { class: 'mark' }));
    const val = h('div', { class: 'kval' });
    const el = h('div', { class: 'knob' }, dial, h('div', { class: 'klabel' }, p.label.replace(/\s*\(.*\)$/, '')), val);
    el.refresh = () => {
      const u = toUnit(p, P[p.id]);
      dial.style.setProperty('--turn', `${-135 + 270 * u}deg`);
      dial.setAttribute('aria-valuetext', fmt(p, P[p.id]));
      dial.setAttribute('aria-valuenow', String(Math.round(u * 100)));
      val.textContent = fmt(p, P[p.id]);
    };
    let start = null;
    dial.addEventListener('pointerdown', (e) => { dial.setPointerCapture(e.pointerId); start = { x: e.clientX, y: e.clientY, u: toUnit(p, P[p.id]) }; });
    dial.addEventListener('pointermove', (e) => {
      if (!start) return;
      const d = ((e.clientX - start.x) - (e.clientY - start.y)) / (e.shiftKey ? 800 : 200);
      set(p.id, fromUnit(p, start.u + d));
    });
    dial.addEventListener('pointerup', () => { start = null; });
    dial.addEventListener('dblclick', () => set(p.id, p.def));
    dial.addEventListener('keydown', (e) => {
      const step = { ArrowUp: 0.02, ArrowRight: 0.02, ArrowDown: -0.02, ArrowLeft: -0.02 }[e.key];
      if (step) { e.preventDefault(); e.stopPropagation(); set(p.id, fromUnit(p, toUnit(p, P[p.id]) + step * (e.shiftKey ? 0.25 : 1))); }
    });
    return el;
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
      const [pedal, bass] = await Promise.all([fetchBytes(PEDAL.wasm.binary()), fetchBytes(TESTBASS_URL())]);
      await ctx.audioWorklet.addModule(worklet);
      node = new AudioWorkletNode(ctx, 'phuzzbox', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { pedal, bass } });
      node.port.onmessage = (e) => onMessage(e.data);
      volume = new GainNode(ctx, { gain: state.volume });
      // a safety limiter before the speakers: a distortion pedal at full tilt shouldn't hurt anyone
      const limiter = new DynamicsCompressorNode(ctx, { threshold: -3, knee: 3, ratio: 12, attack: 0.002, release: 0.15 });
      const analyser = new AnalyserNode(ctx, { fftSize: 8192, smoothingTimeConstant: 0.6 });
      node.connect(volume).connect(limiter).connect(ctx.destination);
      node.connect(analyser);
      api.ctx = ctx; api.analyser = analyser;
      send({ type: 'params', P: { ...P } });
      send({ type: 'bypass', on: state.bypass });
      send({ type: 'fullScale', volts: state.fullScale });
      send({ type: 'source', which: state.source });
      startBtn.textContent = 'Audio on';
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
    sinkSel.replaceChildren(h('option', { value: '' }, 'System output'), ...outs.filter((d) => d.deviceId !== 'default').map((d) => h('option', { value: d.deviceId }, `→ ${d.label}`)));
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
    if (v === 'bass') { state.source = 'bass'; send({ type: 'source', which: 'bass' }); chanSel.hidden = true; tuner.hidden = true; measureBtn.hidden = true; return; }
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
      chanSel.hidden = false; tuner.hidden = false; measureBtn.hidden = false;
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
    inAnalyser = new AnalyserNode(ctx, { fftSize: 8192 });
    mono.connect(inAnalyser);
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
    const ms = 1000 * ((ctx.baseLatency || 0) + (ctx.outputLatency || 0) + (state.source === 'input' ? track?.latency || 0 : 0));
    latency.textContent = ms ? `latency ≈ ${ms.toFixed(0)} ms` : 'latency –';
    latency.classList.toggle('warn', ms > 40);
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
    } else if (m.type === 'error') status.textContent = m.message;
  }
  // the tuner, ten times a second while the input plays
  const buf = new Float32Array(8192);
  setInterval(() => {
    if (!inAnalyser || state.source !== 'input') return;
    inAnalyser.getFloatTimeDomainData(buf);
    const f = detectPitch(buf, ctx.sampleRate);
    const [note, cents] = tuner.children;
    if (!f) { note.textContent = '–'; cents.textContent = ''; tuner.style.setProperty('--off', '0'); return; }
    const n = noteOf(f);
    note.textContent = n.name;
    cents.textContent = `${n.cents >= 0 ? '+' : '−'}${Math.abs(n.cents).toFixed(0)}¢`;
    tuner.classList.toggle('intune', Math.abs(n.cents) < 3);
  }, 100);

  // ---- the test bass
  const held = new Set();
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
    const beat = 60 / 96;
    const next = () => {
      const [k, b] = RIFF[i % RIFF.length];
      if (k) { play(k, 0.6 + 0.2 * ((i % 4) === 0)); setTimeout(() => stop(k), 1000 * b * beat * 0.85); }
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
    if (k !== undefined) { e.preventDefault(); held.add(e.code); play(k, 0.75); }
    else if (e.code === 'Space') { e.preventDefault(); setBypass(!state.bypass); }
  });
  addEventListener('keyup', (e) => { const k = codeKey.get(e.code); if (k !== undefined && held.delete(e.code)) stop(k); });

  // ---- How it works: the README
  let dialog = null;
  async function showNotes() {
    if (!dialog) {
      const body = h('div', { class: 'notes-body' }, 'Loading…');
      dialog = h('dialog', { class: 'notes' }, h('div', { class: 'notes-bar' }, h('b', {}, `${PEDAL.name}: how it works`), h('button', { type: 'button', onclick: () => dialog.close() }, 'Close ✕')), body);
      document.body.append(dialog);
      try {
        const text = await (await fetch('README.md')).text();
        body.innerHTML = renderMarkdown(text, { skip: ['Files'] }).html;
      } catch { body.textContent = 'The notes did not load.'; }
    }
    dialog.showModal();
  }
  if (location.hash === '#about') showNotes();

  setBypass(state.bypass);
  chanSel.hidden = true; tuner.hidden = true;
  refresh();
  return api;
}
