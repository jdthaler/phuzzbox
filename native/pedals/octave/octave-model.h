// octave-model.h — the Octave Down's physics: the analog octave divider.
//
//   in ──┬──────────────────────────────────────────────────────── × dry ─┐
//        └─► tracking filter: two buffered RC low-passes at f_t ─► x_f    │
//               x_f ─► comparator, hysteresis ±h ─► c (±1)                │
//                        c rising ─► flip-flop 1 ─► q₁ (±1, f/2)          ├─► level ─► out
//                                  q₁ rising ─► flip-flop 2 ─► q₂ (f/4)    │
//               x_f · q₁ ─► tone (RC low-pass) ─────────────────── × oct1 ┤
//               x_f · q₂ ─► tone (RC low-pass) ─────────────────── × oct2 ┘
//
// The switch flips the filtered bass's polarity each time its flip-flop toggles. A flip-flop
// toggles once a cycle (on the comparator's rising edge, x_f passing +h), so x_f·q₁ repeats every
// two cycles: an octave below, with a fundamental of 8/(3π) of the sine's amplitude when h is small
// (its Fourier coefficient). The flips come where x_f is only h from zero, so the switch's steps
// are small.
#pragma once

#include <cmath>

namespace octave {

constexpr double PI = 3.141592653589793;

struct Model {
  double dry = 0.7, oct1 = 0.8, oct2 = 0;
  double track = 250, hyst = 5e-3, tone = 900;
  double level = 1;
};
Model model(const double *P);

// One RC low-pass by the trapezoidal rule (the bilinear transform of its circuit, unwarped):
// the topology-preserving form, a state s.
struct OnePole {
  double g = 0, s = 0;
  void set(double fc, double fs) { const double gg = PI * fc / fs; g = gg / (1 + gg); } // g/(1+g), g = ωT/2
  double run(double x) { const double v = (x - s) * g, y = v + s; s = y + v; return y; }
  void flush() { if (std::abs(s) < 1e-30) s = 0; }
};

} // namespace octave
