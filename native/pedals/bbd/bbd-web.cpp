// bbd-web.cpp — the model functions the Bucket Brigade's page and tests call (through the scratch
// area, shared/wasm.js), from a parameter array.

#include <cmath>

#include "bbd-engine.h"
#include "bbd-model.h"
#include "bbd-params.h"
#include "phuzzbox/web.h"

extern "C" {
// in: P, then n frequencies (Hz). out (after them): the whole pedal's response |H| and its phase,
// then the chip's alone, with the clock at rest: four arrays of n.
PHUZZ_EXPORT void bbd_response(double *io, int n) {
  const bbd::Parts p = bbd::parts(io);
  const double *f = io + bbd::kParamCount;
  double *out = io + bbd::kParamCount + n;
  for (int i = 0; i < n; i++) {
    const std::complex<double> H = bbd::response(p, f[i]), C = bbd::chip(p, f[i], p.clock);
    out[i] = std::abs(H); out[n + i] = std::arg(H);
    out[2 * n + i] = std::abs(C); out[3 * n + i] = std::arg(C);
  }
}
// in: P. out (at io): the stages, the clock (Hz), the delay N/(2 fclk) (s), the taps, ε, the
// filters' corner (Hz), then the taps p_m: 6 + taps numbers
PHUZZ_EXPORT void bbd_parts(double *io) {
  const bbd::Parts p = bbd::parts(io);
  const double head[] = {(double)p.stages, p.clock, p.stages / (2 * p.clock), (double)p.taps, p.eps, p.corner};
  for (int k = 0; k < 6; k++) io[k] = head[k];
  for (int k = 0; k < p.taps; k++) io[6 + k] = p.p[k];
}
PHUZZ_EXPORT double bbd_ticks(phuzzbox::Effect *e) { return (double)static_cast<bbd::Engine *>(e)->ticks; }
}
