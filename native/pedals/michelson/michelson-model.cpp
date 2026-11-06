// michelson-model.cpp — the Michelson Interferometer's physics (michelson-model.h).

#include "michelson-model.h"

#include <algorithm>
#include <cmath>

#include "michelson-params.h"

namespace michelson {

namespace {
constexpr double kPi = 3.14159265358979323846;
constexpr double kLn2 = 0.69314718055994530942;

// The sources, in the Light switch's order. Widths are typical of each kind (the README says
// where they come from): a helium–neon laser's few longitudinal modes span about 1.5 GHz, so it
// stays coherent over some 20 cm; a green DPSS pointer's light over a few millimetres; a
// multimode violet diode's over a fraction of one; a low-pressure sodium lamp gives its D lines,
// D₂ twice as strong as D₁, 0.597 nm apart; a white LED is a blue chip's narrow peak and its
// phosphor's broad yellow one.
const Source kTable[kSources] = {
  {"HeNe laser", 632.8e-9, 1, {{632.8e-9, 1, 0.002e-9}}},
  {"Green laser", 532e-9, 1, {{532e-9, 1, 0.1e-9}}},
  {"Violet laser diode", 405e-9, 1, {{405e-9, 1, 1e-9}}},
  {"Sodium lamp", 589.3e-9, 2, {{588.995e-9, 2, 0.005e-9}, {589.592e-9, 1, 0.005e-9}}},
  {"White LED", 560e-9, 2, {{450e-9, 0.4, 20e-9}, {565e-9, 1, 110e-9}}},
};
const Actuator kActuators[2] = {
  {20000, 8},  // a piezo stack carrying a small mirror: stiff, its first resonance far above a bass
  {80, 0.8},   // a mirror glued to a small loudspeaker's cone: soft suspension, damped by the coil
};

// a line's visibility at path difference opd: its spectrum is Gaussian in wavenumber, of FWHM
// Δk = 2π Δλ / λ², and the fringes' envelope is that Gaussian's Fourier transform
inline double visibility(const Line &l, double opd) {
  const double u = kPi * l.width * opd / (l.lambda * l.lambda);
  return std::exp(-u * u / (4 * kLn2));
}
} // namespace

const Source &source(int k) { return kTable[std::clamp(k, 0, kSources - 1)]; }
const Actuator &actuator(int k) { return kActuators[std::clamp(k, 0, 1)]; }

Parts parts(const double *P) {
  Parts p{};
  p.src = &source((int)std::lround(P[light]));
  const double l0 = p.src->lambda0;
  // the micrometer to the nearest whole wavelength, so the Fringe knob alone sets the phase
  const double whole = std::round(2 * P[arm] / l0) * l0;
  p.rest = whole + (P[fringe] / 360) * l0;
  p.stroke = P[stroke];
  const Actuator &a = actuator((int)std::lround(P[mount]));
  p.f0 = a.f0;
  p.Q = a.Q;
  p.air = P[air];
  p.airTime = 0.5;
  p.gain = std::pow(10.0, P[level] / 20);
  p.fullScale = 1.0; // 1 mW at the detector, 0.4 A/W, into 2.5 kΩ
  return p;
}

double intensity(const Parts &p, double opd) {
  double s = 0, w = 0;
  for (int j = 0; j < p.src->lines; j++) {
    const Line &l = p.src->line[j];
    s += l.weight * visibility(l, opd) * std::cos(2 * kPi / l.lambda * opd);
    w += l.weight;
  }
  return 0.5 * (1 + s / w);
}

double intensityAveraged(const Parts &p, double a, double b) {
  double s = 0, w = 0;
  const double mid = 0.5 * (a + b);
  for (int j = 0; j < p.src->lines; j++) {
    const Line &l = p.src->line[j];
    const double k = 2 * kPi / l.lambda, pa = k * a, pb = k * b, d = pb - pa;
    // the mean of cos over [pa, pb]: (sin pb − sin pa)/(pb − pa), written to stay accurate as
    // the stretch shrinks: 2 cos(mid) sin(d/2) / d
    const double c = std::cos(k * mid), m = std::fabs(d) < 1e-4 ? 1 - d * d / 24 : 2 * std::sin(0.5 * d) / d;
    s += l.weight * visibility(l, mid) * c * m;
    w += l.weight;
  }
  return 0.5 * (1 + s / w);
}

double contrast(const Parts &p, double opd) {
  std::complex<double> s = 0;
  double w = 0;
  for (int j = 0; j < p.src->lines; j++) {
    const Line &l = p.src->line[j];
    s += l.weight * visibility(l, opd) * std::polar(1.0, 2 * kPi / l.lambda * opd);
    w += l.weight;
  }
  return std::abs(s) / w;
}

std::complex<double> actuatorResponse(const Parts &p, double f) {
  const double w0 = 2 * kPi * p.f0, w = 2 * kPi * f;
  return p.stroke * w0 * w0 / std::complex<double>(w0 * w0 - w * w, w * w0 / p.Q);
}

} // namespace michelson
