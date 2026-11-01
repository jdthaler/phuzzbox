// echo-web.cpp — the model functions the Tape Echo's page and tests call (through the scratch area,
// shared/wasm.js): the heads' response, as designed and as the closed form, and the tape's curve.

#include <cmath>
#include <memory>

#include "phuzzbox/web.h"
#include "echo-engine.h"
#include "echo-params.h"

extern "C" {
// in: P, then n frequencies (Hz). out: arrays of n, the heads' FIR's magnitude at P's tape speed
// (48 kHz), and the losses' closed form
PHUZZ_EXPORT void echo_response(double *io, int n) {
  auto e = std::make_unique<echo::Engine>(48000);
  e->setParams(io);
  const echo::Model M = echo::model(io);
  const double *f = io + echo::kParamCount;
  double *out = io + echo::kParamCount + n;
  for (int i = 0; i < n; i++) {
    double re = 0, im = 0;
    for (int k = 0; k < echo::TAPS; k++) { const double ph = 2 * echo::PI * f[i] * k / 48000; re += e->fir[k] * std::cos(ph); im -= e->fir[k] * std::sin(ph); }
    out[i] = std::hypot(re, im);
    out[n + i] = echo::losses(f[i], M.speed, M.spacing, M.gap);
  }
}

// in: P, then the largest input x (V). out: n points of what the tape keeps, m(x), from −x to x
PHUZZ_EXPORT void echo_curve(double *io, int n) {
  const echo::Model M = echo::model(io);
  const double X = io[echo::kParamCount];
  double *out = io + echo::kParamCount + 1;
  for (int i = 0; i < n; i++) out[i] = echo::tape(-X + 2 * X * i / (n - 1), M.g);
}
}
