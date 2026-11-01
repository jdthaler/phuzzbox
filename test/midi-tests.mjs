// midi-tests.mjs — the MIDI map (shared/midi.js): the FC-300's factory numbers, what a CC's 0–127
// does to each kind of control, latching and momentary switches, learn, and the volume pedal's
// taper; and that the plugins' C++ (phuzzbox/midi.h) has the same FC-300 numbers.

import { readFileSync } from 'node:fs';
import { check, done } from './harness.mjs';
import { MidiMap, FC300, defaultMappings, audioTaper, ccAction, targets } from '../shared/midi.js';
import { PEDAL as WAH } from '../wah/src/wah-pedal.js';
import { PEDAL as BUFFER } from '../buffer/src/buffer-pedal.js';

const cc = (n, v, ch = 1) => [0xb0 | (ch - 1), n, v];

// 1. the factory numbers, from the FC-300 owner's manual (Control Change mode, pp. 21–22)
check(FC300.exp1 === 7 && FC300.exp2 === 1, 'FC-300: expression pedal 1 sends CC 7, expression pedal 2 CC 1');
check(FC300.pedals.join() === '65,66,67,68,69,70,71,72,73,74' && FC300.ctl.join() === '80,81', 'and number pedals 1–10 CC 65–74, CTL 1 and 2 CC 80 and 81');
{
  const h = readFileSync(new URL('../native/core/include/phuzzbox/midi.h', import.meta.url), 'utf8');
  check(/exp1 = 7, exp2 = 1, pedal1 = 65, pedal2 = 66/.test(h), 'the plugins\' C++ has the same numbers');
}

// 2. the defaults: volume on expression 1, the rocker on expression 2, the footswitch on pedal 1
{
  const m = new MidiMap(WAH);
  const vol = m.message(cc(7, 127)).actions, rock = m.message(cc(1, 0)).actions;
  check(vol.length === 1 && vol[0].target === 'volume' && vol[0].value === 1, 'Wah: expression pedal 1 is the volume');
  check(rock.length === 1 && rock[0].target === 'param:position' && rock[0].value === 0, 'and expression pedal 2 the rocker');
  const sw = m.message(cc(65, 0)).actions;
  check(sw.length === 1 && sw[0].target === 'bypass' && sw[0].value === false, 'and number pedal 1 the footswitch (latching: 0 is off)');
  check(m.message(cc(66, 127)).actions[0]?.target === 'mute', 'and number pedal 2 the tuner\'s mute');
  check(!defaultMappings(BUFFER).some((x) => x.cc === 1), 'the Buffer, with no expression control, leaves CC 1 free');
  check(m.message(cc(7, 50, 9)).actions.length === 1, 'a mapping on any channel hears every channel');
  check(m.message(cc(20, 50)).actions.length === 0 && m.message([0x90, 40, 100]) === null, 'an unmapped CC or a note does nothing');
  check(m.message(cc(123, 0)) === null, 'nor do the channel-mode messages (CC 120–127)');
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
  check(ccAction(T.get('bypass'), base, 64).value === true && ccAction(T.get('bypass'), base, 63).value === false, 'a latching one is on from 64');
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
  check(m.mappings.length === defaultMappings(WAH).length, 'FC-300 defaults restores the factory map');
}

// 5. the volume pedal's taper: an audio pot, 10 % at half travel, 0 at the heel, 1 at the toe
check(audioTaper(0) === 0 && audioTaper(1) === 1 && Math.abs(audioTaper(0.5) - 0.1) < 1e-12, 'volume pedal: an audio taper, 10 % at half travel');
{
  let up = true;
  for (let k = 1; k <= 127; k++) up &&= audioTaper(k / 127) > audioTaper((k - 1) / 127);
  check(up, 'and it rises at every step of the pedal');
}
// 6. a saved map with a stale target (a renamed control) is dropped, not trusted
check(new MidiMap(WAH, [{ cc: 3, target: 'param:gone' }, { cc: 4, target: 'volume' }]).mappings.length === 1, 'a saved mapping to a control that no longer exists is dropped');
done();
