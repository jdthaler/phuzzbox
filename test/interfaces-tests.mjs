// interfaces-tests.mjs — Full scale from an interface's specification, against the definition of
// the dBu (0 dBu = 1 mW into 600 Ω, so V_rms = √(0.001 × 600)) and a sine's peak, √2 × rms.

import { check, done } from './harness.mjs';
import { INTERFACES, byInterface, fullScaleVolts } from '../shared/interfaces.js';
import { GROUPS } from '../buffer/src/buffer-params.js';

const dbuPeak = (dbu) => Math.sqrt(0.001 * 600) * 10 ** (dbu / 20) * Math.SQRT2;

{
  const s4 = byInterface('scarlett-2i2-4'), s3 = byInterface('scarlett-2i2-3');
  const v4 = fullScaleVolts(s4, 0), v3 = fullScaleVolts(s3, 0);
  check(Math.abs(v4 - dbuPeak(12)) < 1e-12 && Math.abs(v4 - 4.361) < 0.001, 'a Scarlett 2i2 (4th gen) at minimum gain: +12 dBu is 4.36 V peak', `${v4.toFixed(3)} V`);
  check(Math.abs(v3 - dbuPeak(12.5)) < 1e-12, 'a Scarlett 2i2 (3rd gen) at minimum gain: +12.5 dBu is 4.63 V peak', `${v3.toFixed(3)} V`);
  const v20 = fullScaleVolts(s4, 20);
  check(Math.abs(v20 / v4 - 0.1) < 1e-12, '20 dB of gain makes full scale ten times smaller', `${v20.toFixed(3)} V`);
  check(fullScaleVolts(s4, 99) === fullScaleVolts(s4, 62) && fullScaleVolts(s4, -5) === v4, 'gain is held to the interface\'s range');
}
{
  const rec = GROUPS.flatMap((g) => g.params).find((p) => p.role === 'interface-input');
  check(!!rec && INTERFACES.every((i) => i.inputZ >= rec.min && i.inputZ <= rec.max), 'every interface\'s input impedance fits the Buffer\'s "Your interface\'s input"', INTERFACES.map((i) => `${i.name} ${i.inputZ / 1e6} MΩ`).join(', '));
  check(INTERFACES.every((i) => /^https:\/\//.test(i.source) && i.note), 'every interface names its source and how to read its gain');
}

done();
