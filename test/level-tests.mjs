// level-tests.mjs — the footswitch doesn't jump: each pedal at its defaults is as loud engaged as
// bypassed, within tools/loudness.mjs's TOLERANCE, measured as BS.1770 integrated loudness of
// the test bass's riff. First the meter against the Recommendation's own figures.

import { check, done } from './harness.mjs';
import { PEDALS } from '../shared/registry.js';
import { FS, TOLERANCE, lufs, riff, jump, knobOf } from '../tools/loudness.mjs';
import { loadPedal } from '../tools/engine.mjs';
import { params } from '../shared/params.js';

// the meter: BS.1770 says a 997 Hz sine at full scale in one channel reads −3.01 LKFS (the
// K-weighting's gain there is +0.69 dB, which the −0.691 offset cancels); in both, 3.01 dB more
const sine = (a, f = 997, s = 4) => Float64Array.from({ length: s * FS }, (_, i) => a * Math.sin((2 * Math.PI * f * i) / FS));
const one = lufs([sine(1), new Float64Array(4 * FS)]), two = lufs([sine(1), sine(1)]);
check(Math.abs(one + 3.01) < 0.05 && Math.abs(two) < 0.05, 'the meter: a full-scale 997 Hz sine reads −3.01 LUFS in one channel and 0 in two (BS.1770)', `${one.toFixed(3)}, ${two.toFixed(3)} LUFS`);
const half = lufs([sine(0.5), sine(0.5)]);
check(Math.abs(half - two + 6.02) < 0.05, 'the meter: half the amplitude, 6.02 LU less', `${(half - two).toFixed(3)} LU`);
// the gates: a quiet stretch below the relative gate doesn't pull the reading down
const gated = lufs([Float64Array.from({ length: 8 * FS }, (_, i) => (i < 4 * FS ? 1 : 0.01) * Math.sin((2 * Math.PI * 997 * i) / FS))].concat([new Float64Array(8 * FS)]));
check(Math.abs(gated - one) < 0.3, 'the meter: four seconds 40 dB down are gated out, not averaged in (which would read 3 dB lower); only the blocks across the change count', `${gated.toFixed(2)} against ${one.toFixed(2)} LUFS`);

// every pedal
const dry = await riff();
check(lufs([dry, dry]) > -40, 'the riff plays', `${lufs([dry, dry]).toFixed(1)} LUFS`);
for (const { id, name } of PEDALS.filter((p) => p.ready)) {
  const { PEDAL } = await loadPedal(id);
  const knob = params(PEDAL.groups).find((p) => p.id === knobOf(id));
  const d = await jump(id, {}, dry);
  check(knob && Math.abs(d) <= TOLERANCE, `${name}: engaged at its defaults, within ${TOLERANCE} dB of bypassed (its ${knob?.label ?? knobOf(id)} sets it)`, `${d >= 0 ? '+' : ''}${d.toFixed(2)} dB`);
}
done();
