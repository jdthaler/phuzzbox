// openair-web.cpp — the model functions Open Air's page and tests call (through the scratch area,
// shared/wasm.js), from a parameter array.

#include <cmath>
#include <vector>

#include "openair-engine.h"
#include "openair-model.h"
#include "openair-params.h"
#include "phuzzbox/web.h"

extern "C" {
// in: P. out (at io): the direct path r1 and the reflected r2 (m), cos θ of the reflection, the speed
// of sound (m/s), the ground's flow resistivity (kPa·s/m², 0 for rigid), the reflection's lag (s):
// 6 numbers
PHUZZ_EXPORT void openair_parts(double *io) {
  const openair::Parts p = openair::parts(io);
  const double c = openair::speed(p.T);
  const double out[] = {p.r1(), p.r2(), p.cosTheta(), c, p.sigma, (p.r2() - p.r1()) / c};
  for (int k = 0; k < 6; k++) io[k] = out[k];
}
// in: P, then n frequencies (Hz). out (after them): the air's absorption at each (dB/m).
PHUZZ_EXPORT void openair_absorption(double *io, int n) {
  const openair::Parts p = openair::parts(io);
  const double *f = io + openair::kParamCount;
  double *out = io + openair::kParamCount + n;
  for (int i = 0; i < n; i++) out[i] = openair::absorption(f[i], p.T, p.rh);
}
// in: P, then n frequencies (Hz). out (after them): what, at each, n pairs (re, im): 0 the response
// as heard H (e^(+iωt)), 1 the ground's reflection Q, 2 its impedance Z/ρc (e^(−iωt))
PHUZZ_EXPORT void openair_spectrum(double *io, int n, int what) {
  const openair::Parts p = openair::parts(io);
  const double *f = io + openair::kParamCount;
  double *out = io + openair::kParamCount + n;
  for (int i = 0; i < n; i++) {
    const openair::cplx v = what == 0 ? openair::response(f[i], p) : what == 1 ? openair::reflection(f[i], p) : openair::impedance(f[i], p.sigma);
    out[2 * i] = v.real();
    out[2 * i + 1] = v.imag();
  }
}
// in: n complex numbers z as pairs (re, im). out (in place): w(z) = e^(−z²) erfc(−iz)
PHUZZ_EXPORT void openair_faddeeva(double *io, int n) {
  for (int i = 0; i < n; i++) {
    const openair::cplx w = openair::faddeeva({io[2 * i], io[2 * i + 1]});
    io[2 * i] = w.real();
    io[2 * i + 1] = w.imag();
  }
}
// in: P. out (after it): the filter for the rate fs with n taps
PHUZZ_EXPORT void openair_design(double *io, double fs, int n) {
  const openair::Parts p = openair::parts(io);
  std::vector<openair::cplx> scratch(openair::designScratch(n));
  openair::design(p, fs, n, io + openair::kParamCount, scratch.data());
}
// how many filters the engine has designed, for the tests
PHUZZ_EXPORT int openair_designs(phuzzbox::Effect *e) { return static_cast<openair::Engine *>(e)->designs(); }
}
