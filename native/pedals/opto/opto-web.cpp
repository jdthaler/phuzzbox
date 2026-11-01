// opto-web.cpp — the model functions the Opto Compressor's page and tests call (through the
// scratch area, shared/wasm.js): the quasi-static curve, and the engine's cell.

#include <cmath>

#include "phuzzbox/web.h"
#include "opto-engine.h"
#include "opto-model.h"
#include "opto-params.h"

extern "C" {
// in: P[kParamCount], then n input amplitudes (V, a sine's peak). out (after them): the gain
// reduction at each (dB, ≤ 0, against the pedal at rest), then the free electrons n at each: the
// quasi-static curve (opto-model.h).
PHUZZ_EXPORT void opto_static(double *io, int n) {
  const double *P = io, *A = io + opto::kParamCount;
  double *out = io + opto::kParamCount + n;
  const opto::Model M = opto::model(P);
  const double rest = opto::atten(M, 0);
  for (int i = 0; i < n; i++) {
    double nn;
    out[i] = 20 * std::log10(opto::quasiStatic(M, A[i], &nn) / rest);
    out[n + i] = nn;
  }
}
// the engine's cell now: out[0] the free electrons n, out[1] the trapped m, out[2] the light
PHUZZ_EXPORT void opto_cell(phuzzbox::Effect *e, double *out) {
  const auto *o = static_cast<opto::Engine *>(e);
  out[0] = o->n; out[1] = o->m; out[2] = o->light;
}
}
