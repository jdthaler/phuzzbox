// rotary-model.h — the Rotary Speaker's physics: a horn and a drum turning in a cabinet, heard by two
// microphones in the plane they turn in.
//
//   in ─► crossover ─┬─ high ─► horn: its mouth at r_h, turning at ω_h ─┬─► mic L, mic R ─► level
//                    └─ low ──► drum: its opening at r_d, turning at ω_d ┘
//
// Each rotor is a source moving on a circle. A microphone at M hears at time t what the source sent
// at the retarded time t_e, when it was |M − X(t_e)| away: t − t_e = |M − X(t_e)| / c. Solved each
// sample (by six steps of fixed-point iteration, which converges since the source moves far slower than sound),
// it gives the Doppler shift exactly: the pitch rises as the source comes toward the microphone and
// falls as it goes away, f' = f / (1 + v_r/c) for its speed v_r away from the microphone when it
// sent the sound. The level falls as 1/distance.
//
// Each source radiates as a rigid circular piston of radius a in a baffle, along the rotor's
// radius: at an angle θ off its axis, 2 J1(x)/x with x = k a sin θ, k = 2πf/c, and behind it (θ past
// 90°) what it sends sideways. So a wavelength much longer than the mouth spreads out every way, and
// a shorter one beams: the high notes come and go as the horn turns. In time, that pattern is the
// piston's impulse response off its axis: each part of the disc arrives as much later as it is
// further along the line to the microphone, so the response is the disc's width at each delay, a
// semicircle a sin θ / c either side, whose transform is exactly 2 J1(x)/x. The engine convolves
// with it, each tap the semicircle's area over that sample, for each of 65 values of sin θ,
// interpolated between.
//
// The motors: each rotor's rate follows the switch's speed with its own time constant (inertia over
// drag). The crossover is second order (Linkwitz–Riley, whose halves sum flat).
#pragma once

#include <cmath>
#include <vector>

namespace rotary {

constexpr double PI = 3.141592653589793;
constexpr double C = 343;           // the speed of sound (m/s), at 20 °C
constexpr double R_MAX = 0.25;      // the largest rotor radius: the sound's flight from it is the latency
constexpr double A_MAX = 0.2;       // the largest mouth: the patterns' longest response
constexpr int NS = 65;              // the patterns' values of sin θ, 0 to 1
// the patterns' half length in samples at a sample rate: the longest semicircle and a sample
inline int halfTaps(double fs) { return (int)std::ceil(A_MAX * fs / 343.0) + 1; }

double j1(double x);                      // the Bessel function J1, by its integral
double piston(double f, double a, double s); // 2 J1(x)/x, x = 2π f a s / c

struct Pattern {
  double a = -1, fs = 0;
  int half = 0, taps = 0;
  std::vector<double> h; // NS × taps, centred on half
  std::vector<int> reach; // each row's nonzero taps, either side of half
  void design(double a, double fs);
  const double *row(int i) const { return h.data() + i * taps; }
};

// the retarded time: for a microphone at (mx, my) and a source on a circle of radius r at angle
// alpha now, turning at w (rad/s), the delay tau (s) until now of the sound heard now, the angle the
// source had then, and the cosine of the angle between its axis and the microphone then
struct Path { double tau, alpha, cosTheta, dist; };
Path retarded(double mx, double my, double r, double alpha, double w, double tau0);

} // namespace rotary
