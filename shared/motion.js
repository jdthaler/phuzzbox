// motion.js — slow motion, as Forte's views have it: the first moments of a note, replayed slowly
// enough to watch the physics move. A slow-motion view catches each note played at the input (the
// interface's or the test bass's), and until one is played, a note of the test bass rendered on
// the page; it runs the pedal's own model on that note from rest and draws it on a clock that runs
// at a fraction of real time, 1/100 by default, looping. The card's title bar gets the speed, a
// pause and a replay.
//
//   const m = slowMotion(holder, api, { seconds: 0.3 });    // in a view's mount
//   m.on((signal, fs, from) => …)   each new note: its volts (Float32Array) at fs, and where it came
//                                   from ('your note' or 'a test bass E1'); called once at the start
//   m.t()                           seconds into the note now, on the slowed clock
//   m.label()                       "12.3 ms · 1/100 speed", for the view to draw
//
// The input's analyser holds the last 8192 samples (shared/shell.js), so what is caught of a note
// played is its first 0.13 s or so; after that the model hears silence. A test bass note is
// rendered whole. The pure parts (spotting a note's start, the clock) are exported for
// test/motion-tests.mjs.

import { TestBass } from './testbass.js';

export const SPEEDS = [1 / 10, 1 / 30, 1 / 100, 1 / 300, 1 / 1000];
export const speedName = (s) => `1/${Math.round(1 / s)}`;

const rms = (x, from, to) => { let s = 0; for (let i = from; i < to; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, to - from)); };

// Has a note just started at the end of x? Its last 20 ms are at least three times as loud (RMS) as
// the 80 ms before them, and louder than 2 mV, a quiet note's level from a passive pickup.
export function noteStarted(x, fs) {
  const a = Math.round(0.02 * fs), b = Math.round(0.08 * fs), n = x.length;
  if (n < a + b) return false;
  const now = rms(x, n - a, n), before = rms(x, n - a - b, n - a);
  return now > 2e-3 && now > 3 * before;
}

// Where a note starts in x, near `guess` (a sample index): the first millisecond, going back from
// the loudest millisecond within 30 ms after the guess, that is under a quarter as loud, less 2 ms.
export function onsetNear(x, fs, guess) {
  const B = Math.max(1, Math.round(0.001 * fs)), n = x.length;
  const block = (b) => { let m = 0; for (let i = b * B; i < Math.min(n, (b + 1) * B); i++) m = Math.max(m, Math.abs(x[i])); return m; };
  const lo = Math.max(0, Math.floor((guess - 0.03 * fs) / B)), hi = Math.min(Math.floor(n / B) - 1, Math.ceil((guess + 0.03 * fs) / B));
  let peak = lo;
  for (let b = lo; b <= hi; b++) if (block(b) > block(peak)) peak = b;
  let b = peak;
  while (b > 0 && block(b - 1) >= 0.25 * block(peak)) b--;
  return Math.max(0, (b - 2) * B);
}

// The slowed clock: real seconds since the start, times the speed, held for `rest` real seconds at
// the end, then round again. Returns the note's own seconds.
export function slowTime(real, speed, seconds, rest = 1.5) {
  const lap = seconds / speed + rest, r = real % lap;
  return Math.min(seconds, r * speed);
}

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};

