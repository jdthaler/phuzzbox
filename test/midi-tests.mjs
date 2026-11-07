// midi-tests.mjs — the MIDI map (shared/midi.js): the FC-300's factory numbers, its live layout on
// a page and on the Pedalboard, what a CC's 0–127 does to each kind of control, latching and
// momentary switches, learn, the volume pedal's taper and tap tempo; and that the plugins' C++
// (phuzzbox/midi.h) has the same FC-300 numbers.

import { readFileSync } from 'node:fs';
import { check, done } from './harness.mjs';
import { MidiMap, FC300, defaultMappings, expressionOf, audioTaper, ccAction, targets } from '../shared/midi.js';
import { tapTempo } from '../shared/metronome.js';
import { BOARD_PEDALS } from '../board/src/board-pedals.js';
import { PEDAL as WAH } from '../wah/src/wah-pedal.js';
import { PEDAL as BUFFER } from '../buffer/src/buffer-pedal.js';
import { PEDAL as ROTARY } from '../rotary/src/rotary-pedal.js';
import { PEDAL as ECHO } from '../echo/src/echo-pedal.js';
import { PEDAL as LAMPVIBE } from '../lampvibe/src/lampvibe-pedal.js';
import { params } from '../shared/params.js';

const cc = (n, v, ch = 1) => [0xb0 | (ch - 1), n, v];

// 1. the factory numbers, from the FC-300 owner's manual (Control Change mode, pp. 21–23)
check(FC300.exp1 === 7 && FC300.exp2 === 1, 'FC-300: expression pedal 1 sends CC 7, expression pedal 2 CC 1');
check(FC300.pedals.join() === '65,66,67,68,69,70,71,72,73,74' && FC300.ctl.join() === '80,81' && FC300.expSw.join() === '82,83',
  'and number pedals 1–10 CC 65–74, CTL 1 and 2 CC 80 and 81, the expression pedals\' toe switches CC 82 and 83');
{
  const h = readFileSync(new URL('../native/core/include/phuzzbox/midi.h', import.meta.url), 'utf8');
  check(/exp1 = 7, exp2 = 1, pedal1 = 65, pedal2 = 66/.test(h), 'the plugins\' C++ has the same numbers');
}

// 2. the live layout on a page: EXP 1 the volume, EXP 2 the expression control, 1 and EXP 2's toe
// the footswitch, 2–10 the pedal's switches then its presets, CTL 1 the tuner, CTL 2 tap tempo
{
  const m = new MidiMap(WAH);
  const vol = m.message(cc(7, 127)).actions, rock = m.message(cc(1, 0)).actions;
  check(vol.length === 1 && vol[0].target === 'volume' && vol[0].value === 1, 'Wah: expression pedal 1 is the volume');
  check(rock.length === 1 && rock[0].target === 'param:position' && rock[0].value === 0, 'and expression pedal 2 the rocker');
  const sw = m.message(cc(65, 127)).actions, sw2 = m.message(cc(65, 0)).actions;
  check(sw.length === 1 && sw[0].target === 'bypass' && sw[0].toggle && sw2[0]?.toggle, 'and number pedal 1 the footswitch, toggled by each press of a latching pedal (127, then 0)');
  check(m.message(cc(83, 127)).actions[0]?.target === 'bypass', 'and the toe switch under expression pedal 2 the footswitch too, as a wah\'s');
  check(m.message(cc(80, 127)).actions[0]?.target === 'tuner', 'and CTL 1 the tuner');
  const tap = m.message(cc(81, 127)).actions, tap2 = m.message(cc(81, 0)).actions;
  check(tap[0]?.target === 'tap' && tap[0].press && tap2[0]?.press, 'and CTL 2 tap tempo, every press of a latching pedal a tap');
  const names = Object.keys(WAH.presets);
  const presets = FC300.pedals.slice(1).map((n) => m.message(cc(n, 127)).actions[0]?.target);
  check(presets.join() === names.slice(0, 9).map((n) => `preset:${n}`).join(), 'and number pedals 2–10 the Wah\'s presets, in order', presets.join(', '));
  const r = defaultMappings(ROTARY);
  check(r.find((x) => x.cc === 66)?.target === 'param:fast' && r.find((x) => x.cc === 67)?.target === `preset:${Object.keys(ROTARY.presets)[0]}`,
    'the Rotary\'s Fast switch comes before its presets, on number pedal 2');
  check(m.message(cc(7, 50, 9)).actions.length === 1, 'a mapping on any channel hears every channel');
  check(m.message(cc(20, 50)).actions.length === 0 && m.message([0x90, 40, 100]) === null, 'an unmapped CC or a note does nothing');
  check(m.message(cc(123, 0)) === null, 'nor do the channel-mode messages (CC 120–127)');
  check(m.message([0xc0, 2]).actions[0]?.program === 2, 'a program change (the FC-300 in Standard mode) comes through for the page to pick a preset');
}
// every pedal: an expression control (its descriptor's, else its first knob that is not a level or
// a mix), and no CC of the layout used twice except the footswitch's two
for (const D of Object.values(BOARD_PEDALS)) {
  const e = expressionOf(D), p = params(D.groups).find((x) => x.id === e);
  const m = defaultMappings(D), ccs = m.filter((x) => x.target !== 'bypass').map((x) => x.cc);
  const ok = p && !p.type && (D.expression ? e === D.expression : p.perform && !/^(level|volume|master|dry|mix|blend|wet)$/i.test(e)) && new Set(ccs).size === ccs.length;
  check(ok, `${D.name}: the expression pedal rocks ${p?.label ?? 'nothing'}, and the layout uses each CC once`);
}
// a page without a metronome (the app) leaves it out, and a page can add its own targets
{
  const m = new MidiMap(WAH, null, { only: ['volume', 'bypass', 'mute', 'tuner', 'tap'] });
  check(!m.targets.has('metronome') && m.mappings.some((x) => x.target === 'tap'), 'a page without a metronome leaves it out of its targets');
  const b = new MidiMap(WAH, null, { extra: [{ id: 'slot:1', label: 'Pedal 1', kind: 'switch' }], defaults: () => [{ cc: 65, target: 'slot:1', mode: 'toggle' }] });
  check(b.mappings.length === 1 && b.message(cc(65, 127)).actions[0]?.target === 'slot:1', 'the Pedalboard\'s own targets and layout: number pedal 1 its first pedal');
}

