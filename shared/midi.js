// midi.js — MIDI foot controllers on a pedal: which control change (CC) moves which control, the
// FC-300's live layout, MIDI learn, and what a CC's 0–127 means for each kind of control. No browser
// here (shared/midi-panel.js connects Web MIDI and draws the panel), so the Node tests and the
// app's window can use it too. The plugins' C++ follows the same rules (phuzzbox/midi.h).
//
//   const map = new MidiMap(PEDAL, saved ?? defaultMappings(PEDAL));
//   map.learn(index);                         the next CC that arrives is that mapping's
//   const { actions } = map.message([0xB0, 7, 93]);
//   actions: [{ target: 'volume', value: 0.73 }] — a position 0…1 for a knob or the volume pedal,
//            a boolean for a switch, an index for a choice, { toggle: true } for a switch pressed
//            once, { press: true } for a pedal that does something each press (tap tempo, a preset)
//
// A mapping: { cc, channel (1–16, or 0 for any), target, mode, invert }. Targets: 'volume' (the
// page's volume, through a volume pedal's audio taper), 'bypass' (the footswitch: on = engaged),
// 'tuner' (on: the output muted and the tuner shown, as a tuner pedal), 'mute' (the tuner's mute
// alone), 'tap' (tap tempo: the metronome, and the pedal's own tempo if it has one), 'metronome'
// (on: it plays), 'preset:<name>' (one of the pedal's presets), 'param:<id>' for any of the pedal's
// controls, and what a page adds (the Pedalboard: 'slot:<n>', the n-th pedal's footswitch, and
// 'rocker', the expression control of the pedal its expression pedal rocks).
//
// A switch's mode says what a press sends and what it does. 'toggle' (the FC-300's latching
// pedals: 127, then 0 on the next press): every message is a press, and each press toggles, so the
// pedal never gets out of step with the screen. 'latch': the same pedals, but 127 is on and 0 off,
// whatever the screen says. 'momentary' (127 while held, 0 on release): each press toggles.

import { params } from './params.js';

// Roland FC-300 in Control Change mode, as it leaves the factory (its owner's manual, pp. 21–23):
// expression pedal 1 sends CC 7 and expression pedal 2 CC 1, 0–127; number pedals 1–5 send CC
// 65–69, and 6–10 (the same five pedals after the bank pedal that selects 6–10) CC 70–74; the
// control pedals CTL 1 and 2 send CC 80 and 81, and the switches under the expression pedals' toes
// (EXP PEDAL SW 1 and 2) CC 82 and 83. Its table gives every switch as latching (127, then 0 on
// the next press), though its text calls the control pedals momentary: the 'toggle' mode works
// with either.
export const FC300 = { exp1: 7, exp2: 1, pedals: [65, 66, 67, 68, 69, 70, 71, 72, 73, 74], ctl: [80, 81], expSw: [82, 83] };

export const SWITCH_MODES = [
  ['toggle', 'each press toggles'],
  ['latch', 'latching: 127 on, 0 off'],
  ['momentary', 'momentary (127 while held)'],
];

// A volume pedal's pot is audio (log) taper: the share of the track below the wiper at travel x is
// (81^x − 1)/80, 10 % at half travel, as the usual "A" taper; the signal is that share of itself.
export const audioTaper = (x) => (81 ** Math.min(1, Math.max(0, x)) - 1) / 80;

// The control an expression pedal rocks on a pedal: the one its descriptor names (`expression`:
// the Wah's rocker, the Radio's tuning), or else its first knob on the face that is not a level or
// a mix (the Phuzz's Fuzz, the Tape Echo's tape speed, the Plate's decay).
const LEVELS = /^(level|volume|master|dry|mix|blend|wet)$/i;
export function expressionOf(PEDAL) {
  const all = params(PEDAL.groups);
  if (PEDAL.expression && all.some((p) => p.id === PEDAL.expression)) return PEDAL.expression;
  const knobs = all.filter((p) => p.perform && !p.type);
  return (knobs.find((p) => !LEVELS.test(p.id)) ?? knobs[0])?.id ?? null;
}

