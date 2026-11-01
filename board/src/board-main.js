// board-main.js — the Pedalboard's page: the shared page (shared/shell.js) with the board's own
// controls (the bass, the cables), the chain of pedals below its face, and a view of the chain's
// jacks: what drives each one, what it drives, and the voltage there.

import { createPedal, knobFor, toggleFor } from '../../shared/shell.js';
import { params, defaults, fmt } from '../../shared/params.js';
import { fetchBytes } from '../../shared/wasm.js';
import { spectrumView, scopeView } from '../../shared/views.js';
import { PEDAL } from './board-pedal.js';
import { BOARDS } from './board-params.js';
import { BOARD_PEDALS, ENCLOSURES } from './board-pedals.js';
import { wire, jacks, BASS, SOURCE, LOAD, inputImpedance } from './board-jacks.js';
import { MAX_SLOTS, PEAKS } from './board-chain.js';

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
};
const KEY = 'phuzzbox.board.chain';
let uids = 0;
const uid = () => `${Date.now().toString(36)}-${(uids++).toString(36)}`;
// a pedal comes onto the board as you left it on its own page
const ownSettings = (id) => ({ ...defaults(BOARD_PEDALS[id].groups), ...store.get(`phuzzbox.${id}.params`, {}) });
const slotOf = (id, preset) => ({ uid: uid(), id, P: { ...ownSettings(id), ...(preset ? BOARD_PEDALS[id].presets[preset] : {}) }, bypass: false });
const boardOf = (name) => BOARDS[name].map(([id, preset]) => slotOf(id, preset));
// what the board sets on a pedal, so its card leaves it out
const owned = (D) => {
  const ids = new Set(params(D.groups).map((p) => p.id));
  return new Set([...BASS, ...SOURCE.filter(() => ids.has('active')), ...(ids.has('outCable') ? LOAD : [])].filter((x) => ids.has(x)));
};

let chain = (store.get(KEY, null) ?? boardOf('Fuzz first')).filter((s) => BOARD_PEDALS[s.id]);
for (const s of chain) { s.uid ??= uid(); s.P = { ...defaults(BOARD_PEDALS[s.id].groups), ...s.P }; }

let api = null;
const save = () => store.set(KEY, chain);
const sendChain = () => { save(); api?.send({ type: 'chain', slots: chain.map(({ uid: u, id, P, bypass }) => ({ uid: u, id, P, bypass })) }); emitChain(); };
const chainListeners = [];
const emitChain = () => chainListeners.forEach((fn) => fn());

function rack(a) {
  api = a;
  const list = h('ol', { class: 'slots', 'aria-label': 'The pedals, from the bass to the amp' });
  const boardSel = h('select', { 'aria-label': 'Boards', onchange: () => { if (boardSel.value) { chain = boardOf(boardSel.value); draw(); sendChain(); } boardSel.value = ''; } },
    h('option', { value: '' }, 'Boards…'), ...Object.keys(BOARDS).map((n) => h('option', { value: n }, n)));
  const addSel = h('select', { 'aria-label': 'Add a pedal', onchange: () => { if (addSel.value && chain.length < MAX_SLOTS) { chain.push(slotOf(addSel.value)); draw(); sendChain(); } addSel.value = ''; } },
    h('option', { value: '' }, 'Add a pedal…'), ...Object.values(BOARD_PEDALS).map((d) => h('option', { value: d.id }, d.name)));
  const el = h('section', { class: 'board' },
    h('div', { class: 'board-tools' }, boardSel, addSel),
    h('div', { class: 'board-end' }, 'your bass'), list, h('div', { class: 'board-end' }, 'the amp'));

  function card(s, i) {
    const D = BOARD_PEDALS[s.id], [enc, ink] = ENCLOSURES[s.id] ?? ['#333', '#eee'], mine = owned(D);
    const knobs = h('div', { class: 'knobs' });
    const put = (id, v) => { s.P[id] = v; save(); api.send({ type: 'slot', uid: s.uid, P: { [id]: v } }); emitChain(); };
    for (const p of params(D.groups).filter((q) => q.perform && q.type !== 'select' && !mine.has(q.id))) knobs.append((p.type === 'checkbox' ? toggleFor : knobFor)(p, () => s.P[p.id], (v) => { put(p.id, v); refreshKnobs(); }));
    const refreshKnobs = () => { for (const k of knobs.children) k.refresh?.(); };
    const presetSel = h('select', { class: 'presets', 'aria-label': `${D.name} presets`, onchange: () => {
      const name = presetSel.value; presetSel.value = '';
      if (!name) return;
      Object.assign(s.P, name === '__own' ? ownSettings(s.id) : D.presets[name]);
      save(); api.send({ type: 'slot', uid: s.uid, P: { ...s.P } }); refreshKnobs(); emitChain();
    } }, h('option', { value: '' }, 'Presets…'), ...Object.keys(D.presets ?? {}).map((n) => h('option', { value: n }, n)), h('option', { value: '__own' }, 'As on its own page'));
    const led = h('span', { class: `led${s.bypass ? '' : ' on'}`, 'aria-hidden': 'true' });
    const foot = h('button', { class: 'footswitch', type: 'button', 'aria-pressed': String(!s.bypass), title: `Engage or bypass the ${D.name} (true bypass: a wire between its jacks)`, onclick: () => {
      s.bypass = !s.bypass; foot.setAttribute('aria-pressed', String(!s.bypass)); led.classList.toggle('on', !s.bypass); sendChain();
    } }, h('span', { class: 'sr' }, `Engage the ${D.name}`));
    const move = (d, label, glyph) => h('button', { type: 'button', class: 'ghost', title: label, 'aria-label': `${label}: ${D.name}`, disabled: i + d < 0 || i + d >= chain.length, onclick: () => {
      [chain[i], chain[i + d]] = [chain[i + d], chain[i]]; draw(); sendChain();
    } }, glyph);
    const remove = h('button', { type: 'button', class: 'ghost', title: 'Take it off the board', 'aria-label': `Remove the ${D.name}`, onclick: () => { chain.splice(i, 1); draw(); sendChain(); } }, '✕');
    const c = h('li', { class: 'pedal mini', style: `--enclosure:${enc};--enclosure-ink:${ink}`, 'data-slot': s.id },
      h('div', { class: 'slot-head' }, h('a', { href: `../${s.id}/`, title: `The ${D.name}'s own page, with its views and How it works` }, D.name), h('span', { class: 'spacer' }),
        move(-1, 'Earlier in the chain', '↑'), move(1, 'Later in the chain', '↓'), remove),
      knobs.children.length ? knobs : null,
      h('div', { class: 'slot-foot' }, presetSel, led, foot));
    refreshKnobs();
    return c;
  }
  function draw() {
    list.replaceChildren(...chain.map(card));
    addSel.disabled = chain.length >= MAX_SLOTS;
    if (!chain.length) list.append(h('li', { class: 'board-empty' }, 'No pedals: the bass goes straight to the amp. Add one, or pick a board.'));
  }
  draw();
  api.on('audio', sendChain);
  return el;
}

