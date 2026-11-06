// lampvibe-model.cpp — the Lamp Vibe's physics (lampvibe-model.h).

#include "lampvibe-model.h"

#include <algorithm>
#include <cmath>
#include <vector>

#include "lampvibe-params.h"

namespace lampvibe {

namespace {
constexpr double kPi = 3.14159265358979323846;
constexpr double kH = 6.62607015e-34, kC = 299792458, kK = 1.380649e-23; // Planck, light, Boltzmann

// tungsten's resistivity (µΩ·cm) from 300 to 3600 K in steps of 100 K: the values of Forsythe and
// Watson as the CRC Handbook gives them
constexpr double kRho[] = {
  5.65, 8.06, 10.56, 13.23, 16.09, 19.00, 21.94, 24.93, 27.94, 30.98, 34.08, 37.19, 40.36, 43.55,
  46.78, 50.05, 53.35, 56.67, 60.06, 63.48, 66.91, 70.39, 73.91, 77.49, 81.04, 84.70, 88.33, 92.04,
  95.76, 99.54, 103.3, 107.2, 111.1, 115.0,
};
constexpr int kRhoN = sizeof(kRho) / sizeof(kRho[0]);

// The lamps, in the Lamp switch's order: small vacuum lamps whose filaments run at about 2500 K.
// A bigger lamp has a thicker filament, more heat to store for the light it gives, and so a
// slower glow.
const Lamp kLampTable[kLamps] = {
  {"Grain of wheat, 12 V 50 mA", 12, 0.05, 2500},
  {"Pilot lamp, 6.3 V 150 mA", 6.3, 0.15, 2500},
  {"Panel bulb, 12 V 5 W", 12, 5.0 / 12, 2500},
};

// the stages' capacitors: spread so that the notches spread over the bass's range
constexpr double kCaps[kStages] = {470e-9, 100e-9, 22e-9, 4.7e-9};

// the glow's table: ln of the cells' photon flux against u = 1/T, from 1/4000 to 1/200 K⁻¹
constexpr int kGlowN = 2048;
constexpr double kUMin = 1.0 / 4000, kUMax = 1.0 / 200;
struct GlowTable {
  double ln[kGlowN];
  GlowTable() {
    // the response: a Gaussian bell in wavelength; Simpson's rule over ±6 standard deviations
    const double sd = 2 * kSpread / (2 * std::sqrt(2 * std::log(2.0))), a = kPeak - 6 * sd, b = kPeak + 6 * sd;
    const int steps = 600;
    const double h = (b - a) / steps;
    for (int j = 0; j < kGlowN; j++) {
      const double T = 1 / (kUMin + (kUMax - kUMin) * j / (kGlowN - 1));
      // the integrand scaled by exp(c₂/(λ_peak T)) so it stays in range at the coldest
      const double ref = kH * kC / (kPeak * kK * T);
      double s = 0;
      for (int i = 0; i <= steps; i++) {
        const double l = a + i * h, x = kH * kC / (l * kK * T), w = i == 0 || i == steps ? 1 : i % 2 ? 4 : 2;
        const double S = std::exp(-0.5 * (l - kPeak) * (l - kPeak) / (sd * sd));
        // λ B_λ ∝ λ⁻⁴ / (e^x − 1): photons per wavelength
        s += w * S * std::pow(l / kPeak, -4) * std::exp(ref - x) / -std::expm1(-x);
      }
      ln[j] = std::log(s * h / 3) - ref;
    }
  }
  double at(double T) const {
    const double u = std::clamp(1 / T, kUMin, kUMax), x = (u - kUMin) / (kUMax - kUMin) * (kGlowN - 1);
    const int i = std::min((int)x, kGlowN - 2);
    return ln[i] + (ln[i + 1] - ln[i]) * (x - i);
  }
};
const GlowTable &glowTable() { static const GlowTable t; return t; }
} // namespace

double resistivity(double T) {
  const double x = std::clamp((T - 300) / 100, 0.0, (double)(kRhoN - 1));
  const int i = std::min((int)x, kRhoN - 2);
  return 1e-8 * (kRho[i] + (kRho[i + 1] - kRho[i]) * (x - i));
}

// The total hemispherical emissivity of a metal from its resistivity, by the free-electron theory
// (the Hagen–Rubens relation carried to all angles and wavelengths), Parker and Abbott's form:
// ε = 0.766 √(ρT) − (0.309 − 0.0889 ln ρT) ρT − 0.0175 (ρT)^{3/2}, ρ in Ω·cm. For tungsten it gives
// 0.03 at room temperature and 0.25 at 2500 K, within some 15 % of the measured values.
double emissivity(double T) {
  const double rt = 100 * resistivity(T) * T;
  return 0.766 * std::sqrt(rt) - (0.309 - 0.0889 * std::log(rt)) * rt - 0.0175 * rt * std::sqrt(rt);
}

double glow(double T, double Tref) {
  const GlowTable &g = glowTable();
  return std::exp(g.at(T) - g.at(Tref));
}

double cellResponse(double lambda) {
  const double sd = 2 * kSpread / (2 * std::sqrt(2 * std::log(2.0)));
  return std::exp(-0.5 * (lambda - kPeak) * (lambda - kPeak) / (sd * sd));
}
double planck(double lambda, double T) {
  const double x = kH * kC / (lambda * kK * T);
  return 2 * kH * kC * kC / std::pow(lambda, 5) / std::expm1(x);
}

const Lamp &lamp(int k) { return kLampTable[std::clamp(k, 0, kLamps - 1)]; }

Filament filament(const Lamp &l) {
  Filament f{};
  const double P = l.V * l.I, R = l.V / l.I;
  f.A = P / (emissivity(l.T) * kSigma * (std::pow(l.T, 4) - std::pow(kRoom, 4)));
  f.geom = R / resistivity(l.T);
  // geom = 4L/(π d²) and A = π d L, so d³ = 4A/(π² geom)
  f.d = std::cbrt(4 * f.A / (kPi * kPi * f.geom));
  f.L = f.A / (kPi * f.d);
  f.C = kDensity * kPi * f.d * f.d / 4 * f.L * kHeat;
  return f;
}

double heating(const Filament &f, double v, double T) {
  const double in = v * v / resistance(f, T), out = emissivity(T) * kSigma * f.A * (std::pow(T, 4) - std::pow(kRoom, 4));
  return (in - out) / f.C;
}

double filamentStep(const Filament &f, double v, double T, double dt) {
  const double k1 = heating(f, v, T), k2 = heating(f, v, T + 0.5 * dt * k1);
  const double k3 = heating(f, v, T + 0.5 * dt * k2), k4 = heating(f, v, T + dt * k3);
  return std::max(kRoom, T + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4));
}

