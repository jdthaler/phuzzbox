// metronome-card.js — the metronome's card, under the pedal beside the tuner (shared/layout.js puts
// both in the pedal's panel, each with its toggle there). Its physics is shared/metronome.js: each
// beat a struck maple block, the first of each bar a steel bar, played into the master volume
// (not through the pedal), and a pendulum whose sliding weight sits where the tempo puts it.
//
//   const m = metronomeCard({ h, store, about, audio: async () => ({ ctx, out }) })
//   m.card is the card; m.stop() stops it. audio() starts the page's sound if it isn't on and gives
//   its AudioContext and the node to play into.

import { strike, TICK, BELL, TEMPO, PENDULUM, weightAt, beatsBetween, tapTempo, swing } from './metronome.js';

const KEY = 'phuzzbox.metronome';
const LOOKAHEAD = 0.15; // s: how far ahead the beats are scheduled, a window every 25 ms
const BARS = [[0, 'No bell'], [2, '2 a bar'], [3, '3 a bar'], [4, '4 a bar'], [5, '5 a bar'], [6, '6 a bar'], [7, '7 a bar']];

export function metronomeCard({ h, store, about, audio }) {
  const saved = store.get(KEY, {}) ?? {};
  const clampBpm = (x) => Math.min(TEMPO.max, Math.max(TEMPO.min, Math.round(+x || TEMPO.def)));
  const S = { bpm: clampBpm(saved.bpm ?? TEMPO.def), perBar: BARS.some(([n]) => n === saved.perBar) ? saved.perBar : 4, level: Number.isFinite(saved.level) ? Math.min(1, Math.max(0, saved.level)) : 0.5 };
  const save = () => store.set(KEY, S);

  // ---- the controls
  const bpmInput = h('input', { type: 'number', min: TEMPO.min, max: TEMPO.max, step: 1, value: S.bpm, 'aria-label': 'Tempo, beats a minute' });
  const slower = h('button', { type: 'button', class: 'ghost step', 'aria-label': 'Slower', title: 'One beat a minute slower (Shift: five)' }, '−');
  const faster = h('button', { type: 'button', class: 'ghost step', 'aria-label': 'Faster', title: 'One beat a minute faster (Shift: five)' }, '+');
  const tapBtn = h('button', { type: 'button', class: 'ghost tap', title: 'Tap the beat, two or more times, to set the tempo' }, 'Tap');
  const barSel = h('select', { 'aria-label': 'Beats a bar', title: 'The bell rings on the first beat of each bar' }, ...BARS.map(([n, l]) => h('option', { value: n }, l)));
  barSel.value = S.perBar;
  const level = h('input', { type: 'range', class: 'fader', min: 0, max: 1, step: 0.01, value: S.level, 'aria-label': 'Metronome level', title: 'How loud the clicks are, before the master volume' });
  const playBtn = h('button', { type: 'button', class: 'ghost play', 'aria-pressed': 'false', title: 'Start or stop the metronome' }, 'Start');
  const dots = h('div', { class: 'm-dots', 'aria-hidden': 'true' });

  // the pendulum: the rod swings about its pivot, the bob below it, the weight on the rod above it
  // where the tempo puts it (shared/metronome.js weightAt), on a scale of tempos
  const NS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
  const MM = 0.9, PIVOT = 104; // px a millimetre; the pivot's height in the drawing
  const pic = svg('svg', { viewBox: '0 0 80 124', class: 'm-pendulum', 'aria-hidden': 'true' });
  const body = svg('path', { d: 'M22 120 L32 8 L48 8 L58 120 Z', class: 'm-case' });
  const scaleG = svg('g', { class: 'm-scale' });
  for (const t of [40, 60, 80, 100, 120, 160, 208]) {
    const y = PIVOT - 1000 * weightAt(t) * MM;
    scaleG.append(svg('line', { x1: 34, x2: 37, y1: y, y2: y }), Object.assign(svg('text', { x: 38.5, y: y + 2 }), { textContent: t }));
  }
  const rod = svg('g', { class: 'm-rod' });
  const weight = svg('rect', { x: 35, y: 0, width: 10, height: 7, rx: 1.5, class: 'm-weight' });
  rod.append(svg('line', { x1: 40, x2: 40, y1: PIVOT - 96, y2: PIVOT + 1000 * PENDULUM.rM * MM * 0.25, class: 'm-stick' }), weight);
  pic.append(body, scaleG, rod, svg('circle', { cx: 40, cy: PIVOT, r: 2.2, class: 'm-pivot' }));
  const placeWeight = () => weight.setAttribute('y', PIVOT - 1000 * weightAt(S.bpm) * MM - 3.5);
  const lean = (u) => rod.setAttribute('transform', `rotate(${(28 * u).toFixed(2)} 40 ${PIVOT})`);

  const card = h('figure', { class: 'card metrocard', 'aria-label': 'Metronome', 'data-view': 'Metronome', 'data-keep-text': '' },
    h('figcaption', {}, h('b', {}, 'Metronome'), about, playBtn),
    h('div', { class: 'm-body' }, pic,
      h('div', { class: 'm-controls' },
        h('div', { class: 'm-tempo' }, slower, bpmInput, faster, h('span', { class: 'm-unit', title: 'beats a minute' }, '/min')),
        h('div', { class: 'm-row' }, tapBtn, barSel),
        h('div', { class: 'm-row' }, dots, h('label', { class: 'm-level' }, 'Level', level)))));

  function drawDots() {
    dots.replaceChildren(...Array.from({ length: Math.max(1, S.perBar) }, (_, i) => h('span', { class: i === 0 && S.perBar ? 'bell' : '' })));
  }

  // ---- the sound: the bars struck, scheduled ahead on the audio clock
  let ctx = null, out = null, gain = null, bufs = null, timer = 0, frame = 0;
  let t0 = 0, k0 = 0, upTo = 0, swings = 0; // beat k0 + j falls at t0 + j · 60/bpm; scheduled up to upTo
  const sounding = []; // what is scheduled, for the pendulum and the dots: { t, k, beat, side }
  function buffers() {
    if (bufs?.rate === ctx.sampleRate) return bufs;
    const make = (bar) => { const x = strike(bar, ctx.sampleRate), b = ctx.createBuffer(1, x.length, ctx.sampleRate); b.copyToChannel(x, 0); return b; };
    return (bufs = { rate: ctx.sampleRate, tick: make(TICK), bell: make(BELL) });
  }
  function schedule() {
    const to = ctx.currentTime + LOOKAHEAD;
    for (const b of beatsBetween(t0, S.bpm, S.perBar, upTo, to, k0)) {
      const src = new AudioBufferSourceNode(ctx, { buffer: b.beat === 0 ? bufs.bell : bufs.tick });
      // the bell is the brighter, so it stands out by itself; the tick at the level, the bell a little under
      const g = new GainNode(ctx, { gain: b.beat === 0 ? 0.8 : 1 });
      src.connect(g).connect(gain);
      src.start(b.t);
      sounding.push({ ...b, side: swings++ % 2 ? 1 : -1 });
    }
    upTo = to;
    while (sounding.length > 16) sounding.shift();
  }
  function animate() {
    frame = requestAnimationFrame(animate);
    if (!ctx) return;
    const now = ctx.currentTime - (ctx.outputLatency || 0);
    const last = [...sounding].reverse().find((b) => b.t <= now);
    if (!last) return;
    lean(last.side * swing(now, last.t, S.bpm));
    const on = Math.max(0, S.perBar ? last.beat : 0);
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i === on && now - last.t < 0.12));
  }
  async function play() {
    ({ ctx, out } = await audio());
    if (!ctx) return;
    buffers();
    if (!gain) { gain = new GainNode(ctx, { gain: S.level * S.level }); gain.connect(out); }
    t0 = ctx.currentTime + 0.08; k0 = 0; upTo = t0 - 1e-6; sounding.length = 0;
    schedule();
    clearInterval(timer);
    timer = setInterval(schedule, 25);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(animate);
    playBtn.setAttribute('aria-pressed', 'true');
    playBtn.textContent = 'Stop';
    card.classList.add('running');
  }
  function stop() {
    clearInterval(timer); timer = 0;
    cancelAnimationFrame(frame);
    playBtn.setAttribute('aria-pressed', 'false');
    playBtn.textContent = 'Start';
    card.classList.remove('running');
    for (const d of dots.children) d.classList.remove('on');
    lean(0);
  }
  // a new tempo carries on from the next beat not yet scheduled, keeping its place in the bar; a
  // new bar starts with the bell on that beat
  function retime(newBar = false) {
    if (!timer) return;
    const next = beatsBetween(t0, S.bpm, S.perBar, upTo, Infinity, k0, 1)[0];
    k0 = newBar ? 0 : next.k; t0 = next.t;
  }
  function setBpm(v) {
    retime();
    S.bpm = clampBpm(v); bpmInput.value = S.bpm; save(); placeWeight();
  }

  playBtn.addEventListener('click', () => { if (timer) stop(); else play(); playBtn.blur(); });
  bpmInput.addEventListener('change', () => setBpm(bpmInput.value));
  slower.addEventListener('click', (e) => { setBpm(S.bpm - (e.shiftKey ? 5 : 1)); slower.blur(); });
  faster.addEventListener('click', (e) => { setBpm(S.bpm + (e.shiftKey ? 5 : 1)); faster.blur(); });
  const taps = [];
  tapBtn.addEventListener('click', () => {
    const t = performance.now() / 1000;
    if (taps.length && t - taps.at(-1) > 2.5) taps.length = 0;
    taps.push(t);
    const bpm = tapTempo(taps);
    if (bpm) setBpm(bpm);
  });
  barSel.addEventListener('change', () => { retime(true); S.perBar = +barSel.value; save(); drawDots(); barSel.blur(); });
  level.addEventListener('input', () => { S.level = +level.value; save(); if (gain) gain.gain.setTargetAtTime(S.level * S.level, ctx.currentTime, 0.01); });

  placeWeight(); lean(0); drawDots();
  return { card, stop, running: () => !!timer };
}
