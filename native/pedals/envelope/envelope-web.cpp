// envelope-web.cpp — the model functions the Envelope Filter's page and tests call (through the
// scratch area, shared/wasm.js): the filter's response at a cutoff, the steady cutoff for a
// follower's voltage, and the engine's state.

#include <cmath>
#include <complex>

#include "phuzzbox/web.h"
#include "envelope-engine.h"
#include "envelope-model.h"
#include "envelope-params.h"

extern "C" {
// in: P[kParamCount], the cutoff fc (Hz), then n frequencies. out (after them): |H| and its phase,
// as two arrays of n: the analog filter's mode output, with the blend and level
PHUZZ_EXPORT void envelope_response(double *io, int n) {
  const double *P = io, fc = io[envelope::kParamCount], *f = io + envelope::kParamCount + 1;
  double *out = io + envelope::kParamCount + 1 + n;
  const envelope::Model M = envelope::model(P);
  for (int i = 0; i < n; i++) {
    const std::complex<double> h = M.level * ((1 - M.blend) * envelope::filterResponse(M, fc, f[i]) + M.blend);
    out[i] = std::abs(h);
    out[n + i] = std::arg(h);
  }
}
// in: P, then n follower voltages (V). out (after them): the cutoff the cells settle to for each
// held steady (Hz), then the LED's light (units of 1 mA's), then the cells' n
PHUZZ_EXPORT void envelope_static(double *io, int n) {
  const double *v = io + envelope::kParamCount;
  double *out = io + envelope::kParamCount + n;
  const envelope::Model M = envelope::model(io);
  for (int i = 0; i < n; i++) {
    const double L = envelope::light(M, v[i]), nn = envelope::steadyN(L);
    out[i] = envelope::cutoff(M, nn);
    out[n + i] = L;
    out[2 * n + i] = nn;
  }
}
// the engine's state: the follower, n, m, and the integrators' states
PHUZZ_EXPORT void envelope_state(phuzzbox::Effect *e, double *out) {
  const auto *g = static_cast<envelope::Engine *>(e);
  out[0] = g->env; out[1] = g->n; out[2] = g->m; out[3] = g->s1; out[4] = g->s2;
}
}