double steadyT(const Filament &f, double v) {
  double lo = kRoom, hi = 3600;
  for (int i = 0; i < 80; i++) {
    const double m = 0.5 * (lo + hi);
    (heating(f, v, m) > 0 ? lo : hi) = m;
  }
  return 0.5 * (lo + hi);
}

Parts parts(const double *P) {
  Parts p{};
  p.lamp = &lamp((int)std::lround(P[bulb]));
  p.fil = filament(*p.lamp);
  p.speed = P[speed];
  p.depth = P[intensity];
  p.rlit = 3e3;
  p.rdark = 10e6;
  p.tau = P[cell];
  for (int k = 0; k < kStages; k++) p.C[k] = kCaps[k];
  p.vibrato = std::lround(P[mode]) == 1;
  p.gain = std::pow(10.0, P[level] / 20);
  return p;
}

double cellStep(const Parts &p, double light, double n, double dt) {
  auto rate = [&](double m) { return (light - m * (1 + m)) / p.tau; };
  const double k1 = rate(n), k2 = rate(n + dt * k1);
  return std::max(0.0, n + 0.5 * dt * (k1 + k2));
}

std::complex<double> stages(const Parts &p, double R, double f) {
  std::complex<double> h = 1;
  for (int k = 0; k < kStages; k++) {
    const std::complex<double> s(0, 2 * kPi * f * R * p.C[k]);
    h *= (1.0 - s) / (1.0 + s);
  }
  return h;
}

std::complex<double> response(const Parts &p, double R, double f) {
  const std::complex<double> h = stages(p, R, f);
  return p.vibrato ? h : 0.5 * (1.0 + h);
}

} // namespace lampvibe
