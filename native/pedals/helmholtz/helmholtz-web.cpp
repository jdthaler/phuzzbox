// helmholtz-web.cpp — the model functions Helmholtz's Resonators' page and tests call (through the
// scratch area, shared/wasm.js), from a parameter array.

#include "helmholtz-engine.h"
#include "helmholtz-model.h"
#include "helmholtz-params.h"
#include "phuzzbox/web.h"

extern "C" {
// in: P. out (at io): the air's sound speed (m/s), density (kg/m³) and viscosity (Pa·s), the
// resonator at your ear (0 … 9) and the engine's tail (s); then for each of the ten its resonance (Hz),
// Q, the radiation's and the walls' shares of it, its opening's radius (m) and its neck's length (m):
// 5 + 6 × 10 numbers
PHUZZ_EXPORT void helmholtz_parts(double *io) {
  const helmholtz::Parts p = helmholtz::parts(io);
  helmholtz::Engine e(48000);
  e.setParams(io);
  io[0] = p.c; io[1] = p.rho; io[2] = p.mu; io[3] = p.one; io[4] = e.tail();
  for (int k = 0; k < helmholtz::kCount; k++) {
    const helmholtz::Resonator &r = p.res[k];
    double *o = io + 5 + 6 * k;
    o[0] = r.f0; o[1] = r.Q; o[2] = r.Qrad; o[3] = r.Qvisc; o[4] = r.r; o[5] = r.neck;
  }
}
// in: P, then n frequencies (Hz). out (after them): at each, the pressure inside resonator `which`
// (0 … 9; < 0 the one at your ear) for each pascal outside, (re, im), e^(−iωt): 2 × n
PHUZZ_EXPORT void helmholtz_response(double *io, int n, int which) {
  const helmholtz::Parts p = helmholtz::parts(io);
  const helmholtz::Resonator &r = p.res[which < 0 ? p.one : which];
  const double *f = io + helmholtz::kParamCount;
  double *out = io + helmholtz::kParamCount + n;
  for (int i = 0; i < n; i++) helmholtz::response(r, f[i], out[2 * i], out[2 * i + 1]);
}
}
