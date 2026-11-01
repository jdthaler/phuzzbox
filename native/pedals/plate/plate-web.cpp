// plate-web.cpp — the model functions the Plate Reverb's page and tests call (through the scratch
// area, shared/wasm.js): the losses, and the modes the engine plays.

#include <memory>

#include "phuzzbox/web.h"
#include "plate-engine.h"
#include "plate-params.h"

extern "C" {
// in: P, then n frequencies (Hz). out: arrays of n: the thermoelastic, radiation and damper rates
// (1/s) and the T60 of all three (s)
PHUZZ_EXPORT void plate_decay(double *io, int n) {
  const double *P = io, *f = io + plate::kParamCount;
  double *out = io + plate::kParamCount + n;
  const double d = plate::damper(P[plate::decay]);
  for (int i = 0; i < n; i++) {
    const double th = plate::thermoelastic(f[i]), ra = plate::radiation(f[i]);
    out[i] = th; out[n + i] = ra; out[2 * n + i] = d;
    out[3 * n + i] = 3 * std::log(10.0) / (th + ra + d);
  }
}

// in: P. out: how the engine plays the plate at 48 kHz: its modes, how many of them at fs/4, the
// filters' delay of the wet signal (samples), the highest mode played (Hz), the transducers' gain
PHUZZ_EXPORT void plate_info(double *io) {
  auto e = std::make_unique<plate::Engine>(48000);
  e->setParams(io);
  io[0] = e->modes; io[1] = e->low; io[2] = e->delay; io[3] = e->top; io[4] = e->gain;
}

// in: P. out: the number of modes the engine plays at 48 kHz, and up to max of them from the
// from-th on, as (m, n, frequency) triples
PHUZZ_EXPORT int plate_modes(double *io, int from, int max) {
  auto e = std::make_unique<plate::Engine>(48000);
  e->setParams(io);
  const int count = e->modes;
  for (int i = 0; i < std::min(max, count - from); i++) { io[3 * i] = e->mm[from + i]; io[3 * i + 1] = e->nn[from + i]; io[3 * i + 2] = e->freq[from + i]; }
  return count;
}

// in: P. out: up to max of the modes from the from-th on, as their shapes at the driver and at the
// left and right pickups, (Φ_d, Φ_l, Φ_r) triples; returns the number of modes
PHUZZ_EXPORT int plate_shapes(double *io, int from, int max) {
  auto e = std::make_unique<plate::Engine>(48000);
  e->setParams(io);
  const int count = e->modes;
  for (int i = 0; i < std::min(max, count - from); i++) { io[3 * i] = e->shapeD[from + i]; io[3 * i + 1] = e->shapeL[from + i]; io[3 * i + 2] = e->shapeR[from + i]; }
  return count;
}
}
