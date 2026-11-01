// blackhole-model.cpp — the Black Hole's modes, harmonics and amplitudes (blackhole-model.h). The
// table's interpolation is Forte's (forte/native/instruments/blackhole/blackhole-model.cpp), with the
// standard library's functions in place of V8's.

#include "blackhole-model.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstring>

#include "qnm-table.h"

namespace blackhole {

namespace {
struct Bank {
  double lim[table::NMODES][table::NU]; // log damping: about linear in u near extremal
  int8_t index[5][9][3];                // (l, m + 4, n) → mode, −1 for none
  Bank() {
    std::memset(index, -1, sizeof index);
    for (int i = 0; i < table::NMODES; i++) {
      const table::Mode &md = table::kModes[i];
      for (int j = 0; j < table::NU; j++) lim[i][j] = std::log(-md.im[j]);
      if (md.l >= 0 && md.l < 5 && md.m >= -4 && md.m <= 4 && md.n >= 0 && md.n < 3) index[md.l][md.m + 4][md.n] = (int8_t)i;
    }
  }
};
const Bank &bank() {
  static const Bank b;
  return b;
}
// dy/du at node j from the parabola through three neighbouring nodes
double slope(const double *U, const double *y, int j) {
  const int c = std::min(table::NU - 2, std::max(1, j));
  const double x0 = U[c - 1], x1 = U[c], x2 = U[c + 1], x = U[j];
  return y[c - 1] * ((2 * x - x1 - x2) / ((x0 - x1) * (x0 - x2)))
    + y[c] * ((2 * x - x0 - x2) / ((x1 - x0) * (x1 - x2)))
    + y[c + 1] * ((2 * x - x0 - x1) / ((x2 - x0) * (x2 - x1)));
}
double fact(int n) { double r = 1; for (int i = 2; i <= n; i++) r *= i; return r; }
double binom(int n, int k) { return k < 0 || k > n ? 0 : fact(n) / (fact(k) * fact(n - k)); }
} // namespace

bool omega(int l, int m, int n, double a, Omega &out) {
  if (l < 0 || l > 4 || m < -4 || m > 4 || n < 0 || n > 2) return false;
  const Bank &B = bank();
  const int k = B.index[l][m + 4][n];
  if (k < 0) return false;
  const double *U = table::kU;
  const int last = table::NU - 1;
  const double u = std::min(U[last], std::max(0.0, -std::log10(1 - a)));
  int i = 0;
  while (i < last - 1 && U[i + 1] < u) i++;
  const double h1 = U[i + 1] - U[i], t = (u - U[i]) / h1;
  const auto cr = [&](const double *y) {
    const double m1 = slope(U, y, i) * h1, m2 = slope(U, y, i + 1) * h1;
    const double t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y[i] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * y[i + 1] + (t3 - t2) * m2;
  };
  out.re = cr(table::kModes[k].re);
  out.im = -std::exp(cr(B.lim[k]));
  return true;
}

// Goldberg's formula for ₛY_lm(θ, 0), s = −2
double swsh(int l, int m, double theta) {
  const int s = -2;
  if (std::abs(m) > l) return 0;
  const double pre = ((m % 2) ? -1.0 : 1.0) * std::sqrt((fact(l + m) * fact(l - m) * (2 * l + 1)) / (4 * PI * fact(l + s) * fact(l - s)));
  const double sh = std::sin(theta / 2), ch = std::cos(theta / 2);
  double sum = 0;
  for (int r = 0; r <= l - s; r++) {
    const double c = binom(l - s, r) * binom(l + s, r + s - m);
    if (!c) continue;
    const int pc = 2 * r + s - m, ps = 2 * l - pc; // cos(θ/2)^pc sin(θ/2)^ps
    sum += (((l - r - s) % 2) ? -1.0 : 1.0) * c * std::pow(ch, pc) * std::pow(sh, ps);
  }
  return pre * sum;
}

// Gossan, Veitch & Sathyaprakash's Eqs. 5–8 (Kamaretsos et al.'s fits), relative to A₂₂ = 0.864ν
Amplitudes amplitudes(double q) {
  const double nu = q / ((1 + q) * (1 + q)), d = std::max(0.0, 1 - 4 * nu);
  return { 0.52 * std::pow(d, 0.71), 0.44 * std::pow(d, 0.45), 5.4 * (nu - 0.22) * (nu - 0.22) + 0.04 };
}

} // namespace blackhole
