// sympathetic-web.cpp — the model functions the Sympathetic Strings' page and tests call (through
// the scratch area, shared/wasm.js): the strings as tuned, and their partials.

#include <algorithm>
#include <memory>

#include "phuzzbox/web.h"
#include "sympathetic-engine.h"
#include "sympathetic-params.h"

extern "C" {
// in: P. out: the number of strings at 48 kHz, the pickup's gain, b₁, b₃, then for each string its
// note (Hz), length (m), tension (N), linear density (kg/m), EI (N m²), B and number of partials
PHUZZ_EXPORT void sympathetic_strings(double *io) {
  auto e = std::make_unique<sympathetic::Engine>(48000);
  e->setParams(io);
  io[0] = e->strings; io[1] = e->gain; io[2] = e->b1; io[3] = e->b3;
  for (int j = 0; j < e->strings; j++) {
    const auto &S = e->string[j];
    double *o = io + 4 + 7 * j;
    o[0] = S.f0; o[1] = S.L; o[2] = S.T; o[3] = S.mu; o[4] = S.EI; o[5] = S.B; o[6] = S.partials;
  }
}

// in: P. out: the number of modes, then up to max of them from the from-th as (string, partial,
// frequency, decay rate, coupling) rows
PHUZZ_EXPORT int sympathetic_modes(double *io, int from, int max) {
  auto e = std::make_unique<sympathetic::Engine>(48000);
  e->setParams(io);
  const int count = e->modes;
  for (int i = 0; i < std::min(max, count - from); i++) {
    double *o = io + 5 * i;
    const int m = from + i;
    o[0] = e->ofString[m]; o[1] = e->partial[m]; o[2] = e->freq[m]; o[3] = e->decay[m]; o[4] = e->coupling[m];
  }
  return count;
}
}
