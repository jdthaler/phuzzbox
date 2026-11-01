// echo-model.cpp — the Tape Echo's physics (echo-model.h).

#include "echo-model.h"

#include <algorithm>

#include "echo-params.h"

namespace echo {

Model model(const double *P) {
  Model M;
  M.speed = P[speed];
  static const int masks[7] = {1, 2, 4, 3, 6, 5, 7}; // the choices' heads, as bits
  const int m = masks[std::max(0, std::min(6, (int)std::lround(P[heads])))];
  for (int j = 0; j < 3; j++) M.head[j] = (m >> j) & 1;
  M.repeats = P[repeats];
  M.g = std::pow(10.0, P[record] / 20);
  M.spacing = P[spacing]; M.gap = P[gap]; M.ecc = P[flutter];
  M.dry = P[dry]; M.wet = P[wet];
  M.level = std::pow(10.0, P[level] / 20);
  return M;
}

double losses(double f, double v, double d, double gap) {
  const double k = 2 * PI * f / v;
  const double space = std::exp(-k * d);
  const double kt = k * COATING, thick = kt < 1e-9 ? 1 : (1 - std::exp(-kt)) / kt;
  const double kg = k * gap / 2, gp = kg < 1e-9 ? 1 : std::sin(kg) / kg;
  return space * thick * gp;
}

void design(double *h, double v, double d, double gap, double fs) {
  // h[n] = (2/fs) ∫₀^{fs/2} H(f) cos(2πf(n − HALF)/fs) df by the trapezoidal rule, Blackman-windowed. The
  // losses' kernels have long tails (the spacing loss's is a Cauchy curve), so the FIR is long.
  constexpr int K = 512;
  static const struct Cos { double c[2 * K]; Cos() { for (int i = 0; i < 2 * K; i++) c[i] = std::cos(PI * i / K); } } table; // cos(πj/K)
  double H[K + 1];
  for (int i = 0; i <= K; i++) H[i] = losses(0.5 * fs * i / K, v, d, gap);
  for (int n = 0; n < TAPS; n++) {
    const int m = n - HALF, am = m < 0 ? -m : m;
    double a = 0.5 * (H[0] + H[K] * (am % 2 ? -1 : 1));
    for (int i = 1, j = am; i < K; i++, j = (j + am) % (2 * K)) a += H[i] * table.c[j];
    const double w = 0.42 - 0.5 * std::cos(2 * PI * (n + 0.5) / TAPS) + 0.08 * std::cos(4 * PI * (n + 0.5) / TAPS);
    h[n] = a / K * w;
  }
}

} // namespace echo
