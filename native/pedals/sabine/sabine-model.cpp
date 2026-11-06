// sabine-model.cpp — Sabine's Room's room, surfaces and reflections (sabine-model.h).

#include "sabine-model.h"

#include <algorithm>
#include <cmath>

#include "sabine-params.h"

namespace sabine {

const double kCentres[kBands] = {125, 250, 500, 1000, 2000, 4000};

namespace {
// absorption coefficients, 125 Hz to 4 kHz (Hall, Musical Acoustics, Table 15.1)
constexpr double kWalls[5][kBands] = {
    {.01, .01, .02, .02, .02, .03}, // poured concrete
    {.10, .05, .06, .07, .10, .10}, // painted block
    {.20, .15, .10, .05, .04, .05}, // plaster on lath
    {.20, .06, .04, .03, .02, .02}, // plate glass
    {.07, .30, .50, .70, .70, .60}, // medium velour drapes
};
constexpr double kFloors[3][kBands] = {
    {.40, .30, .20, .20, .15, .10}, // wooden platform floor
    {.02, .06, .15, .40, .60, .60}, // heavy carpet on concrete
    {.01, .01, .02, .02, .02, .03}, // poured concrete
};
constexpr double kAudience[kBands] = {.40, .60, .80, .90, .90, .90}; // seats, occupied
} // namespace

double airAbsorption(double f, double rh) {
  constexpr double T = 293.15, T01 = 273.16;
  const double h = rh * std::pow(10.0, -6.8346 * std::pow(T01 / T, 1.261) + 4.6151);
  const double frO = 24 + 4.04e4 * h * (0.02 + h) / (0.391 + h), frN = 9 + 280 * h;
  const double f2 = f * f;
  return 8.686 * f2 * (1.84e-11 + 0.01275 * std::exp(-2239.1 / T) / (frO + f2 / frO) + 0.1068 * std::exp(-3352.0 / T) / (frN + f2 / frN));
}

double Parts::A(int b) const {
  double a = 4 * m[b] * V();
  for (int s = 0; s < kSurfaces; s++) a += area[s] * alpha[s][b];
  return a;
}
double Parts::sabine(int b) const { return kSabine * V() / (kSpeed * A(b)); }
double Parts::eyring(int b) const {
  double sa = 0;
  for (int s = 0; s < kSurfaces; s++) sa += area[s] * alpha[s][b];
  return kSabine * V() / (kSpeed * (-S() * std::log(1 - sa / S()) + 4 * m[b] * V()));
}

Parts parts(const double *P) {
  Parts p{};
  p.L = P[length];
  p.W = P[width];
  p.H = P[height];
  const int wl = std::clamp((int)std::lround(P[walls]), 0, 4), fl = std::clamp((int)std::lround(P[floor]), 0, 2);
  const double aud = std::clamp(P[audience] / 100, 0.0, 1.0);
  for (int b = 0; b < kBands; b++) {
    for (int s = 0; s < kSurfaces; s++) p.alpha[s][b] = kWalls[wl][b];
    p.alpha[4][b] = aud * kAudience[b] + (1 - aud) * kFloors[fl][b];
    p.m[b] = airAbsorption(kCentres[b], P[humidity]) / (10 * std::log10(std::exp(1.0)));
  }
  p.area[0] = p.area[1] = p.W * p.H;
  p.area[2] = p.area[3] = p.L * p.H;
  p.area[4] = p.area[5] = p.L * p.W;
  // the bass near one end, 1.2 m up (or half the height); you d away, along the room and a little
  // across it, at the same height, kept half a metre from every surface
  const double z = std::min(1.2, p.H / 2);
  p.src[0] = 0.2 * p.L; p.src[1] = 0.42 * p.W; p.src[2] = z;
  const double dist = P[distance];
  p.rcv[0] = std::clamp(p.src[0] + 0.96 * dist, 0.5, p.L - 0.5);
  p.rcv[1] = std::clamp(p.src[1] + 0.28 * dist, 0.5, p.W - 0.5);
  p.rcv[2] = z;
  p.d = std::hypot(p.rcv[0] - p.src[0], p.rcv[1] - p.src[1]);
  p.level = std::pow(10.0, P[level] / 20);
  return p;
}

double early(const Parts &p, Reflection *out, Reflection *all) {
  const double dims[3] = {p.L, p.W, p.H};
  double beta[kSurfaces][kBands];
  for (int s = 0; s < kSurfaces; s++) for (int b = 0; b < kBands; b++) beta[s][b] = std::sqrt(1 - p.alpha[s][b]);
  // search a sphere about you that holds some 3 × kEarly images (4π R³/3V of them), widening it until it does
  double R = std::max(p.d * 1.01, std::cbrt(3.0 * 3 * kEarly * p.V() / (4 * 3.14159265358979323846)));
  int n = 0;
  for (int tries = 0; tries < 8; tries++, R *= 1.5) {
    n = 0;
    int K[3];
    for (int a = 0; a < 3; a++) K[a] = (int)std::ceil(R / (2 * dims[a])) + 1;
    bool full = false;
    for (int l = -K[0]; l <= K[0] && !full; l++) for (int u = 0; u < 2 && !full; u++) {
      const double dx = (1 - 2 * u) * p.src[0] + 2 * l * p.L - p.rcv[0];
      if (std::fabs(dx) > R) continue;
      for (int mm = -K[1]; mm <= K[1] && !full; mm++) for (int v = 0; v < 2 && !full; v++) {
        const double dy = (1 - 2 * v) * p.src[1] + 2 * mm * p.W - p.rcv[1];
        if (dx * dx + dy * dy > R * R) continue;
        for (int nn = -K[2]; nn <= K[2]; nn++) for (int w = 0; w < 2; w++) {
          const double dz = (1 - 2 * w) * p.src[2] + 2 * nn * p.H - p.rcv[2];
          const double r = std::sqrt(dx * dx + dy * dy + dz * dz);
          if (r > R) continue;
          if (n == kMaxImages) { full = true; break; }
          // reflections from x = 0: |l − u|, from x = L: |l|; and so on
          const int c[kSurfaces] = {std::abs(l - u), std::abs(l), std::abs(mm - v), std::abs(mm), std::abs(nn - w), std::abs(nn)};
          Reflection &e = all[n++];
          e.r = r;
          e.order = c[0] + c[1] + c[2] + c[3] + c[4] + c[5];
          for (int b = 0; b < kBands; b++) {
            double g = std::exp(-0.5 * p.m[b] * r) / r;
            for (int s = 0; s < kSurfaces; s++) for (int k = 0; k < c[s]; k++) g *= beta[s][b];
            e.gain[b] = g;
          }
        }
      }
    }
    if (n > kEarly + 1 && !full) break;
  }
  const int keep = std::min(n, kEarly + 2);
  std::partial_sort(all, all + keep, all + n, [](const Reflection &a, const Reflection &b) { return a.r < b.r; });
  for (int i = 0; i < std::min(keep, kEarly + 1); i++) out[i] = all[i];
  return keep > kEarly + 1 ? all[kEarly + 1].r : R;
}

} // namespace sabine
