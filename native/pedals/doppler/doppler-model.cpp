// doppler-model.cpp — the pass and its retarded times (doppler-model.h).

#include "doppler-model.h"

#include <algorithm>
#include <cmath>

namespace doppler {

double soundSpeed(double celsius) { return 331.3 * std::sqrt(1 + celsius / 273.15); }

int delays(const Pass &p, double s, double e, double D[2]) {
  const double X = (p.v - p.u) * s - e, a = p.c * p.c - p.v * p.v;
  const double S2 = p.c * p.c * X * X + a * p.d * p.d;
  if (a > 0) {
    D[0] = (X * X + p.d * p.d) / (X * p.v + std::sqrt(S2));
    return 1;
  }
  if (S2 < 0 || X * p.v <= 0) return 0;
  const double S = std::sqrt(S2);
  D[0] = (X * X + p.d * p.d) / (X * p.v + S);
  D[1] = (X * p.v + S) / -a;
  return 2;
}

bool cone(const Pass &p, double e, double &s, double &D) {
  const double b = p.v * p.v - p.c * p.c;
  if (b <= 0) return false;
  const double X = p.d * std::sqrt(b) / p.c;
  s = (X + e) / (p.v - p.u);
  D = X * p.v / b;
  return true;
}

double longest(const Pass &p) {
  const double H = std::fabs(p.v - p.u) * p.T / 2 + EAR;
  return std::hypot(H, p.d) / (p.c - std::fabs(p.u));
}

double envelope(const Pass &p, double tau) {
  const double r = std::min(p.T / 6, 1.0);
  if (tau <= 0 || tau >= p.T) return 0;
  const double x = std::min(tau, p.T - tau);
  return x >= r ? 1 : 0.5 - 0.5 * std::cos(PI * x / r);
}

} // namespace doppler
