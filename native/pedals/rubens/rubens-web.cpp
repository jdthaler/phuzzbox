// rubens-web.cpp — the model functions Rubens' Tube's page and tests call (through the scratch area,
// shared/wasm.js), from a parameter array.

#include <cmath>

#include "rubens-engine.h"
#include "rubens-model.h"
#include "rubens-params.h"
#include "phuzzbox/web.h"

extern "C" {
// in: P. out (at io): the gas's sound speed (m/s), density (kg/m³), viscosity (Pa·s), Cp/Cv and
// Prandtl number; the pipe's cross-section (m²), its first cross mode (Hz), its modes' count, the
// microphone's place (m), the speaker's area (m²) and the engine's tail (s): 11 numbers
PHUZZ_EXPORT void rubens_parts(double *io) {
  const rubens::Parts p = rubens::parts(io);
  rubens::Engine e(48000);
  e.setParams(io);
  const double out[] = {p.g.c, p.g.rho, p.g.mu, p.g.gamma, p.g.prandtl, p.St, p.cutoff, (double)p.modes, p.xm, p.Sd, e.tail()};
  for (int k = 0; k < 11; k++) io[k] = out[k];
}
// in: P. out: for n = 1 … modes, its lossless frequency (Hz), Kirchhoff's α (1/m), its frequency
// with the walls' loss (Hz) and its decay rate σ (1/s): 4 × modes
PHUZZ_EXPORT void rubens_modes(double *io) {
  const rubens::Parts p = rubens::parts(io);
  for (int n = 1; n <= p.modes; n++) {
    double *o = io + 4 * (n - 1);
    o[0] = p.f0[n]; o[1] = p.alpha[n]; o[2] = p.omega[n] / (2 * rubens::kPi); o[3] = p.sigma[n];
  }
}
// in: P, then n frequencies (Hz). out (after them): at each, the pressure at the microphone (Pa) per
// volt of the amplifier and the cone's velocity (m/s) per volt, as (re, im) pairs, e^(−iωt): 4 × n.
// x < 0: at the microphone; otherwise at x (m)
PHUZZ_EXPORT void rubens_response(double *io, int n, double x) {
  const rubens::Parts p = rubens::parts(io);
  const double *f = io + rubens::kParamCount;
  double *out = io + rubens::kParamCount + n;
  for (int i = 0; i < n; i++) {
    const rubens::Response r = rubens::response(p, f[i], x < 0 ? p.xm : x);
    out[4 * i] = r.p.real(); out[4 * i + 1] = r.p.imag(); out[4 * i + 2] = r.v.real(); out[4 * i + 3] = r.v.imag();
  }
}
// in: P, then f (Hz), then the amplifier's volts at f, then m places along the pipe (m). out (after
// them): the pressure's amplitude at each (Pa)
PHUZZ_EXPORT void rubens_along(double *io, int m) {
  const rubens::Parts p = rubens::parts(io);
  const double f = io[rubens::kParamCount], volts = io[rubens::kParamCount + 1];
  const double *x = io + rubens::kParamCount + 2;
  double *out = io + rubens::kParamCount + 2 + m;
  for (int i = 0; i < m; i++) out[i] = volts * std::abs(rubens::response(p, f, x[i]).p);
}
}
