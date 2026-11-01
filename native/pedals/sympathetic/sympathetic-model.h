// sympathetic-model.h — the Sympathetic Strings' physics: steel strings tuned to a scale, each
// pinned at a nut and at one shared bridge, which a driver moves with the signal.
//
// A stiff string, μ ÿ = T y'' − EI y'''', pinned at both ends, has modes sin(k_n x), k_n = nπ/L, at
//
//   f_n = n f₀ √(1 + B n²),  f₀ = (1/2L) √(T/μ),  B = π³ E d⁴ / 64 T L²   (Fletcher)
//
// Move the bridge (x = 0) by u(t) and the string is u(1 − x/L) plus its modes q_n sin(k_n x), driven
// by the bridge's acceleration: q̈_n + 2a_n q̇_n + ω_n² q_n = −(2/nπ) ü. The force the modes put
// on the bridge, (T k_n + EI k_n³) q_n, is for the bridge's velocity v
//
//   F_n = −(2/L)(T + EI k_n²) · s / (s² + 2a_n s + ω_n²) · v
//
// For a string without stiffness the sum over every mode, with the bridge's own −(T/L)u, is the
// string's driving-point force −T k cot(kL) u (the tests check it). The pickup hears Σ F_n.
//
// Each string is tensioned to the same stress, so its wave speed √(σ/ρ) is the same and its length
// sets its note, as a harp's. The losses are Chaigne and Askenfelt's form, a_n = b₁ + b₃ ω_n².
#pragma once

#include <cmath>

namespace sympathetic {

constexpr double PI = 3.141592653589793;
constexpr double E = 2e11, RHO = 7850;         // steel
constexpr double STRESS = 600e6;               // every string's tension over its area (Pa)
constexpr double FMAX = 6000;                  // the highest partial played (Hz)
constexpr int MAX_STRINGS = 12, MAX_PARTIALS = 64, MAX_MODES = MAX_STRINGS * MAX_PARTIALS;
constexpr double F_LOW = 100, F_HIGH = 2000;   // where Sustain and Highs ring hold

struct String {
  double f0 = 0;     // the note (Hz): the fundamental, stiffness and all
  double L = 0, T = 0, mu = 0, EI = 0, B = 0;
  int partials = 0;
  // the n-th partial's frequency (Hz)
  double partial(int n) const { return n * std::sqrt(T / mu) / (2 * L) * std::sqrt(1 + B * n * n); }
};

// a string of diameter d tuned to f (its first partial exactly f)
String tune(double f, double d);
// the 12-TET frequency of a note, semitones from A4 = 440 Hz
inline double noteHz(double semis) { return 440 * std::pow(2.0, semis / 12); }
// b₁ and b₃ for a 100 Hz partial's T60 of `sustain` s and a 2 kHz one's of `highs` s
void losses(double sustain, double highs, double &b1, double &b3);

} // namespace sympathetic
