// rubens-model.cpp — Rubens' Tube's pipe, gas and speaker (rubens-model.h).

#include "rubens-model.h"

#include <algorithm>
#include <cmath>

#include "rubens-params.h"

namespace rubens {

namespace {
// NIST Chemistry WebBook (Thermophysical Properties of Fluid Systems) at 293.15 K and 0.101325 MPa:
// sound speed, density, viscosity, Cp/Cv, and the Prandtl number μ Cp/k
constexpr Gas kPropane{246.59, 1.8650, 7.9877e-6, 73.374 / 64.422, 7.9877e-6 * (73.374 / 0.0440956) / 0.017763};
constexpr Gas kMethane{445.01, 0.66816, 1.0914e-5, 35.625 / 27.229, 1.0914e-5 * (35.625 / 0.0160425) / 0.033271};
} // namespace

const Gas &gasOf(int which) { return which == 1 ? kMethane : kPropane; }

// Gardner, Gee and Dix (2009), Table I: their 10.5 cm driver's measured parameters
const Driver kDriver{5.42, 6.59, 9.66e-3, 482.8e-6, 73.7, 3.03};

double kirchhoff(const Gas &g, double a, double f) {
  return std::sqrt(kPi * f * g.mu / g.rho) * (1 + (g.gamma - 1) / std::sqrt(g.prandtl)) / (a * g.c);
}

Parts parts(const double *P) {
  Parts p{};
  p.L = P[length];
  p.a = P[diameter] / 200;
  p.St = kPi * p.a * p.a;
  p.V = p.St * p.L;
  p.Sd = p.St;
  p.g = gasOf(std::clamp((int)std::lround(P[gas]), 0, 1));
  p.xm = std::clamp(P[mic] / 100, 0.0, 1.0) * p.L;
  p.drive = P[drive];
  p.level = std::pow(10.0, P[level] / 20);
  p.pressure = P[pressure];
  p.cutoff = 1.8412 * p.g.c / (2 * kPi * p.a);
  const double f1 = p.g.c / (2 * p.L);
  p.modes = std::clamp((int)std::floor(p.cutoff / f1), 1, kMaxModes);
  for (int n = 1; n <= p.modes; n++) {
    p.f0[n] = n * f1;
    p.alpha[n] = kirchhoff(p.g, p.a, p.f0[n]);
    p.sigma[n] = p.g.c * p.alpha[n];
    p.omega[n] = 2 * kPi * p.f0[n] - p.sigma[n];
    p.weight[n] = std::cos(n * kPi * p.xm / p.L);
  }
  return p;
}

Response response(const Parts &p, double f, double x) {
  using cd = std::complex<double>;
  const double w = 2 * kPi * f;
  const cd iw(0, -w); // d/dt in e^(−iωt)
  // the pipe's pressure at the cone, and at x, per unit volume velocity
  cd z0 = p.spring() / iw, zx = z0;
  for (int n = 1; n <= p.modes; n++) {
    const cd m = p.force() * iw / (p.omega[n] * p.omega[n] + p.sigma[n] * p.sigma[n] - w * w - 2.0 * cd(0, 1) * p.sigma[n] * w);
    z0 += m;
    zx += m * std::cos(n * kPi * x / p.L);
  }
  const Driver &d = kDriver;
  const cd mech = iw * d.Mms + d.Rms() + d.Bl * d.Bl / d.Re + 1.0 / (d.Cms * iw) + p.Sd * p.Sd * z0;
  const cd v = d.Bl / d.Re / mech;
  return {p.Sd * v * zx, v};
}

} // namespace rubens
