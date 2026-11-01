// wah-engine.h — the Wah as an effect: its circuit (wah-model.h) solved sample by sample by the
// nodal DK method (phuzzbox/dk.h), the transistors' junctions by Newton. The rocker glides to
// where it is told over about 10 ms, so a MIDI pedal's 128 steps do not zipper.
#pragma once

#include <memory>

#include "phuzzbox/dk.h"
#include "phuzzbox/effect.h"
#include "wah-model.h"
#include "wah-params.h"

namespace wah {

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  double tail() const override { return 0.1; }

  std::unique_ptr<phuzzbox::dk::Circuit> circuit;
  Parts parts{};
  double P[kParamCount] = {};
  double a = 0.5, aTarget = 0.5; // the wiper, and where the rocker is taking it
  double supply = 8.15;          // the supply's voltage, gliding to the Supply knob's
  double gain = 1, mix = 0; // the level, and the clean blend
  bool started = false;
  static constexpr int SUB = 32; // samples between the wiper's moves

  // Auto: the envelope follower, a capacitor charged from the full-wave rectified input through
  // the attack resistor (while the input is above it: an ideal diode) and always discharged
  // through the decay resistor; its voltage moves the rocker from where it rests.
  double env = 0;   // V: the follower's capacitor
  double rocker = 0.5; // where the follower has the rocker now (0 heel, 1 toe)
  int msgAt = 0;
  phuzzbox::Message msg{};
  static constexpr int kAuto = 1; // message: the rocker and the follower's volts, every 10 ms
};

// the follower's rocker for its voltage v: from where it rests toward the toe (up) or the heel
inline double autoRocker(const double *P, double v) {
  const double e = v / P[sens] < 1 ? v / P[sens] : 1, rest = P[position];
  return P[direction] < 0.5 ? rest + (1 - rest) * e : rest * (1 - e);
}
// one sample of the follower: the exact step of its RC equations with the input held
inline double follow(double v, double in, double ca, double va, double cd) {
  const double r = in < 0 ? -in : in;
  return r > v ? va * r + (v - va * r) * ca : v * cd;
}

} // namespace wah
