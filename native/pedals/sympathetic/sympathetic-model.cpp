// sympathetic-model.cpp — the Sympathetic Strings' strings and losses (sympathetic-model.h).

#include "sympathetic-model.h"

#include <algorithm>

namespace sympathetic {

String tune(double f, double d) {
  String s;
  const double A = PI * d * d / 4, c2 = STRESS / RHO;
  s.mu = RHO * A; s.T = STRESS * A; s.EI = E * PI * d * d * d * d / 64;
  // f = (c/2L)√(1 + β/L²), β = π²E d²/16σ: 4f²L⁴ − c²L² − c²β = 0
  const double beta = PI * PI * E * d * d / (16 * STRESS);
  s.L = std::sqrt((c2 + std::sqrt(c2 * c2 + 16 * f * f * c2 * beta)) / (8 * f * f));
  s.B = PI * PI * PI * E * d * d * d * d / (64 * s.T * s.L * s.L);
  s.f0 = s.partial(1);
  return s;
}

void losses(double sustain, double highs, double &b1, double &b3) {
  const double w1 = 2 * PI * F_LOW, w2 = 2 * PI * F_HIGH, ln = 3 * std::log(10.0);
  const double a1 = ln / sustain, a2 = ln / highs;
  b3 = std::max(0.0, (a2 - a1) / (w2 * w2 - w1 * w1));
  b1 = std::max(0.0, a1 - b3 * w1 * w1);
}

} // namespace sympathetic
