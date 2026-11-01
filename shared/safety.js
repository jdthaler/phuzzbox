// safety.js — what keeps a pedal at full tilt from hurting anyone, without delaying the sound.
//
// The pages used a DynamicsCompressorNode as a safety limiter before the speakers. Every browser's
// compressor (Chromium's, WebKit's and Firefox's share the code) looks 6 ms ahead, so it delayed
// everything by 6 ms, a quarter of a browser's whole round trip, for a limiter that almost never
// acted. A static curve has no look-ahead: a WaveShaperNode without oversampling passes each
// sample through it as it comes, with no delay at all.
//
// The curve is the identity up to SAFE_KNEE of full scale (−3 dB, where the compressor's threshold
// was), so anything quieter passes untouched; above it, a tanh knee joins the line
// with the same slope and bends over toward full scale, which nothing reaches:
//
//   y = x                                   |x| ≤ t
//   y = sign(x) (t + (1 − t) tanh((|x| − t) / (1 − t)))   above
//
// A WaveShaperNode's curve spans inputs −1…1 and holds its ends beyond them, so the page divides
// the signal by SAFE_SPAN before the shaper, and the curve is drawn over ±SAFE_SPAN of full scale:
// a signal up to 4 times full scale (12 dB over) still bends smoothly instead of hitting the end.

export const SAFE_KNEE = 0.708; // −3 dB of full scale
export const SAFE_SPAN = 4;     // the curve covers ±4 × full scale

// y for an input x in full-scale units
export function safe(x) {
  const a = Math.abs(x), t = SAFE_KNEE;
  if (a <= t) return x;
  return Math.sign(x) * (t + (1 - t) * Math.tanh((a - t) / (1 - t)));
}

// The WaveShaperNode's curve: n points over inputs −1…1, which stand for ±SAFE_SPAN of full scale.
// n odd puts a point at exactly 0; the segments inside the knee are straight, so the shaper's
// linear interpolation between points is the identity there.
export function safetyCurve(n = 8193) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = safe(SAFE_SPAN * ((2 * i) / (n - 1) - 1));
  return c;
}
