// doppler-web.cpp — the model functions the Doppler's page and tests call (through the scratch area,
// shared/wasm.js): the speed of sound, the retarded delays, and what one pass sounds like.

#include <cmath>

#include "phuzzbox/web.h"
#include "doppler-engine.h"
#include "doppler-params.h"

extern "C" {
// in: °C. out: the speed of sound (m/s)
PHUZZ_EXPORT double doppler_sound(double celsius) { return doppler::soundSpeed(celsius); }

// in: v, u, d, c, T, s, e. out: how many roots, D₀, D₁ (s)
PHUZZ_EXPORT void doppler_delays(double *io) {
  doppler::Pass p;
  p.v = io[0]; p.u = io[1]; p.d = io[2]; p.c = io[3]; p.T = io[4];
  double D[2] = {0, 0};
  const int k = doppler::delays(p, io[5], io[6], D);
  io[0] = k; io[1] = D[0]; io[2] = D[1];
}

// in: P, then m. out: the pass the controls make (v, u, d, c, T), then for m times s from −T/2 to T/2
// heard at the middle of the head, arrays of m: s, then for each of two branches the pitch heard
// over the pitch sent (dτ/dt; negative: heard backwards) and the level (d / R · |dτ/dt|), both 0
// where the branch is not heard (no root, or sent from beyond the pass's stretch of road)
PHUZZ_EXPORT void doppler_pass(double *io) {
  doppler::Engine e(8000);
  e.setParams(io);
  const doppler::Pass p = e.next();
  const int m = (int)io[doppler::kParamCount];
  io[0] = p.v; io[1] = p.u; io[2] = p.d; io[3] = p.c; io[4] = p.T;
  double *S = io + 5, *r0 = S + m, *g0 = r0 + m, *r1 = g0 + m, *g1 = r1 + m;
  const double a = p.c * p.c - p.v * p.v;
  for (int i = 0; i < m; i++) {
    const double s = -p.T / 2 + p.T * i / (m - 1);
    double D[2] = {0, 0};
    const int k = doppler::delays(p, s, 0, D);
    S[i] = s; r0[i] = g0[i] = r1[i] = g1[i] = 0;
    for (int b = 0; b < k; b++) {
      const double tau = s - D[b];
      if (tau < -p.T / 2 || tau > p.T / 2) continue;
      const double X = (p.v - p.u) * s, Y = X - p.v * D[b];
      const double dD = Y * (p.v - p.u) / (a * D[b] + p.v * X), r = 1 - dD;
      (b ? r1 : r0)[i] = r;
      (b ? g1 : g0)[i] = p.d / (p.c * D[b]) * std::fabs(r);
    }
  }
}
}