export function slowMotion(holder, api, { seconds = 0.2, speed = 1 / 100, key = 28, velocity = 0.8, name = 'a test bass E1' } = {}) {
  const card = holder.closest('.card') ?? holder.parentElement;
  const title = card?.dataset?.view ?? 'view';
  const keyName = `phuzzbox.motion.${title}`;
  let s = store.get(keyName, speed);
  if (!SPEEDS.includes(s)) s = speed;
  let started = performance.now(), paused = null, signal = null, fs = 48000, from = '', listeners = [];

  // the title bar: speed, pause, replay
  const bar = document.createElement('span');
  bar.className = 'motion';
  const sel = document.createElement('select');
  sel.setAttribute('aria-label', 'Slow motion: how much slower than real time');
  for (const v of SPEEDS) { const o = document.createElement('option'); o.value = String(v); o.textContent = `${speedName(v)} speed`; sel.append(o); }
  sel.value = String(s);
  const pause = document.createElement('button');
  pause.type = 'button'; pause.className = 'ghost'; pause.setAttribute('aria-label', 'Pause the slow motion'); pause.textContent = '❚❚';
  const again = document.createElement('button');
  again.type = 'button'; again.className = 'ghost'; again.setAttribute('aria-label', 'Play the note again from its start'); again.textContent = '↺';
  bar.append(sel, pause, again);
  card?.querySelector('figcaption')?.append(bar);
  const now = () => (paused ?? performance.now());
  sel.addEventListener('change', () => {
    const t = m.t();
    s = Number(sel.value); store.set(keyName, s);
    started = now() - (1000 * t) / s; // keep the place in the note
  });
  pause.addEventListener('click', () => {
    if (paused === null) { paused = performance.now(); pause.textContent = '▶'; pause.setAttribute('aria-label', 'Go on with the slow motion'); }
    else { started += performance.now() - paused; paused = null; pause.textContent = '❚❚'; pause.setAttribute('aria-label', 'Pause the slow motion'); }
  });
  again.addEventListener('click', () => { started = now(); });

  const take = (x, rate, what) => {
    signal = x; fs = rate; from = what; started = now();
    for (const fn of listeners) fn(signal, fs, from);
  };

  // until a note is played: one of the test bass's, rendered here
  (async () => {
    try {
      await TestBass.ready();
      if (signal) return;
      const b = new TestBass(48000), n = Math.round(Math.max(seconds, 0.05) * 48000), x = new Float32Array(n);
      b.note(key, velocity); b.process(x); b.destroy();
      if (!signal) take(x, 48000, name);
    } catch { /* no test bass: wait for a note */ }
  })();

  // each note played: watch the input, and when a note starts, wait until the analyser holds as
  // much of it as it can, then take it from just before its start
  let buf = null, waiting = 0, quietUntil = 0;
  setInterval(() => {
    const an = api.input;
    if (!an || waiting || document.hidden || holder.offsetParent === null) return;
    if (!buf || buf.length !== an.fftSize) buf = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(buf);
    const t0 = api.ctx.currentTime, rate = api.ctx.sampleRate;
    if (t0 < quietUntil || !noteStarted(buf, rate)) return;
    const hold = Math.min(seconds, buf.length / rate - 0.045);
    waiting = setTimeout(() => {
      waiting = 0;
      an.getFloatTimeDomainData(buf);
      const age = api.ctx.currentTime - t0 + 0.012; // the note began about 12 ms before it was seen
      const at = onsetNear(buf, rate, buf.length - Math.round(age * rate));
      const x = buf.slice(at);
      const fade = Math.min(x.length, Math.round(0.005 * rate)); // so the end isn't a click into the model
      for (let i = 0; i < fade; i++) x[x.length - 1 - i] *= i / fade;
      quietUntil = api.ctx.currentTime + 0.1;
      take(x, rate, 'your note');
    }, 1000 * hold);
  }, 30);

  const m = {
    on(fn) { listeners.push(fn); if (signal) fn(signal, fs, from); },
    t: () => slowTime((now() - started) / 1000, s, seconds),
    get speed() { return s; },
    get signal() { return signal; },
    get fs() { return fs; },
    get from() { return from; },
    seconds,
    restart() { started = now(); },
    label() {
      const t = m.t();
      return `${t < 0.1 ? (1000 * t).toFixed(1) : (1000 * t).toFixed(0)} ms after ${from || 'the note'} began · ${speedName(s)} speed`;
    },
  };
  return m;
}

// A bank of modes as the pedals' engines play them: each a complex one-pole z ← p·z + c·x (the
// impulse invariant of a damped resonance), advanced a sample at a time on the slowed clock, so a
// view can draw the field the modes make at any moment. `seek(k, x)` brings it to sample k of the
// input x (zero past its end), from rest again if k is behind it, at most `most` samples a call so
// a frame never stalls (the picture catches up over the next frames).
export class Bank {
  constructor(pr, pi, cr, ci) { this.pr = pr; this.pi = pi; this.cr = cr; this.ci = ci; this.zr = new Float64Array(pr.length); this.zi = new Float64Array(pr.length); this.k = 0; }
  reset() { this.zr.fill(0); this.zi.fill(0); this.k = 0; }
  seek(k, x, most = Infinity) {
    if (k < this.k) this.reset();
    const { pr, pi, cr, ci, zr, zi } = this, n = pr.length, end = Math.min(k, this.k + most);
    for (; this.k < end; this.k++) {
      const v = this.k < x.length ? x[this.k] : 0;
      for (let j = 0; j < n; j++) {
        const r = pr[j] * zr[j] - pi[j] * zi[j] + cr[j] * v, i = pi[j] * zr[j] + pr[j] * zi[j] + ci[j] * v;
        zr[j] = r; zi[j] = i;
      }
    }
  }
}
