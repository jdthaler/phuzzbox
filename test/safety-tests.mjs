// safety-tests.mjs — the curve before the speakers (shared/safety.js): transparent below its knee,
// smooth and bounded above it, and the page's path to the speakers free of anything that looks
// ahead (a DynamicsCompressorNode delays everything by 6 ms in every browser).

import { readFileSync } from 'node:fs';
import { check, done } from './harness.mjs';
import { safe, safetyCurve, SAFE_KNEE, SAFE_SPAN } from '../shared/safety.js';

// the identity below the knee: what the WaveShaperNode does, linear interpolation in the curve
const curve = safetyCurve(), n = curve.length;
const shaper = (x) => { // the Web Audio specification's WaveShaperNode, oversample 'none'
  const v = ((x / SAFE_SPAN + 1) * (n - 1)) / 2;
  if (v <= 0) return curve[0];
  if (v >= n - 1) return curve[n - 1];
  const k = Math.floor(v), f = v - k;
  return (1 - f) * curve[k] + f * curve[k + 1];
};
let worst = 0;
for (let i = 0; i <= 20000; i++) { const x = -SAFE_KNEE + (2 * SAFE_KNEE * i) / 20000; worst = Math.max(worst, Math.abs(shaper(x) - x)); }
check(worst < 1e-6, 'below −3 dB of full scale the shaper passes the signal untouched', `worst ${worst.toExponential(1)}`);

// bounded, odd, monotonic, and its slope continuous at the knee (no corner, so no hard edge to hear)
check(safe(SAFE_SPAN) < 1 && safe(100) <= 1 && safe(-100) >= -1, 'nothing comes out above full scale, however hot');
check(curve.every((y, i) => i === 0 || y >= curve[i - 1]), 'the curve rises everywhere');
check(Math.abs(safe(0.9) + safe(-0.9)) < 1e-12, 'the curve is odd: both halves of a wave bend alike');
const h = 1e-6, below = (safe(SAFE_KNEE) - safe(SAFE_KNEE - h)) / h, above = (safe(SAFE_KNEE + h) - safe(SAFE_KNEE)) / h;
check(Math.abs(below - 1) < 1e-4 && Math.abs(above - 1) < 1e-4, 'the knee joins the line with the same slope', `${below.toFixed(5)}, ${above.toFixed(5)}`);
check(safe(2) > 0.98, 'a signal at twice full scale is held just under it', safe(2).toFixed(3));

// the page's path from the pedal to the speakers: no compressor, the shaper without oversampling
// (whose filters would delay it), and the span gain in front of it
const shell = readFileSync(new URL('../shared/shell.js', import.meta.url), 'utf8');
check(!/DynamicsCompressor/.test(shell), 'no compressor before the speakers (6 ms of look-ahead)');
check(/new WaveShaperNode\(ctx, \{ curve: safetyCurve\(\), oversample: 'none' \}\)/.test(shell), 'the safety curve is a WaveShaperNode without oversampling');
check(/connect\(volume\)\.connect\(span\)\.connect\(safety\)\.connect\(ctx\.destination\)/.test(shell), 'the pedal goes through the volume, the span and the curve to the speakers');
done();
