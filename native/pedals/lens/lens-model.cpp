// lens-model.cpp — the Gravitational Lens's physics (lens-model.h).

#include "lens-model.h"

#include <algorithm>
#include <array>
#include <cmath>

#include "lens-params.h"
#include "phuzzbox/dsp.h"

namespace lens {

namespace {

constexpr double kPi = 3.14159265358979323846;
#ifndef LENS_GAUSS
#define LENS_GAUSS 24
#endif
constexpr int kGauss = LENS_GAUSS;

// Gauss–Legendre nodes and weights on [−1, 1], by Newton's method on the Legendre polynomial
struct Gauss {
  std::array<double, kGauss> x{}, w{};
  std::array<double, kGauss> u{}, v{}; // at each node, (1 − cos φ)/2 and its weight · (π/2) sin φ / 2
  Gauss() {
    for (int i = 0; i < kGauss; i++) {
      double z = std::cos(kPi * (i + 0.75) / (kGauss + 0.5)), dp = 1;
      for (int it = 0; it < 100; it++) {
        double p0 = 1, p1 = z;
        for (int k = 2; k <= kGauss; k++) { const double p2 = ((2 * k - 1) * z * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; }
        dp = kGauss * (z * p1 - p0) / (z * z - 1);
        const double dz = p1 / dp;
        z -= dz;
        if (std::abs(dz) < 1e-16) break;
      }
      x[i] = z;
      w[i] = 2 / ((1 - z * z) * dp * dp);
      const double phi = 0.5 * kPi * (z + 1);
      u[i] = 0.5 * (1 - std::cos(phi));
      v[i] = w[i] * 0.25 * kPi * std::sin(phi);
    }
  }
};
const Gauss &gauss() { static const Gauss g; return g; }

// the root of f between a and b (f(a), f(b) of opposite signs): Newton's steps, kept inside the
// bracket, with bisection when one would leave it
template <class F, class DF> double root(F f, DF df, double a, double b) {
  double fa = f(a);
  double x = 0.5 * (a + b);
  for (int it = 0; it < 200; it++) {
    const double fx = f(x);
    if (fx == 0) return x;
    if ((fx > 0) == (fa > 0)) { a = x; fa = fx; } else b = x;
    const double d = df(x);
    double nx = d != 0 ? x - fx / d : 0.5 * (a + b);
    if (!(nx > a && nx < b)) nx = 0.5 * (a + b);
    if (std::abs(nx - x) <= 1e-15 * std::max(1.0, x)) return nx;
    x = nx;
  }
  return x;
}

// ∫ 2r arccos(c(r)) dr from a to b, the angle the region spans at each radius, by Gauss–Legendre
// in φ with r = a + (b − a)(1 − cos φ)/2, which smooths the square-root edges at both ends
double ring(double a, double b, double y, double tau) {
  const Gauss &g = gauss();
  double s = 0;
  for (int i = 0; i < kGauss; i++) {
    const double r = a + (b - a) * g.u[i];
    const double c = std::clamp(((r * r + y * y) / 2 - std::log(r) - tau) / (r * y), -1.0, 1.0);
    s += g.v[i] * 2 * r * std::acos(c);
  }
  return s * (b - a);
}

} // namespace

Images images(double y) {
  const double s = std::sqrt(y * y + 4);
  Images im;
  im.y = y;
  im.xp = (y + s) / 2;
  im.xm = (y - s) / 2;
  auto T = [&](double x) { return (x - y) * (x - y) / 2 - std::log(std::abs(x)); };
  im.Tp = T(im.xp);
  im.Tm = T(im.xm);
  im.mup = 0.5 + (y * y + 2) / (2 * y * s);
  im.mum = 0.5 - (y * y + 2) / (2 * y * s);
  return im;
}

double area(double tau, double y) {
  // T(r, θ) = (r² + y²)/2 − r y cos θ − ln r: below τ where cos θ > c(r). Along θ = 0, T is least
  // at the minimum x₊ and below τ between two radii ra < x₊ < rb; along θ = π it is least at the
  // saddle, −x₋, and once τ passes T₋ it is below τ between rc and rd, where every angle arrives in
  // time: a whole annulus.
  const Images im = images(y);
  if (tau <= im.Tp) return 0;
  const double lo = std::exp(-tau - y * y - 5), hi = 2 * (y + 2 + std::sqrt(2 * std::abs(tau)));
  auto T0 = [&](double r) { return (r - y) * (r - y) / 2 - std::log(r) - tau; };
  auto d0 = [&](double r) { return r - y - 1 / r; };
  const double ra = root(T0, d0, lo, im.xp), rb = root(T0, d0, im.xp, im.xp + hi);
  const double xs = -im.xm;
  // below T₋ the angle dips toward π at the saddle's radius, sharply as τ nears T₋: split there
  if (tau <= im.Tm) return xs > ra && xs < rb ? ring(ra, xs, y, tau) + ring(xs, rb, y, tau) : ring(ra, rb, y, tau);
  auto Tpi = [&](double r) { return (r + y) * (r + y) / 2 - std::log(r) - tau; };
  auto dpi = [&](double r) { return r + y - 1 / r; };
  const double rc = root(Tpi, dpi, lo, xs), rd = root(Tpi, dpi, xs, xs + hi);
  return ring(ra, rc, y, tau) + kPi * (rd * rd - rc * rc) + ring(rd, rb, y, tau);
}

Parts parts(const double *P) {
  Parts p;
  p.mass = P[mass];
  p.z = P[redshift];
  p.y = P[offset];
  p.unit = kUnitSun * p.mass * (1 + p.z);
  p.im = images(p.y);
  p.delay = p.unit * (p.im.Tm - p.im.Tp);
  p.magnification = std::abs(p.im.mup) + std::abs(p.im.mum);
  p.optics = (int)P[optics];
  p.gain = phuzzbox::dbToGain(P[level]);
  return p;
}

std::complex<double> geometric(const Parts &p, double f) {
  const double phase = -2 * kPi * f * p.delay;
  return std::sqrt(std::abs(p.im.mup)) + std::complex<double>(0, 1) * std::sqrt(std::abs(p.im.mum)) * std::polar(1.0, phase);
}

void rayCoefficients(const double (&poles)[kRaySections], double fs, double (&c)[kRaySections]) {
  for (int i = 0; i < kRaySections; i++) {
    // the bilinear transform s = 2fs (1 − z⁻¹)/(1 + z⁻¹) of a pole at 2πp: the analog design's
    // 12 Hz to 120 kHz lands on (fs/π) atan(π f/fs), 12 Hz to just under half the rate
    const double k = kPi * poles[i] / fs;
    c[i] = (1 - k) / (1 + k);
  }
}

std::complex<double> rayChain(const double (&c)[kRaySections], double f, double fs) {
  const std::complex<double> zi = std::polar(1.0, -2 * kPi * f / fs); // z⁻¹
  std::complex<double> h = 1;
  for (int i = 0; i < kRaySections; i++) h *= (-c[i] + zi) / (1.0 - c[i] * zi);
  return h;
}

std::complex<double> rayResponse(const Parts &p, double f, double fs) {
  double a[kRaySections], b[kRaySections];
  rayCoefficients(kRayPolesA, fs, a);
  rayCoefficients(kRayPolesB, fs, b);
  const double w = 2 * kPi * f;
  return std::polar(1.0, -w * kRayLead / fs) *
         (std::sqrt(std::abs(p.im.mup)) * rayChain(a, f, fs) + std::sqrt(std::abs(p.im.mum)) * rayChain(b, f, fs) * std::polar(1.0, -w * p.delay));
}

int kernelLength(const Parts &p, double fs, int cap) {
  const double D = 1 / (fs * p.unit);
  const double w20 = 2 * kPi * 20 * p.unit;
  const double tail = std::max(8.0, 10 / w20);
  const double n = std::ceil((p.im.Tm - p.im.Tp) / D) + std::ceil(tail / D) + 2;
  return (int)std::clamp(n, 64.0, (double)cap);
}

void Kernel::reserve(int cap) {
  h.reserve(cap);
  pts.reserve(cap);
  at.reserve(cap + 2);
  A.reserve(cap + 2);
}

void Kernel::start(const Parts &parts, double fs, int cap) {
  p = parts;
  D = 1 / (fs * p.unit);
  n = kernelLength(p, fs, cap);
  h.assign(n, 0.0);
  pts.clear();
  at.clear();
  A.clear();
  next = 0;
  // the taps worked out exactly: every one within ten taps of an image, then a tenth of the
  // distance to the nearer image apart; and the last
  const double dm = (p.im.Tm - p.im.Tp) / D; // the saddle, in taps
  for (int k = 0; k < n;) {
    pts.push_back(k);
    const double near = k < dm ? std::min((double)k, dm - k) : k - dm;
    k += every ? 1 : std::max(1, (int)std::floor(0.1 * near));
  }
  if (pts.back() != n - 1) pts.push_back(n - 1);
  // the areas they need, A at k − 1, k and k + 1 (A(τ₋₁) = A(T₊) = 0, known)
  for (int k : pts)
    for (int j = std::max(1, k - 1); j <= k + 1; j++)
      if (at.empty() || at.back() < j) at.push_back(j);
  state = building;
}

bool Kernel::work(int evals) {
  if (state != building) return state == finished;
  for (int e = 0; e < evals && next < (int)at.size(); e++, next++) A.push_back(area(p.im.Tp + at[next] * D, p.y));
  if (next >= (int)at.size()) finish();
  return state == finished;
}

void Kernel::finish() {
  {
    // hₖ at the exact taps from the areas (both lists ascending), then the cubic through the four
    // exact taps around each tap between them
    auto areaAt = [&](int k) {
      if (k <= 0) return 0.0;
      return A[std::lower_bound(at.begin(), at.end(), k) - at.begin()];
    };
    const double norm = 1 / (2 * kPi * D);
    const int m = (int)pts.size();
    for (int k : pts) h[k] = (areaAt(k + 1) - 2 * areaAt(k) + areaAt(k - 1)) * norm;
    for (int j = 0; j + 1 < m; j++) {
      if (pts[j + 1] - pts[j] < 2) continue;
      const int a = std::max(0, std::min(j - 1, m - 4));
      const double x0 = pts[a], x1 = pts[a + 1], x2 = pts[a + 2], x3 = pts[a + 3];
      const double y0 = h[pts[a]], y1 = h[pts[a + 1]], y2 = h[pts[a + 2]], y3 = h[pts[a + 3]];
      for (int k = pts[j] + 1; k < pts[j + 1]; k++) {
        const double x = k;
        h[k] = y0 * (x - x1) * (x - x2) * (x - x3) / ((x0 - x1) * (x0 - x2) * (x0 - x3)) +
               y1 * (x - x0) * (x - x2) * (x - x3) / ((x1 - x0) * (x1 - x2) * (x1 - x3)) +
               y2 * (x - x0) * (x - x1) * (x - x3) / ((x2 - x0) * (x2 - x1) * (x2 - x3)) +
               y3 * (x - x0) * (x - x1) * (x - x2) / ((x3 - x0) * (x3 - x1) * (x3 - x2));
      }
    }
  }
  // fade the tail out over its last quarter (past the images), and put back there what the rest of
  // the tail would have added at DC, so the kernel's sum is F(0) = 1
  const int img = (int)std::ceil((p.im.Tm - p.im.Tp) / D);
  const int from = std::clamp(n - (n - img) / 4, 1, n - 1);
  const int len = n - from;
  double sum = 0;
  for (int k = 0; k < n; k++) {
    if (k >= from) h[k] *= 0.5 * (1 + std::cos(kPi * (k - from + 0.5) / len));
    sum += h[k];
  }
  {
    double bump = 0;
    for (int k = from; k < n; k++) bump += 1 - std::cos(2 * kPi * (k - from + 0.5) / len);
    for (int k = from; k < n; k++) h[k] += (1 - sum) * (1 - std::cos(2 * kPi * (k - from + 0.5) / len)) / bump;
  }
  state = finished;
}

} // namespace lens
