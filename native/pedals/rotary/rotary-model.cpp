// rotary-model.cpp — the Rotary Speaker's physics (rotary-model.h).

#include "rotary-model.h"

#include <algorithm>

namespace rotary {

// J1(x) = (1/2π) ∫₀^2π cos(τ − x sin τ) dτ: over a whole period, which the rectangle rule sums to
// machine precision with a few dozen points more than x
double j1(double x) {
  const int n = 64 + 2 * (int)std::ceil(std::abs(x));
  double s = 0;
  for (int i = 0; i < n; i++) {
    const double t = 2 * PI * i / n;
    s += std::cos(t - x * std::sin(t));
  }
  return s / n;
}

double piston(double f, double a, double s) {
  const double x = 2 * PI * f * a * s / C;
  return x < 1e-6 ? 1 : 2 * j1(x) / x;
}

// Each row: the semicircle of half-width a s fs / c samples, each tap its area over that sample
// (from −½ to ½ about it), the whole of unit area; at s = 0 a single tap.
void Pattern::design(double a_, double fs_) {
  if (a_ == a && fs_ == fs) return;
  a = a_; fs = fs_;
  half = halfTaps(fs); taps = 2 * half + 1;
  h.assign(NS * taps, 0.0);
  reach.assign(NS, 0);
  for (int i = 0; i < NS; i++) {
    const double w = a * ((double)i / (NS - 1)) * fs / C; // the half-width, in samples
    double *row = h.data() + i * taps;
    if (w < 1e-9) { row[half] = 1; continue; }
    // the area of the semicircle √(1 − (t/w)²) from −w to u
    const auto F = [w](double u) { const double v = std::clamp(u / w, -1.0, 1.0); return 0.5 * w * (std::asin(v) + v * std::sqrt(1 - v * v)); };
    const double total = 0.5 * PI * w;
    const int r = std::min(half, (int)std::ceil(w + 0.5));
    for (int m = -r; m <= r; m++) row[half + m] = (F(m + 0.5) - F(m - 0.5)) / total;
    reach[i] = r;
  }
}

Path retarded(double mx, double my, double r, double alpha, double w, double tau) {
  Path p{tau, alpha, 1, 0};
  for (int it = 0; it < 6; it++) {
    const double a = alpha - w * p.tau;
    const double ca = std::cos(a), sa = std::sin(a);
    const double dx = mx - r * ca, dy = my - r * sa;
    p.dist = std::hypot(dx, dy);
    p.tau = p.dist / C;
    p.alpha = a;
    p.cosTheta = (dx * ca + dy * sa) / p.dist;
  }
  return p;
}

} // namespace rotary