// 3. what a value does to each kind of control
{
  const T = new Map(targets(WAH).map((t) => [t.id, t]));
  const base = { mode: 'latch', invert: false };
  check(ccAction(T.get('param:position'), base, 127).value === 1 && ccAction(T.get('param:position'), base, 0).value === 0, 'a knob follows the CC along its travel, 0 to 127');
  check(ccAction(T.get('param:position'), { ...base, invert: true }, 127).value === 0, 'and a reversed pedal the other way');
  check(ccAction(T.get('param:taper'), base, 127).value === 1 && ccAction(T.get('param:taper'), base, 20).value === 0, 'a choice takes the nearest option');
  const mom = { ...base, mode: 'momentary' };
  const press = ccAction(T.get('bypass'), mom, 127, 0), release = ccAction(T.get('bypass'), mom, 0, 127), again = ccAction(T.get('bypass'), mom, 127, 127);
  check(press?.toggle === true && release === null && again === null, 'a momentary switch toggles once a press, not on release');
  check(ccAction(T.get('bypass'), base, 64).value === true && ccAction(T.get('bypass'), base, 63).value === false, 'a latching one set to follow its light is on from 64');
  const tog = { ...base, mode: 'toggle' };
  check(ccAction(T.get('bypass'), tog, 127, 0)?.toggle && ccAction(T.get('bypass'), tog, 0, 127)?.toggle, 'one set to toggle toggles on each press, 127 or 0');
  check(ccAction(T.get('tap'), mom, 127, 0)?.press && ccAction(T.get('tap'), mom, 0, 127) === null, 'tap tempo on a momentary pedal taps on the press, not on the release');
}

// 4. learn: the next CC is the mapping's, and leaves any other control it moved
{
  const m = new MidiMap(WAH);
  const i = m.add('param:sweepC');
  m.learn(i);
  const r = m.message(cc(7, 90));
  check(r.learned >= 0 && m.mappings.some((x) => x.target === 'param:sweepC' && x.cc === 7), 'learn: the next CC that arrives is the mapping\'s');
  check(!m.mappings.some((x) => x.target === 'volume'), 'and the control it moved before lets it go');
  check(r.actions.length === 1 && r.actions[0].target === 'param:sweepC', 'and it moves its new control at once');
  m.reset();
  check(m.mappings.length === defaultMappings(WAH).length, 'FC-300 live layout restores the layout');
}

// 5. the volume pedal's taper: an audio pot, 10 % at half travel, 0 at the heel, 1 at the toe
check(audioTaper(0) === 0 && audioTaper(1) === 1 && Math.abs(audioTaper(0.5) - 0.1) < 1e-12, 'volume pedal: an audio taper, 10 % at half travel');
{
  let up = true;
  for (let k = 1; k <= 127; k++) up &&= audioTaper(k / 127) > audioTaper((k - 1) / 127);
  check(up, 'and it rises at every step of the pedal');
}
// 6. tap tempo: two beats a half second apart are 120 a minute, and a pedal with a tempo takes it.
// The Tape Echo's last head heard comes round once a beat: its distance over the tape's speed is
// the beat (heads 1 and 2 at 4 and 8 cm, half a second: 16 cm/s); the Lamp Vibe sweeps once a beat.
check(tapTempo([10, 10.5, 11]) === 120, 'tap tempo: taps half a second apart are 120 beats a minute');
{
  const P = { heads: '12', head1: 0.04, head2: 0.08, head3: 0.12 };
  const t = ECHO.tap(P, 0.5);
  check(Math.abs(t.speed - 0.16) < 1e-12 && Math.abs(P.head2 / t.speed - 0.5) < 1e-12, 'Tape Echo: a tap at 120 a minute runs the tape at 16 cm/s, so head 2\'s echo comes a beat later', `${(100 * t.speed).toFixed(1)} cm/s`);
  check(ECHO.tap({ ...P, heads: '3' }, 0.1).speed === 0.4 && ECHO.tap({ ...P, heads: '1' }, 2.4).speed === 0.05, 'and stops at the capstan\'s 5 and 40 cm/s');
  check(Math.abs(LAMPVIBE.tap({}, 0.5).speed - 2) < 1e-12 && LAMPVIBE.tap({}, 2.5).speed === 0.5, 'Lamp Vibe: one sweep a beat, 2 Hz at 120 a minute, from 0.5 Hz');
}
// 7. a saved map with a stale target (a renamed control) is dropped, not trusted
check(new MidiMap(WAH, [{ cc: 3, target: 'param:gone' }, { cc: 4, target: 'volume' }]).mappings.length === 1, 'a saved mapping to a control that no longer exists is dropped');
done();
