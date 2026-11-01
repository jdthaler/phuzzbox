// rotary-web.cpp — the model functions the Rotary Speaker's page and tests call (through the scratch
// area, shared/wasm.js): the rotors' patterns, as designed and as the closed form, and the path from
// a rotor to a microphone.

#include <cmath>

#include "phuzzbox/web.h"
#include "rotary-engine.h"
#include "rotary-params.h"

extern "C" {
// in: P, then which (0 the horn, 1 the drum), sin θ, then n frequencies (Hz). out: arrays of n, the
// pattern's FIR at that sin θ (48 kHz, interpolated as the engine does), and the piston's closed form
PHUZZ_EXPORT void rotary_pattern(double *io, int n) {
  const double *P = io;
  const int which = (int)io[rotary::kParamCount];
  const double s = io[rotary::kParamCount + 1], *f = io + rotary::kParamCount + 2;
  double *out = io + rotary::kParamCount + 2 + n;
  const double a = which ? P[rotary::drumA] : P[rotary::hornA];
  rotary::Pattern pat;
  pat.design(a, 48000);
  const double u = s * (rotary::NS - 1);
  const int k = std::min(rotary::NS - 2, (int)u);
  const double fr = u - k;
  for (int i = 0; i < n; i++) {
    double re = 0, im = 0;
    for (int t = 0; t < pat.taps; t++) {
      const double h = (1 - fr) * pat.row(k)[t] + fr * pat.row(k + 1)[t], ph = 2 * rotary::PI * f[i] * (t - pat.half) / 48000;
      re += h * std::cos(ph); im -= h * std::sin(ph);
    }
    out[i] = std::hypot(re, im);
    out[n + i] = rotary::piston(f[i], a, s);
  }
}

// in: mic x, y, rotor radius, its angle now, its rate (rad/s). out: the delay, the angle it had
// when it sent what is heard now, cos θ then, and the distance then
PHUZZ_EXPORT void rotary_path(double *io) {
  const rotary::Path p = rotary::retarded(io[0], io[1], io[2], io[3], io[4], std::hypot(io[0], io[1]) / rotary::C);
  io[0] = p.tau; io[1] = p.alpha; io[2] = p.cosTheta; io[3] = p.dist;
}
}
