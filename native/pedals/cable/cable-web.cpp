// cable-web.cpp — the model functions the Transatlantic Cable's page and tests call (through the
// scratch area, shared/wasm.js), from a parameter array.

#include <cmath>
#include <complex>

#include "cable-engine.h"
#include "cable-model.h"
#include "cable-params.h"
#include "phuzzbox/web.h"

using cable::kParamCount;

extern "C" {
// in: P, then n frequencies (Hz). out (after them): the far end's voltage over the source's, for
// the continuous line (size, then phase in rad), and for the ladder as solved (size).
PHUZZ_EXPORT void cable_response(double *io, int n) {
  const cable::Parts p = cable::parts(io);
  const double *f = io + kParamCount;
  double *out = io + kParamCount + n;
  for (int i = 0; i < n; i++) {
    const std::complex<double> h = cable::response(p, f[i]);
    out[i] = std::abs(h);
    out[n + i] = std::arg(h);
    out[2 * n + i] = std::abs(cable::ladderResponse(p, f[i]));
  }
}
// in: P, a step (s), then room for n. out (at the room): the far end's voltage, the repeater
// left out, after each step of a volt switched on at the near end at time 0 (the engine, run at
// that rate).
PHUZZ_EXPORT void cable_step(double *io, int n) {
  cable::Engine e(1 / io[kParamCount]);
  double P[kParamCount];
  for (int k = 0; k < kParamCount; k++) P[k] = io[k];
  P[cable::repeater] = 0;
  e.setParams(P);
  double *out = io + kParamCount + 1;
  const float one = 1;
  for (int i = 0; i < n; i++) {
    float l, r;
    e.process(&one, &l, &r, 1);
    out[i] = l;
  }
}
// in: P. out (at io): the cable's R (Ω/m), L (H/m), C (F/m), G (S/m) with any Heaviside loading;
// the length (m); the loading (0 none, 1 coils, 2 Heaviside); the coil (H); the source's and far
// end's resistances (Ω); the repeater as a factor; the sections; the delay (s), loss and Z₀ (Ω) of
// a Heaviside line; the coils' cutoff (Hz, 0 without them); and the sections to each coil: 16
// numbers.
PHUZZ_EXPORT void cable_parts(double *io) {
  const cable::Parts p = cable::parts(io);
  const double out[16] = {p.c.R, p.c.L, p.c.C, p.c.G, p.length, (double)p.loading, p.coil, p.source, p.load, p.gain,
                          (double)p.sections, p.delay, p.loss, p.z0, p.loading == cable::coils ? p.cutoff : 0, (double)p.per};
  for (int k = 0; k < 16; k++) io[k] = out[k];
}
}
