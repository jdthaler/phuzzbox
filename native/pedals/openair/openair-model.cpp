// openair-model.cpp — Open Air's air, ground and paths (openair-model.h).

#include "openair-model.h"

#include <algorithm>
#include <cmath>

#include "openair-params.h"

namespace openair {

namespace {
constexpr double kPi = 3.14159265358979323846;
const double kSqrtPi = std::sqrt(kPi);
// fresh snow, forest floor, grass, a dirt road (Piercy and Embleton: dry new snow 15–30, forest floor
// 20–80, grass 150–300, old dirt road 2000–4000 kPa·s/m²), and asphalt, over 20 000: rigid
constexpr double kResistivity[kGrounds] = {21.2, 40.0, 212.1, 2828.4, 0};
} // namespace

double resistivity(int g) { return kResistivity[std::clamp(g, 0, kGrounds - 1)]; }

double Parts::r1() const { return std::hypot(d, hs - hr); }
double Parts::r2() const { return std::hypot(d, hs + hr); }

Parts parts(const double *P) {
  Parts p{};
  p.d = P[distance];
  p.hs = P[source];
  p.hr = P[listener];
  p.T = P[temperature] + 273.15;
  p.rh = P[humidity];
  p.sigma = resistivity((int)std::lround(P[ground]));
  p.level = std::pow(10.0, P[level] / 20);
  return p;
}

double speed(double T) { return 343.2 * std::sqrt(T / 293.15); }

Air::Air(double T, double rh, double pa) {
  constexpr double T0 = 293.15, T01 = 273.16, pr = 101.325;
  const double prel = pa / pr, tr = T / T0;
  const double psat = std::pow(10.0, -6.8346 * std::pow(T01 / T, 1.261) + 4.6151); // psat/pr
  const double h = rh * psat / prel;                                                // molar %
  frO = prel * (24 + 4.04e4 * h * (0.02 + h) / (0.391 + h));
  frN = prel / std::sqrt(tr) * (9 + 280 * h * std::exp(-4.170 * (std::pow(tr, -1.0 / 3) - 1)));
  classical = 8.686 * 1.84e-11 / prel * std::sqrt(tr);
  oxygen = 8.686 * std::pow(tr, -2.5) * 0.01275 * std::exp(-2239.1 / T);
  nitrogen = 8.686 * std::pow(tr, -2.5) * 0.1068 * std::exp(-3352.0 / T);
}

double Air::at(double f) const {
  const double f2 = f * f;
  return f2 * (classical + oxygen / (frO + f2 / frO) + nitrogen / (frN + f2 / frN));
}

double absorption(double f, double T, double rh, double pa) { return Air(T, rh, pa).at(f); }

cplx impedance(double f, double sigma) {
  const double x = f / sigma;
  return {1 + 9.08 * std::pow(x, -0.75), 11.9 * std::pow(x, -0.73)};
}

namespace {
// w(z) for Im z ≥ 0: Weideman's rational approximation (1994) with N = 32 terms for |z| < 15, good to
// a few parts in 10^13 there; Laplace's continued fraction beyond, which converges fast out there
constexpr int kTerms = 32;
struct Weideman {
  double L, a[kTerms];
  Weideman() {
    const int M = 2 * kTerms, M2 = 2 * M;
    L = std::sqrt(kTerms / std::sqrt(2.0));
    double f[2 * M];
    for (int j = 0; j < M2; j++) { // f(t) = e^(−t²)(L² + t²) at t = L tan(θ/2), θ = kπ/M, fftshifted
      const int k = j < M ? j : j - M2;
      const double t = L * std::tan(k * kPi / M / 2);
      f[j] = k == -M ? 0 : std::exp(-t * t) * (L * L + t * t);
    }
    for (int n = 1; n <= kTerms; n++) { // its cosine series, highest power first
      double s = 0;
      for (int j = 0; j < M2; j++) s += f[j] * std::cos(2 * kPi * n * j / M2);
      a[kTerms - n] = s / M2;
    }
  }
};
cplx continued(cplx z) {
  const int n = (int)std::ceil(12 + 2400 / std::norm(z));
  cplx K = 0;
  for (int k = n; k >= 1; k--) K = (0.5 * k) / (z - K);
  return cplx(0, 1 / kSqrtPi) / (z - K);
}
cplx upper(cplx z) {
  if (std::norm(z) >= 225) return continued(z);
  static const Weideman W;
  const cplx iz(-z.imag(), z.real()), den = W.L - iz, Z = (W.L + iz) / den;
  cplx p = 0;
  for (double c : W.a) p = p * Z + c;
  return 2.0 * p / (den * den) + (1 / kSqrtPi) / den;
}
} // namespace

cplx faddeeva(cplx z) {
  if (z.imag() >= 0) return upper(z);
  return 2.0 * std::exp(-z * z) - upper(-z); // w(−z) = 2e^(−z²) − w(z)
}

cplx reflection(double f, const Parts &p) {
  if (p.sigma <= 0 || f <= 0) return 1; // rigid ground, or no frequency at all: a perfect mirror
  const double k = 2 * kPi * f / speed(p.T), r2 = p.r2(), ct = p.cosTheta();
  const cplx Z = impedance(f, p.sigma);
  const cplx Rp = (Z * ct - 1.0) / (Z * ct + 1.0);
  const cplx w = std::sqrt(cplx(0, 0.5 * k * r2)) * (1.0 / Z + ct);
  const cplx F = 1.0 + cplx(0, kSqrtPi) * w * faddeeva(w);
  return Rp + (1.0 - Rp) * F;
}

cplx response(double f, const Parts &p) {
  const double r1 = p.r1(), r2 = p.r2();
  if (f <= 0) return 1 + r1 / r2;
  const double a = absorption(f, p.T, p.rh), k = 2 * kPi * f / speed(p.T);
  const double g1 = std::pow(10.0, -a * r1 / 20), g2 = (r1 / r2) * std::pow(10.0, -a * r2 / 20);
  // in e^(−iωt) the reflection arrives as Q e^(ik(r2 − r1)); heard in e^(+iωt), the conjugate
  return std::conj(cplx(g1) + g2 * reflection(f, p) * std::exp(cplx(0, k * (r2 - r1))));
}

void fft(cplx *x, int n, bool inverse) {
  for (int i = 1, j = 0; i < n; i++) {
    int bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) std::swap(x[i], x[j]);
  }
  for (int len = 2; len <= n; len <<= 1) {
    const double ang = (inverse ? 2 : -2) * kPi / len;
    const cplx wl(std::cos(ang), std::sin(ang));
    for (int i = 0; i < n; i += len) {
      cplx w = 1;
      for (int j = 0; j < len / 2; j++) {
        const cplx u = x[i + j], v = x[i + j + len / 2] * w;
        x[i + j] = u + v;
        x[i + j + len / 2] = u - v;
        w *= wl;
      }
    }
  }
}

