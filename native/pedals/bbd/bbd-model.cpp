// bbd-model.cpp — the Bucket Brigade's circuit (bbd-model.h).

#include "bbd-model.h"

#include <algorithm>
#include <cmath>

#include "bbd-params.h"

namespace bbd {

namespace {
constexpr double kPi = 3.14159265358979323846;
const int kStages[4] = {512, 1024, 2048, 4096};
} // namespace

Parts parts(const double *P) {
  Parts p{};
  p.stages = kStages[std::clamp((int)std::lround(P[stages]), 0, 3)];
  p.clock = P[clock];
  p.rate = P[rate];
  p.depth = P[depth];
  p.feedback = P[feedback];
  p.mix = P[mix];
  p.gain = std::pow(10.0, P[level] / 20);
  p.eps = std::clamp(P[cti], 0.0, 0.01);
  p.corner = P[filter];
  // the negative binomial's terms, by p_m = p_(m−1) ε (N + m − 1)/m, until the tail is under 1e-9
  const double N = p.stages;
  double term = std::pow(1 - p.eps, N), sum = 0;
  int m = 0;
  for (; m < kMaxTaps; m++) {
    if (m) term *= p.eps * (N + m - 1) / m;
    p.p[m] = term;
    sum += term;
    if (1 - sum < 1e-9) { m++; break; }
  }
  p.taps = m;
  for (int k = 0; k < p.taps; k++) p.p[k] /= sum; // what the tail held, spread so DC passes whole
  return p;
}

std::complex<double> transfer(const Parts &p, double f, double fc) {
  const std::complex<double> z1 = std::polar(1.0, -2 * kPi * f / fc);
  return std::pow((1 - p.eps) / (1.0 - p.eps * z1), (double)p.stages);
}

std::complex<double> butterworth(double f, double fc) {
  const std::complex<double> s(0, f / fc);
  return 1.0 / ((s + 1.0) * (s * s + s + 1.0));
}

std::complex<double> chip(const Parts &p, double f, double fc) {
  const double x = kPi * f / fc;
  const double sinc = x == 0 ? 1 : std::sin(x) / x;
  // the hold: sinc(f/fc), centred half a cycle late; then N/2 cycles in the chain
  const std::complex<double> delay = std::polar(1.0, -2 * kPi * f * (0.5 + p.stages / 2.0) / fc);
  return butterworth(f, p.corner) * sinc * transfer(p, f, fc) * delay * butterworth(f, p.corner);
}

std::complex<double> response(const Parts &p, double f) {
  const std::complex<double> H = chip(p, f, p.clock);
  return (1 - p.mix) + p.mix * H / (1.0 - p.feedback * H);
}

} // namespace bbd
