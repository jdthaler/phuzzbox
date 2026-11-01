// dsp.h — the building blocks the pedals share (from Forte's forte/dsp.h), in double precision.
#pragma once

#include <cmath>
#include <numbers>

namespace phuzzbox {

constexpr double PI = std::numbers::pi;
constexpr double TAU = 2 * PI;
inline double dbToGain(double db) { return std::pow(10.0, db / 20); }

// An analog second-order section, H(s) = (b2 s² + b1 s + b0) / (a2 s² + a1 s + a0), in SI units.
struct AnalogBiquad { double b2, b1, b0, a2, a1, a0; };

// A digital biquad in transposed direct form II, y = (b0 + b1 z⁻¹ + b2 z⁻²) / (1 + a1 z⁻¹ + a2 z⁻²).
struct Biquad {
  double b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0, z1 = 0, z2 = 0;
  double run(double x) {
    const double y = b0 * x + z1;
    z1 = b1 * x - a1 * y + z2;
    z2 = b2 * x - a2 * y;
    return y;
  }
  void reset() { z1 = z2 = 0; }
  // A filter left to ring down in silence reaches denormal numbers, which on x86 cost a hundred
  // times a normal one; WebAssembly can't flush them to zero (denormals.h does it natively), and a
  // recursive filter can sit among them for good. A state under 1e-30 is inaudible: zero it.
  void flush() { if (std::abs(z1) < 1e-30) z1 = 0; if (std::abs(z2) < 1e-30) z2 = 0; }
};

// The bilinear transform of an analog section, s = c (1 − z⁻¹)/(1 + z⁻¹), with c = ω₀ / tan(ω₀ T/2)
// so that the frequency f0 (in Hz) maps exactly (prewarping); f0 ≤ 0: c = 2 fs, no prewarp.
inline Biquad bilinear(const AnalogBiquad &h, double fs, double f0 = 0) {
  const double c = f0 > 0 && f0 < 0.49 * fs ? TAU * f0 / std::tan(PI * f0 / fs) : 2 * fs, c2 = c * c;
  const double B0 = h.b2 * c2 + h.b1 * c + h.b0, B1 = 2 * (h.b0 - h.b2 * c2), B2 = h.b2 * c2 - h.b1 * c + h.b0;
  const double A0 = h.a2 * c2 + h.a1 * c + h.a0, A1 = 2 * (h.a0 - h.a2 * c2), A2 = h.a2 * c2 - h.a1 * c + h.a0;
  Biquad q;
  q.b0 = B0 / A0; q.b1 = B1 / A0; q.b2 = B2 / A0; q.a1 = A1 / A0; q.a2 = A2 / A0;
  return q;
}

// The matched-z transform of an analog section: each root s of the numerator and the denominator
// moves to e^(sT), so the digital poles and zeros ring exactly as the analog ones, and the gain is
// matched at DC. For a ratio of two quadratics whose roots sit well below Nyquist (a pickup's load
// against another), the response follows the analog one to a fraction of a decibel up to fs/6,
// with no warping of the resonance. A section whose s² and s coefficients both vanish is a constant.
namespace detail {
// the z-polynomial 1 + c1 z⁻¹ + c2 z⁻² whose roots are e^(sT) for the roots s of a2 s² + a1 s + a0
inline void zRoots(double a2, double a1, double a0, double T, double &c1, double &c2) {
  c1 = c2 = 0;
  if (a2 == 0) {
    if (a1 == 0) return;                // a constant: no roots
    c1 = -std::exp(-a0 / a1 * T);        // one real root −a0/a1
    return;
  }
  const double re = -a1 / (2 * a2), d = a1 * a1 - 4 * a2 * a0;
  if (d >= 0) { // two real roots
    const double r = std::sqrt(d) / (2 * std::abs(a2)), p = std::exp((re + r) * T), q = std::exp((re - r) * T);
    c1 = -(p + q);
    c2 = p * q;
  } else {      // a complex pair re ± i·im
    const double im = std::sqrt(-d) / (2 * std::abs(a2)), m = std::exp(re * T);
    c1 = -2 * m * std::cos(im * T);
    c2 = m * m;
  }
}
} // namespace detail

inline Biquad matchedZ(const AnalogBiquad &h, double fs) {
  const double T = 1 / fs;
  double n1, n2, d1, d2;
  detail::zRoots(h.b2, h.b1, h.b0, T, n1, n2);
  detail::zRoots(h.a2, h.a1, h.a0, T, d1, d2);
  const double g = (h.b0 / h.a0) * (1 + d1 + d2) / (1 + n1 + n2); // the analog DC gain
  Biquad q;
  q.b0 = g; q.b1 = g * n1; q.b2 = g * n2; q.a1 = d1; q.a2 = d2;
  return q;
}

// |H(j2πf)| of an analog section.
inline double analogMagnitude(const AnalogBiquad &h, double f) {
  const double w = TAU * f, w2 = w * w;
  const double nr = h.b0 - h.b2 * w2, ni = h.b1 * w, dr = h.a0 - h.a2 * w2, di = h.a1 * w;
  return std::sqrt((nr * nr + ni * ni) / (dr * dr + di * di));
}

// DC blocker, y[n] = x[n] − x[n−1] + R·y[n−1], corner ≈ f Hz.
struct DCBlock {
  DCBlock(double f = 5, double fs = 48000) : R(std::exp(-TAU * f / fs)) {}
  double run(double x) { const double y = x - x1 + R * y1; x1 = x; y1 = y; return y; }
  void reset() { x1 = y1 = 0; }
  double R, x1 = 0, y1 = 0;
};

} // namespace phuzzbox