void design(const Parts &p, double fs, int n, double *h, cplx *X) {
  const int m = 2 * n;
  cplx *grid = X + m;
  const double f0 = fs / m, step = std::log(0.5 * m) / (kGrid - 1); // the grid: from fs/m to fs/2
  for (int j = 0; j < kGrid; j++) grid[j] = reflection(f0 * std::exp(j * step), p);
  const Air air(p.T, p.rh);
  const double r1 = p.r1(), r2 = p.r2(), dk = 2 * kPi / speed(p.T) * (r2 - r1), ln = std::log(10.0) / 20;
  // log |H| at the m frequencies
  X[0] = std::log(1 + r1 / r2);
  for (int k = 1; k <= m / 2; k++) {
    const double f = fs * k / m, u = std::min(std::log((double)k) / step, kGrid - 1.0);
    const int j = std::min((int)u, kGrid - 2);
    const cplx Q = grid[j] + (u - j) * (grid[j + 1] - grid[j]);
    const double a = air.at(f), g1 = std::exp(-ln * a * r1), g2 = (r1 / r2) * std::exp(-ln * a * r2);
    X[k] = std::log(std::max(std::abs(g1 + g2 * Q * std::polar(1.0, dk * f)), 1e-9));
    if (k < m / 2) X[m - k] = X[k];
  }
  // the cepstrum, folded onto positive times, is the log of the minimum-phase spectrum
  fft(X, m, true);
  for (int i = 1; i < m / 2; i++) X[i] = 2.0 * X[i].real() / double(m);
  X[0] = X[0].real() / double(m);
  X[m / 2] = X[m / 2].real() / double(m);
  for (int i = m / 2 + 1; i < m; i++) X[i] = 0;
  fft(X, m, false);
  for (int k = 0; k < m; k++) X[k] = std::exp(X[k]);
  fft(X, m, true);
  const int down = n / 4;
  for (int i = 0; i < n; i++) {
    const double w = i < n - down ? 1 : 0.5 + 0.5 * std::cos(kPi * (i - (n - down) + 0.5) / down);
    h[i] = w * X[i].real() / m;
  }
}

} // namespace openair