// The chain: each jack, what drives it and what it drives, and the peak voltage there.
const jacksView = {
  title: 'The chain',
  caption: 'each jack on the board, from the bass to the amp: what drives it, through how much cable, and into what impedance, with the loudest voltage there in the last moment. A pedal whose circuit includes its input jack (the Buffer, the Phuzz, the Tube Preamp, and the Wah plugged in backwards) feels your pickup only when nothing engaged is before it; after a pedal it sees a buffered output. One whose circuit includes its output jack (the Phuzz, the Tube Preamp, the Wah backwards) drives the next input\'s impedance through the patch cable.',
  perform: true,
  mount(holder, a) {
    holder.classList.add('chain-view');
    let peaks = [];
    const ohms = (r) => (r >= 1e6 ? `${+(r / 1e6).toPrecision(3)} MΩ` : r >= 1e3 ? `${+(r / 1e3).toPrecision(3)} kΩ` : `${Math.round(r)} Ω`);
    const volts = (v) => (v == null ? '–' : v >= 1 ? `${v.toFixed(2)} V` : `${(1000 * v).toFixed(0)} mV`);
    const draw = () => {
      const w = wire(chain, a.P, BOARD_PEDALS);
      const rows = [h('li', {}, h('b', {}, 'Your bass'), h('span', {}, a.P.active ? 'active electronics' : 'a passive pickup'), h('output', {}, volts(peaks[0])))];
      chain.forEach((s, i) => {
        const D = BOARD_PEDALS[s.id], j = jacks(D, s.P);
        const from = w[i].from === 'bass' ? 'your pickup' : 'a buffered output';
        const into = w[i].to === 'amp' ? `the amp's ${ohms(a.P.ampLoad)}` : `the ${BOARD_PEDALS[chain[w[i].to].id].name}'s ${ohms(inputImpedance(chain[w[i].to].id, chain[w[i].to].P))}`;
        const bits = s.bypass ? ['bypassed: a wire'] : [
          j.input ? `feels ${from} through ${fmt({ decimals: 1, unit: 'm' }, w[i].cableIn)}` : 'takes the voltage at its input',
          j.output ? `drives ${into} through ${fmt({ decimals: 1, unit: 'm' }, w[i].cableOut)}` : 'a buffered output',
        ];
        rows.push(h('li', { class: s.bypass ? 'off' : '' }, h('b', {}, D.name), h('span', {}, bits.join('; ')), h('output', {}, s.bypass ? '' : volts(peaks[i + 1]))));
      });
      rows.push(h('li', {}, h('b', {}, 'The amp'), h('span', {}, `${ohms(a.P.ampLoad)} through ${fmt({ decimals: 1, unit: 'm' }, a.P.ampCable)}`), h('output', {}, volts(peaks[peaks.length - 1]))));
      list.replaceChildren(...rows);
    };
    const list = h('ol', { class: 'jacks-list' });
    holder.append(list);
    a.on('params', draw);
    chainListeners.push(draw);
    let shown = 0;
    a.on('pedal', (messages) => { for (const m of messages) if (m.type === PEAKS) { peaks = Array.from(m.values); if (++shown % 3 === 0) draw(); } });
    draw();
  },
};

const BOARD_SCOPE = 'the voltage at the bass (dashed) and at the amp (solid) as you play, each scaled to fit.';
const BOARD_SPECTRUM = 'what the bass sends (dashed) and what reaches the amp (solid), in dB of volts. The green line is the note you are playing, and the ticks its harmonics.';

createPedal({
  PEDAL, worklet: new URL('./board-worklet.js', import.meta.url), rack,
  views: [jacksView, spectrumView({ caption: BOARD_SPECTRUM }), scopeView({ caption: BOARD_SCOPE })],
  // every pedal's WebAssembly, so any can go on the board without a pause
  load: async () => ({ pedals: Object.fromEntries(await Promise.all(Object.values(BOARD_PEDALS).map(async (d) => [d.id, await fetchBytes(d.wasm.binary())]))) }),
});
