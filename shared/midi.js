// midi.js — MIDI foot controllers on a pedal: which control change (CC) moves which control, the
// FC-300's defaults, MIDI learn, and what a CC's 0–127 means for each kind of control. No browser
// here (shared/midi-panel.js connects Web MIDI and draws the panel), so the Node tests and the
// app's window can use it too. The plugins' C++ follows the same rules (phuzzbox/midi.h).
//
//   const map = new MidiMap(PEDAL, saved ?? defaultMappings(PEDAL));
//   map.learn(index);                         the next CC that arrives is that mapping's
//   const { actions } = map.message([0xB0, 7, 93]);
//   actions: [{ target: 'volume', value: 0.73 }] — a position 0…1 for a knob or the volume pedal,
//            a boolean for a switch, an index for a choice, { toggle: true } for a momentary press
//
// A mapping: { cc, channel (1–16, or 0 for any), target, mode, invert }. Targets: 'volume' (the
// page's volume, through a volume pedal's audio taper), 'bypass' (the footswitch: on = engaged),
// 'mute' (the tuner's mute), or 'param:<id>' for any of the pedal's controls. A switch's mode is
// 'latch' (a footswitch that sends 127 and 0 on alternate presses: 127 is on) or 'momentary' (127
// while held, 0 on release: each press toggles).

import { params } from './params.js';

// Roland FC-300 in Control Change mode, as it leaves the factory (its owner's manual, pp. 21–22):
// expression pedal 1 sends CC 7 and expression pedal 2 CC 1, 0–127; number pedals 1–10 send CC
// 65–74, latching (127, then 0 on the next press); the control pedals CTL 1 and 2 send CC 80 and
// 81, momentary (127 while held, 0 on release).
export const FC300 = { exp1: 7, exp2: 1, pedals: [65, 66, 67, 68, 69, 70, 71, 72, 73, 74], ctl: [80, 81] };

export const SWITCH_MODES = [['latch', 'latching (127, then 0)'], ['momentary', 'momentary (held)']];

// A volume pedal's pot is audio (log) taper: the share of the track below the wiper at travel x is
// (81^x − 1)/80, 10 % at half travel, as the usual "A" taper; the signal is that share of itself.
export const audioTaper = (x) => (81 ** Math.min(1, Math.max(0, x)) - 1) / 80;

// Everything a CC can move on this pedal's page.
export function targets(PEDAL) {
  const list = [
    { id: 'volume', label: 'Volume pedal', kind: 'continuous' },
    { id: 'bypass', label: 'Footswitch (engage)', kind: 'switch' },
    { id: 'mute', label: 'Tuner mute', kind: 'switch' },
  ];
  for (const p of params(PEDAL.groups)) {
    list.push({ id: `param:${p.id}`, label: p.label, kind: p.type === 'checkbox' ? 'switch' : p.type === 'select' ? 'choice' : 'continuous', param: p });
  }
  return list;
}

// The FC-300's pedals on this pedal: expression 1 the volume, expression 2 the pedal's expression
// control (the Wah's rocker), number pedal 1 the footswitch, number pedal 2 the tuner's mute.
export function defaultMappings(PEDAL) {
  const m = [{ cc: FC300.exp1, channel: 0, target: 'volume', mode: 'latch', invert: false }];
  if (PEDAL.expression) m.push({ cc: FC300.exp2, channel: 0, target: `param:${PEDAL.expression}`, mode: 'latch', invert: false });
  m.push({ cc: FC300.pedals[0], channel: 0, target: 'bypass', mode: 'latch', invert: false });
  m.push({ cc: FC300.pedals[1], channel: 0, target: 'mute', mode: 'latch', invert: false });
  return m;
}

// What a CC value (0–127) does to a target of a kind: a position for a continuous control, on or
// off for a switch (latching: ≥ 64 is on; momentary: a press, ≥ 64 after < 64, toggles), and the
// nearest of a choice's options. Returns null when nothing should happen.
export function ccAction(t, m, value, last) {
  const v = m.invert ? 127 - value : value;
  if (t.kind === 'continuous') return { target: t.id, value: v / 127 };
  if (t.kind === 'choice') return { target: t.id, value: Math.round((v / 127) * (t.param.options.length - 1)) };
  if (m.mode === 'momentary') return v >= 64 && !(last >= 64) ? { target: t.id, toggle: true } : null;
  return { target: t.id, value: v >= 64 };
}

export class MidiMap {
  constructor(PEDAL, mappings = defaultMappings(PEDAL)) {
    this.PEDAL = PEDAL;
    this.targets = new Map(targets(PEDAL).map((t) => [t.id, t]));
    this.mappings = mappings.filter((m) => this.targets.has(m.target)).map((m) => ({ channel: 0, mode: 'latch', invert: false, ...m }));
    this.learning = -1; // the mapping waiting for its CC
    this.last = new Map(); // `${channel}:${cc}` → the last value, for momentary switches
  }
  learn(i) { this.learning = i; }
  cancelLearn() { this.learning = -1; }
  add(target = 'volume') { this.mappings.push({ cc: 0, channel: 0, target, mode: 'latch', invert: false }); return this.mappings.length - 1; }
  remove(i) { this.mappings.splice(i, 1); if (this.learning === i) this.learning = -1; else if (this.learning > i) this.learning--; }
  reset() { this.mappings = defaultMappings(this.PEDAL); this.learning = -1; }

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
