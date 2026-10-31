// tuner.h — the pitch of a block of a bass's signal, as the page's tuner reads it (shared/tuner.js
// says why, step by step; the two are checked against the same tones):
//
// 1. the period, by normalised autocorrelation over 30–500 Hz on the newest 8192 samples averaged
//    down to about 12 kHz, names the note even when the fundamental is weak;
// 2. the peak of a Hann-windowed Fourier transform within ±3 % of it reads the first partial,
//    which a stiff string's stretched partials would otherwise pull sharp;
// 3. a block that starts before the pluck is cut to the part since the note began, or not read
//    until the note fills half of it.
#pragma once

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <vector>

namespace phuzzbox::tuner {

inline constexpr double kPi = 3.14159265358979323846;

inline double detectPitch(const float *x, size_t len, double fs, double fmin = 30, double fmax = 500) {
  const int lo = (int)std::floor(fs / fmax), hi = (int)std::ceil(fs / fmin);
  const long n = (long)len - hi - 1;
  if (n < hi) return 0;
  double e = 0;
  for (long i = 0; i < n; i++) e += (double)x[i] * x[i];
  if (e / n < 1e-7) return 0; // too quiet to trust
  std::vector<double> r(hi + 2, 0.0);
  double top = 0;
  for (int lag = lo; lag <= hi + 1; lag++) {
    double s = 0, e1 = 0;
    for (long i = 0; i < n; i++) { s += (double)x[i] * x[i + lag]; e1 += (double)x[i + lag] * x[i + lag]; }
    r[lag] = s / std::sqrt(e * e1 + 1e-30);
    if (lag <= hi && r[lag] > top) top = r[lag];
  }
  if (top < 0.6) return 0;
  for (int lag = lo + 1; lag <= hi; lag++) {
    if (r[lag] > 0.9 * top && r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1]) {
      const double a = r[lag - 1], b = r[lag], c = r[lag + 1], d = (a - c) / (2 * (a - 2 * b + c));
      return fs / (lag + d);
    }
  }
  return 0;
}

// |X(f)|² of the Hann-windowed block, by a rotating phasor
inline double power(const float *x, size_t len, const std::vector<double> &w, double f, double fs) {
  const double c = std::cos(2 * kPi * f / fs), s = std::sin(2 * kPi * f / fs);
  double pr = 1, pi = 0, re = 0, im = 0;
  for (size_t i = 0; i < len; i++) {
    const double y = x[i] * w[i];
    re += y * pr; im -= y * pi;
    const double t = pr * c - pi * s; pi = pr * s + pi * c; pr = t;
  }
  return re * re + im * im;
}

inline double refine(const float *x, size_t len, double fs, double f, double span = 0.03) {
  std::vector<double> w(len);
  for (size_t i = 0; i < len; i++) w[i] = 0.5 - 0.5 * std::cos(2 * kPi * i / (len - 1));
  double c = f, step = f * span / 10;
  for (int pass = 0; pass < 3; pass++) {
    double best = c, bp = -1;
    for (int k = -10; k <= 10; k++) { const double g = c + k * step, p = power(x, len, w, g, fs); if (p > bp) { bp = p; best = g; } }
    c = best;
    if (pass < 2) step /= 8;
  }
  const double a = std::log(power(x, len, w, c - step, fs) + 1e-300), b = std::log(power(x, len, w, c, fs) + 1e-300),
               d = std::log(power(x, len, w, c + step, fs) + 1e-300);
  const double den = a - 2 * b + d;
  return den < 0 ? c + step * (a - d) / (2 * den) : c;
}

// the first sample of the part since the note began, or −1 when the note is too new to read
inline long sounding(const float *x, size_t len, double fs) {
  float top = 0;
  for (size_t i = 0; i < len; i++) top = std::max(top, std::abs(x[i]));
  size_t i0 = 0;
  while (i0 < len && std::abs(x[i0]) < 0.1f * top) i0++;
  if (i0 == 0) return 0;
  const size_t start = i0 + (size_t)std::lround(0.005 * fs);
  return start < len && len - start >= len / 2.0 ? (long)start : -1;
}

// the first partial's frequency in hertz, or 0 when there is no steady note
inline double tune(const float *x, size_t len, double fs, size_t coarse = 8192) {
  const int D = std::max(1, (int)std::floor(fs / 12000));
  const float *src = len > coarse ? x + (len - coarse) : x;
  const size_t srcLen = len > coarse ? coarse : len;
  std::vector<float> y(srcLen / D);
  for (size_t i = 0; i < y.size(); i++) { double s = 0; for (int j = 0; j < D; j++) s += src[i * D + j]; y[i] = (float)(s / D); }
  const double f = detectPitch(y.data(), y.size(), fs / D);
  if (!f) return 0;
  const long start = sounding(x, len, fs);
  return start < 0 ? 0 : refine(x + start, len - start, fs, f);
}

} // namespace phuzzbox::tuner
