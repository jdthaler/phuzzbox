// octave-web.cpp — the model functions the Octave Down's page and tests call (through the scratch
// area, shared/wasm.js): the divider playing a steady sine, sample by sample, for its picture.

#include <cmath>

#include "phuzzbox/web.h"
#include "octave-engine.h"
#include "octave-params.h"

extern "C" {
// in: P[kParamCount], a sine's frequency f (Hz) and amplitude A (V). The divider plays it for a
// second at 48 kHz from rest, then for n samples more, every `stride` samples recorded. out
// (after the inputs), as arrays of n: the filtered bass x_f, q₁, q₂, the octave paths x_f·q after
// their tone filters (one, then two octaves down)
PHUZZ_EXPORT void octave_wave(double *io, int n, int stride) {
  const double f = io[octave::kParamCount], A = io[octave::kParamCount + 1];
  double *out = io + octave::kParamCount + 2;
  const double fs = 48000;
  octave::Engine e(fs);
  e.setParams(io);
  long k = 0;
  const double w = 2 * octave::PI * f / fs;
  for (; k < (long)fs; k++) e.step(A * std::sin(w * k));
  for (int i = 0; i < n; i++) {
    for (int j = 0; j < stride; j++, k++) e.step(A * std::sin(w * k));
    out[i] = e.xf; out[n + i] = e.q1; out[2 * n + i] = e.q2; out[3 * n + i] = e.y1; out[4 * n + i] = e.y2;
  }
}
}
