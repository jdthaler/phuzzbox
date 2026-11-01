// opto-model.cpp — the Opto Compressor's physics (opto-model.h).

#include "opto-model.h"

#include "opto-params.h"

namespace opto {

Model model(const double *P) {
  Model M;
  M.kpr = audioTaper(P[peak]);
  M.b = P[panelB];
  M.tp = P[afterglow];
  M.swing = P[swing];
  M.litR = P[litR];
  M.darkR = P[darkR];
  M.tau = P[lifetime];
  M.tauE = P[trapTime];
  M.feedForward = P[sense] > 0.5;
  return M;
}

namespace {
// the panel's light, averaged over a cycle of a sine of amplitude v at the driver's input
double meanLight(const Model &M, double v) {
  constexpr int K = 512;
  double s = 0;
  for (int k = 0; k < K; k++) s += emission(M, drive(M, v * std::sin(3.141592653589793 * (k + 0.5) / K)));
  return s / K; // a half cycle is the whole story: the panel glows alike on either polarity
}
} // namespace

double quasiStatic(const Model &M, double A, double *nOut) {
  double n;
  if (M.feedForward) n = steadyN(meanLight(M, A));
  else {
    // the light the attenuated signal makes falls as n rises; n(1 + n/n₁) rises: one crossing
    double lo = 0, hi = steadyN(emission(M, M.swing)) + 1;
    for (int k = 0; k < 80; k++) {
      const double mid = 0.5 * (lo + hi);
      if (meanLight(M, atten(M, mid) * A) > mid * (1 + mid / N1)) lo = mid; else hi = mid;
    }
    n = 0.5 * (lo + hi);
  }
  if (nOut) *nOut = n;
  return atten(M, n);
}

} // namespace opto