// What every page can do (`only` leaves out what a page cannot: the app has no metronome).
const PAGE = [
  { id: 'volume', label: 'Volume pedal', kind: 'continuous' },
  { id: 'bypass', label: 'Footswitch (engage)', kind: 'switch' },
  { id: 'tuner', label: 'Tuner (mutes)', kind: 'switch' },
  { id: 'mute', label: 'Mute', kind: 'switch' },
  { id: 'tap', label: 'Tap tempo', kind: 'press' },
  { id: 'metronome', label: 'Metronome', kind: 'switch' },
];

// Everything a CC can move on this pedal's page: the page's own, the page's extras (the
// Pedalboard's slots), the pedal's presets and its controls.
export function targets(PEDAL, { extra = [], only = null } = {}) {
  const list = [...PAGE.filter((t) => !only || only.includes(t.id)), ...extra];
  for (const name of Object.keys(PEDAL.presets ?? {})) list.push({ id: `preset:${name}`, label: `Preset: ${name}`, kind: 'press', preset: name });
  for (const p of params(PEDAL.groups)) {
    list.push({ id: `param:${p.id}`, label: p.label, kind: p.type === 'checkbox' ? 'switch' : p.type === 'select' ? 'choice' : 'continuous', param: p });
  }
  return list;
}

const map = (cc, target, mode = 'toggle') => ({ cc, channel: 0, target, mode, invert: false });

// The FC-300's live layout on a pedal's page, for the bank of number pedals 1–5 and the one of
// 6–10:
//   EXP 1   the volume                   EXP 2   the pedal's expression control
//   1       the footswitch               EXP 2's toe switch   the footswitch too, as a wah's
//   2–5     the pedal's switches (the Rotary's Fast), then its presets, in order
//   6–10    the presets after those
//   CTL 1   the tuner, muting the pedal  CTL 2   tap tempo
export function defaultMappings(PEDAL) {
  const m = [map(FC300.exp1, 'volume', 'latch')];
  const exp = expressionOf(PEDAL);
  if (exp) m.push(map(FC300.exp2, `param:${exp}`, 'latch'));
  m.push(map(FC300.pedals[0], 'bypass'));
  const more = [
    ...params(PEDAL.groups).filter((p) => p.perform && p.type === 'checkbox').map((p) => `param:${p.id}`),
    ...Object.keys(PEDAL.presets ?? {}).map((n) => `preset:${n}`),
  ];
  more.slice(0, 9).forEach((t, i) => m.push(map(FC300.pedals[i + 1], t)));
  m.push(map(FC300.ctl[0], 'tuner'), map(FC300.ctl[1], 'tap'), map(FC300.expSw[1], 'bypass'));
  return m;
}

// The layout before this one (number pedal 2 the tuner's mute, latching): a page that saved it,
// untouched, takes the live layout instead.
export function legacyMappings(PEDAL) {
  const m = [map(FC300.exp1, 'volume', 'latch')];
  if (PEDAL.expression) m.push(map(FC300.exp2, `param:${PEDAL.expression}`, 'latch'));
  m.push(map(FC300.pedals[0], 'bypass', 'latch'), map(FC300.pedals[1], 'mute', 'latch'));
  return m;
}
const same = (a, b) => a.length === b.length && a.every((x, i) => ['cc', 'channel', 'target', 'mode', 'invert'].every((k) => (x[k] ?? map(0, '')[k]) === b[i][k]));
export const isLegacy = (saved, PEDAL) => Array.isArray(saved) && same(saved, legacyMappings(PEDAL));

// Whether a value is a press of a pedal, given the last value the same CC sent: for a momentary
// pedal, the value rising through 64; for a latching one, every message.
const pressed = (m, v, last) => (m.mode === 'momentary' ? v >= 64 && !(last >= 64) : true);

