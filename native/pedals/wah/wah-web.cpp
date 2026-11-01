// wah-web.cpp — the model functions the Wah's page and tests call (through the scratch area,
// shared/wasm.js): the small-signal response at the operating point, and the operating point.

#include <complex>

#include "phuzzbox/web.h"
#include "wah-model.h"
#include "wah-params.h"

namespace {
phuzzbox::dk::Circuit make(const double *P) {
  wah::Parts parts;
  phuzzbox::dk::Circuit c(wah::netlist(P, parts), 48000);
  const double u[2] = {0, P[wah::vcc]};
  c.operatingPoint(u);
  return c;
}
} // namespace

extern "C" {
// in: P[kParamCount], then n frequencies (Hz). out (after them): |H| at each, then its phase in
// radians, as two arrays of n: the output over the input for a small signal at the operating point.
PHUZZ_EXPORT void wah_response(double *io, int n) {
  const double *P = io, *f = io + wah::kParamCount;
  double *out = io + wah::kParamCount + n;
  const phuzzbox::dk::Circuit c = make(P);
  for (int i = 0; i < n; i++) {
    std::complex<double> h;
    c.response(f[i], &h);
    out[i] = std::abs(h);
    out[n + i] = std::arg(h);
  }
}
// in: P. out (at io): the 13 nodes' DC voltages (node 1 first), in volts.
PHUZZ_EXPORT void wah_operating_point(double *io) {
  const phuzzbox::dk::Circuit c = make(io);
  for (int k = 1; k <= 13; k++) io[k - 1] = c.dcNodes()[k];
}
}
