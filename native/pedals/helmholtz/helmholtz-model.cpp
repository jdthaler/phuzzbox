// helmholtz-model.cpp — Helmholtz's resonators (helmholtz-model.h).

#include "helmholtz-model.h"

#include <algorithm>
#include <cmath>

#include "helmholtz-params.h"

namespace helmholtz {

// Helmholtz, On the Sensations of Tone (Ellis's translation, 1885), Appendix II: "a list of the
// measurements of my glass resonators"
const Glass kGlass[kCount] = {
    {154, 35.5, 1773}, {131, 28.5, 1092}, {130, 30.2, 1053}, {115, 30, 546}, {79, 18.5, 235},
    {76, 22, 214},     {70, 20.5, 162},   {53.5, 8, 74},     {46, 15, 49},   {43, 15, 37},
};

namespace {
// his coefficients: 56174 from the theory of an orifice in a thin wall, 47000 measured for openings
// a fourth to a fifth of the sphere's diameter. The neck that gives his: (ℓ + 2δ) = π r/(2 κ²)
constexpr double kTheory = 56174, kMeasured = 47000, kEnd = 0.85;
const double kNeck = kPi / (2 * (kMeasured / kTheory) * (kMeasured / kTheory)) - 2 * kEnd; // ℓ/r
} // namespace

Resonator resonator(const Glass &g, double scale, double c, double rho, double mu) {
  Resonator o{};
  const double r0 = g.orifice / 2000;
  o.r = r0 * scale;
  o.Sn = kPi * o.r * o.r;
  o.V = g.volume * 1e-6;
  o.neck = kNeck * r0; // the neck stays as it is when the opening is narrowed
  const double len = o.neck + 2 * kEnd * o.r;
  o.w0 = c * std::sqrt(o.Sn / (len * o.V));
  o.f0 = o.w0 / (2 * kPi);
  const double k = o.w0 / c;
  // 1/Q = ω0 R V/(ρ c² Sn), R per unit of the neck's velocity
  const double Rrad = 0.25 * (k * o.r) * (k * o.r) * rho * c;
  const double alpha = std::sqrt(kPi * o.f0 * mu / rho) / (o.r * c);
  const double Rvisc = 2 * rho * c * alpha * o.neck;
  const double g0 = o.w0 * o.V / (rho * c * c * o.Sn);
  o.Qrad = 1 / (g0 * Rrad);
  o.Qvisc = o.neck > 0 ? 1 / (g0 * Rvisc) : 1e12;
  o.Q = 1 / (g0 * (Rrad + Rvisc));
  return o;
}

Parts parts(const double *P) {
  Parts p{};
  p.T = P[temperature] + 273.15;
  p.c = 343.2 * std::sqrt(p.T / 293.15);
  p.rho = 1.2041 * 293.15 / p.T;
  p.mu = 1.8205e-5;
  for (int k = 0; k < kCount; k++) p.res[k] = resonator(kGlass[k], P[opening] / 100, p.c, p.rho, p.mu);
  p.one = std::clamp((int)std::lround(P[glass]) - 1, 0, kCount - 1);
  p.openEar = P[ear] <= -60 ? 0 : std::pow(10.0, P[ear] / 20);
  p.level = std::pow(10.0, P[level] / 20);
  return p;
}

void response(const Resonator &r, double f, double &re, double &im) {
  // H = ω0²/(ω0² − ω² − i ω ω0/Q)
  const double w = 2 * kPi * f, a = r.w0 * r.w0 - w * w, b = -w * r.w0 / r.Q, d = a * a + b * b;
  re = r.w0 * r.w0 * a / d;
  im = -r.w0 * r.w0 * b / d;
}

} // namespace helmholtz
