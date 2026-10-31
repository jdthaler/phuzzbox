// oversample.h — running a nonlinear circuit at M times the host's rate, so the harmonics it makes
// above the host's Nyquist frequency are filtered away instead of folding back as inharmonic
// aliases. Up: each input sample followed by M − 1 zeros, times M, through a low-pass; down: the
// same low-pass, keeping every Mth sample. The low-pass is a Chebyshev type I (0.1 dB of ripple)
// of order 8 at 20 kHz, by the bilinear transform with its corner prewarped: an IIR filter, so it
// is minimum phase and delays the signal by a few host samples rather than the dozens a
// linear-phase FIR would. Allocation-free after construction.
#pragma once

#include <array>
#include <cmath>
#include <complex>

#include "phuzzbox/dsp.h"

namespace phuzzbox {

// An even-order Chebyshev type I low-pass as second-order sections, each with unity gain at DC
// (so the cascade's passband ripples between 0 and +ripple dB).
template <int Order> struct ChebyshevLowpass {
  static_assert(Order % 2 == 0, "an even order");
  std::array<Biquad, Order / 2> s;
  void design(double fc, double fs, double rippleDb = 0.1) {
    const double eps = std::sqrt(std::pow(10.0, rippleDb / 10) - 1), v = std::asinh(1 / eps) / Order;
    const double wc = TAU * fc;
    for (int k = 0; k < Order / 2; k++) {
      // the analog prototype's poles −sinh(v) sin θ ± j cosh(v) cos θ, θ = (2k + 1)π / (2n)
      const double th = PI * (2 * k + 1) / (2.0 * Order);
      const double re = -std::sinh(v) * std::sin(th) * wc, im = std::cosh(v) * std::cos(th) * wc;
      const double w2 = re * re + im * im; // |p|²: H(s) = |p|² / (s² − 2 Re(p) s + |p|²)
      s[k] = bilinear({0, 0, w2, 1, -2 * re, w2}, fs, fc);
    }
  }
  double run(double x) { for (auto &q : s) x = q.run(x); return x; }
  void reset() { for (auto &q : s) q.reset(); }
  // the response at frequency f (Hz), for the filter's own sampling rate fs
  std::complex<double> response(double f, double fs) const {
    const std::complex<double> z1 = std::polar(1.0, -TAU * f / fs);
    std::complex<double> h = 1;
    for (const auto &q : s) h *= (q.b0 + q.b1 * z1 + q.b2 * z1 * z1) / (1.0 + q.a1 * z1 + q.a2 * z1 * z1);
    return h;
  }
};

class Oversampler {
 public:
  // fs: the host's rate; factor M ≥ 1 (1: no filtering at all)
  void setup(double fs, int factor) {
    M = factor < 1 ? 1 : factor;
    const double fc = std::fmin(20000.0, 0.42 * fs);
    up.design(fc, fs * M);
    down.design(fc, fs * M);
    reset();
  }
  void reset() { up.reset(); down.reset(); }
  int factor() const { return M; }
  // the M samples at the high rate that follow input x
  double upsample(double x, int m) { return M == 1 ? x : up.run(m == 0 ? M * x : 0.0); }
  // feed one high-rate sample to the decimator; the host's sample is the one fed last (m = M − 1)
  double downsample(double y) { return M == 1 ? y : down.run(y); }
  // the round trip's group delay at low frequencies, in host samples (what latency() reports)
  double delay(double fs) const {
    if (M == 1) return 0;
    const double f1 = 200, f2 = 400, F = fs * M;
    const auto ph = [&](double f) { return std::arg(up.response(f, F) * down.response(f, F)); };
    // the host's sample is taken M − 1 high-rate samples after the input's: that much less delay
    return ((ph(f1) - ph(f2)) / (TAU * (f2 - f1)) * F - (M - 1)) / M;
  }

 private:
  int M = 1;
  ChebyshevLowpass<8> up, down;
};

} // namespace phuzzbox
