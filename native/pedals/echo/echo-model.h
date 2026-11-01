// echo-model.h — the Tape Echo's physics: a loop of tape, a record head, three playback heads.
//
//   in ─┬──────────────────────────────────────────────────────────── × dry ─┐
//       └─► + ─► coupling RC ─► record head ─► tape (anhysteretic) ──┐       ├─► level ─► out
//           ▲                                  4, 8, 12 cm later      │       │
//           └──── × repeats ◄── head losses ◄── playback heads 1–3 ◄──┘ × echo┘
//
// The tape moves at the capstan's speed v, which follows the Tape speed knob as the motor and its
// flywheel come up to speed (time constant 0.25 s) and wavers once a turn of an eccentric capstan:
// v(1 + (e/r) cos θ), r = 2.5 mm. Each sample is written at the tape's position X; a playback head
// d along reads the tape that was written at X − d, so its echo is d/v later, and a change of speed
// bends the pitch of what is already on the tape.
//
// Recording: with an ideal AC bias, the tape keeps the anhysteretic magnetisation of its field,
// the Langevin function of Jiles and Atherton's model, M = M_s (coth(H/a) − a/H). The record level
// sets H/a for a volt; the playback is normalised so a small signal comes back at the level it went
// in: m(x) = (3/g) L(g x), g = 10^(record/20) per volt.
//
// Playback: the heads hear the tape's field through three losses at the wavenumber k = 2πf/v
// (Bertram; the form of Chowdhury's tape model):
//
//   spacing e^{−kd},  thickness (1 − e^{−kδ})/(kδ),  gap sin(kg/2)/(kg/2)
//
// for a head riding d from the tape, a coating δ = 8 µm thick, and a gap g. They are one linear-phase
// FIR (255 taps) designed from that response at the motor's speed; its 127-sample latency is taken
// out of the heads' delays.
#pragma once

#include <cmath>

namespace echo {

constexpr double PI = 3.141592653589793;
constexpr double HEAD[3] = {0.04, 0.08, 0.12}; // the playback heads, metres after the record head
constexpr double CAPSTAN_R = 2.5e-3;           // the capstan's radius (m)
constexpr double COATING = 8e-6;               // the tape's magnetic coating (m)
constexpr double MOTOR_TAU = 0.25;             // the motor and flywheel's time constant (s)
constexpr double COUPLING_HZ = 20;             // the record amplifier's coupling RC
constexpr int TAPS = 255, HALF = 127;

struct Model {
  double speed = 0.19;
  bool head[3] = {true, true, false};
  double repeats = 0.35, g = 1, spacing = 4e-6, gap = 5e-6, ecc = 3e-6;
  double dry = 1, wet = 0.5, level = 1;
};
Model model(const double *P);

// the Langevin function coth x − 1/x, by its series near 0
inline double langevin(double x) {
  if (std::abs(x) < 1e-2) return x / 3 - x * x * x / 45;
  return 1 / std::tanh(x) - 1 / x;
}
// what the tape keeps of x volts at the record head, normalised to x for small x
inline double tape(double x, double g) { return 3 * langevin(g * x) / g; }

// the playback losses at f for speed v, spacing d and gap g
double losses(double f, double v, double d, double gap);
// the heads' FIR for those, TAPS long
void design(double *h, double v, double d, double gap, double fs);

} // namespace echo