// What a CC value (0–127) does to a target of a kind: a position for a continuous control; for a
// switch on or off (latch: ≥ 64 is on), or a press that toggles it; a press for a pedal that acts
// once a press; and the nearest of a choice's options. Returns null when nothing should happen.
export function ccAction(t, m, value, last) {
  const v = m.invert ? 127 - value : value;
  if (t.kind === 'continuous') return { target: t.id, value: v / 127 };
  if (t.kind === 'choice') return { target: t.id, value: Math.round((v / 127) * (t.param.options.length - 1)) };
  if (t.kind === 'press') return pressed(m, v, last) ? { target: t.id, press: true } : null;
  if (m.mode === 'latch') return { target: t.id, value: v >= 64 };
  return pressed(m, v, last) ? { target: t.id, toggle: true } : null;
}

export class MidiMap {
  // opts: { extra: more targets (the Pedalboard's slots), only: the page's own targets it has,
  //         defaults: () => its own layout }
  constructor(PEDAL, mappings, opts = {}) {
    this.PEDAL = PEDAL;
    this.opts = opts;
    this.targets = new Map(targets(PEDAL, opts).map((t) => [t.id, t]));
    this.mappings = (mappings ?? this.defaults()).filter((m) => this.targets.has(m.target)).map((m) => ({ channel: 0, mode: 'latch', invert: false, ...m }));
    this.learning = -1; // the mapping waiting for its CC
    this.last = new Map(); // `${channel}:${cc}` → the last value, for momentary switches
  }
  defaults() { return (this.opts.defaults?.() ?? defaultMappings(this.PEDAL)).filter((m) => this.targets.has(m.target)); }
  learn(i) { this.learning = i; }
  cancelLearn() { this.learning = -1; }
  add(target = 'volume') { this.mappings.push({ cc: 0, channel: 0, target, mode: 'toggle', invert: false }); return this.mappings.length - 1; }
  remove(i) { this.mappings.splice(i, 1); if (this.learning === i) this.learning = -1; else if (this.learning > i) this.learning--; }
  reset() { this.mappings = this.defaults(); this.learning = -1; }
  // the targets a CC moves (on any channel), for the drawing of the foot controller
  of(cc) { return this.mappings.filter((m) => m.cc === cc).map((m) => this.targets.get(m.target)); }

  // One MIDI message, as bytes. Returns { cc, channel, value, learned, actions } for a control
  // change, { program, channel, actions: [{ program }] } for a program change, or null.
  message(data) {
    const [status, d1 = 0, d2 = 0] = data;
    const type = status & 0xf0, channel = (status & 0x0f) + 1;
    if (type === 0xc0) return { program: d1, channel, actions: [{ program: d1 }] };
    if (type !== 0xb0 || d1 > 119) return null; // 120–127 are channel mode messages
    const key = `${channel}:${d1}`, last = this.last.get(key);
    this.last.set(key, d2);
    let learned = -1;
    if (this.learning >= 0 && this.learning < this.mappings.length) {
      // a pedal taught to one control leaves the others it moved
      this.mappings.forEach((m, i) => { if (i !== this.learning && m.cc === d1 && (m.channel === 0 || m.channel === channel)) m.cc = -1; });
      this.mappings[this.learning].cc = d1;
      learned = this.learning;
      this.learning = -1;
      this.mappings = this.mappings.filter((m) => m.cc >= 0);
      learned = Math.min(learned, this.mappings.length - 1);
    }
    const actions = [];
    for (const m of this.mappings) {
      if (m.cc !== d1 || (m.channel && m.channel !== channel)) continue;
      const a = ccAction(this.targets.get(m.target), m, d2, last);
      if (a) actions.push(a);
    }
    return { cc: d1, channel, value: d2, learned, actions };
  }
}
