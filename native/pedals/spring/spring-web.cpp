// spring-web.cpp — the model functions the Spring Reverb's page and tests call (through the scratch
// area, shared/wasm.js): the tank's springs, its modes, the arrival times of its echoes, and what
// the pickup hears after a click.

#include <cmath>
#include <memory>
#include <vector>

#include "phuzzbox/web.h"
#include "spring-engine.h"
#include "spring-params.h"

using spring::Engine;
using spring::kParamCount;

namespace {
std::unique_ptr<Engine> tankFor(const double *P) {
  auto e = std::make_unique<Engine>(48000);
  e->setParams(P);
  return e;
}
} // namespace

extern "C" {
// in: P. out: the number of springs, then for each of three: L (m), R (m), r (m), T_D (s), F_C (Hz),
// c₀ (m/s), the bead's corner f_b (Hz), and its modes in the bank; then the bank's size
PHUZZ_EXPORT void spring_info(double *io) {
  auto e = tankFor(io);
  double *out = io + kParamCount;
  out[0] = e->count;
  for (int s = 0; s < spring::MAX_SPRINGS; s++) {
    const spring::Spring &sp = e->springs[s];
    double *o = out + 1 + 8 * s;
    int n = 0;
    for (int m = 0; m < e->modes; m++) n += e->spr[m] == s;
    const bool on = s < e->count;
    o[0] = on ? sp.L : 0; o[1] = on ? sp.R : 0; o[2] = on ? sp.r : 0; o[3] = on ? sp.TD : 0;
    o[4] = on ? sp.Fc : 0; o[5] = on ? sp.c0 : 0; o[6] = on ? sp.fb : 0; o[7] = n;
  }
  out[1 + 8 * spring::MAX_SPRINGS] = e->modes;
}

// in: P, then a first mode index m0. out: the bank's size, then for up to n modes from m0, arrays
// of n: spring, n, f (Hz), c_g (m/s), weight (1/s), σ (1/s)
PHUZZ_EXPORT void spring_modes(double *io, int n) {
  auto e = tankFor(io);
  const int m0 = (int)io[kParamCount];
  double *out = io + kParamCount + 1;
  out[0] = e->modes;
  for (int i = 0; i < n; i++) {
    const int m = m0 + i;
    const bool on = m < e->modes;
    out[1 + i] = on ? e->spr[m] : -1; out[1 + n + i] = on ? e->num[m] : 0; out[1 + 2 * n + i] = on ? e->freq[m] : 0;
    out[1 + 3 * n + i] = on ? e->vel[m] : 0; out[1 + 4 * n + i] = on ? e->weight[m] : 0; out[1 + 5 * n + i] = on ? e->decay[m] : 0;
  }
}

// in: P, then a spring s and n frequencies (Hz). out: arrays of n, the time (s) a component takes
// to cross spring s once, L/c_g, on the slow branch below F_C (0 above it) and on the bending
// branch above k = ε
PHUZZ_EXPORT void spring_delays(double *io, int n) {
  auto e = tankFor(io);
  const spring::Spring &sp = e->springs[(int)io[kParamCount]];
  const double *f = io + kParamCount + 1;
  double *out = io + kParamCount + 1 + n;
  for (int i = 0; i < n; i++) {
    const double w = 2 * spring::PI * f[i];
    double lo = 0;
    if (f[i] < sp.Fc) { // on (0, k_c), where ω rises
      double a = 0, b = sp.kc;
      for (int j = 0; j < 100; j++) { const double c = (a + b) / 2; (sp.omega(c) < w ? a : b) = c; }
      lo = sp.L / sp.cg((a + b) / 2);
    }
    double a = sp.eps, b = 4 * sp.eps; // up the bending branch
    while (sp.omega(b) < w) b *= 2;
    for (int j = 0; j < 100; j++) { const double c = (a + b) / 2; (sp.omega(c) < w ? a : b) = c; }
    out[i] = lo;
    out[n + i] = sp.L / sp.cg((a + b) / 2);
  }
}

// in: P. The tank hears a click (one sample of 1 V) and the pickup's output is analysed in frames
// of `hop` samples at 48 kHz: out, frames × bins, the level (dB) at `bins` frequencies spaced
// logarithmically from 100 Hz to 8 kHz, through a Hann window of 1024 samples centred on each
// frame
PHUZZ_EXPORT void spring_echoes(double *io, int frames, int bins, int hop) {
  auto e = tankFor(io);
  const int N = 1024, len = frames * hop + N;
  std::vector<float> x(len, 0.f), y(len, 0.f);
  x[N / 2] = 1;
  e->tank(x.data(), y.data(), len);
  double *out = io + kParamCount;
  std::vector<double> win(N), cs(N), sn(N);
  for (int i = 0; i < N; i++) win[i] = 0.5 - 0.5 * std::cos(2 * spring::PI * (i + 0.5) / N);
  for (int b = 0; b < bins; b++) {
    const double f = 100 * std::pow(80.0, b / (bins - 1.0)), w = 2 * spring::PI * f / 48000;
    for (int i = 0; i < N; i++) { cs[i] = win[i] * std::cos(w * i); sn[i] = win[i] * std::sin(w * i); }
    for (int t = 0; t < frames; t++) {
      double re = 0, im = 0;
      const float *Y = y.data() + t * hop; // frame t centred on t·hop after the click
      for (int i = 0; i < N; i++) { re += cs[i] * Y[i]; im += sn[i] * Y[i]; }
      out[t * bins + b] = 10 * std::log10(re * re + im * im + 1e-30);
    }
  }
}

// in: P, then the tank's input x (n samples). out: the pickup's output (n samples), the tank alone
PHUZZ_EXPORT void spring_run(double *io, int n) {
  auto e = tankFor(io);
  std::vector<float> x(n), y(n);
  for (int i = 0; i < n; i++) x[i] = (float)io[kParamCount + i];
  e->tank(x.data(), y.data(), n);
  for (int i = 0; i < n; i++) io[kParamCount + n + i] = y[i];
}
}
