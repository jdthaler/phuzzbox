// phuzz-engine.h — the Phuzz as an effect: the circuit (phuzz-model.h) stepped by the nodal DK
// method at M times the host's rate (phuzzbox/oversample.h; M = 4, 2, 1 at high, medium, low
// quality), from the operating point the battery sets.
//
// The input is the voltage recorded at the interface. The bass behind it is a Norton source at
// the jack: the current that, into everything the recording saw (the coil, the capacitances, the
// pots, the interface's input), makes that voltage. Into the Phuzz's input instead, the same
// current makes whatever the Phuzz's input impedance lets it: the pickup is loaded as it would be.
#pragma once

#include <array>

#include "phuzz-model.h"
#include "phuzzbox/effect.h"
#include "phuzzbox/oversample.h"

namespace phuzz {

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // the transistors as they play: 7 × (V_CE of Q1, I_C of Q1, V_CE of Q2, I_C of Q2), then the
  // rail's voltage (V, negative) and the number of Newton iterations per sample, on average
  kOperatingPoints = 1,
};

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  int latency() const override { return latencySamples; }
  void setQuality(phuzzbox::Quality q) override;

  // for the tests: the Newton iterations so far, and the samples that didn't converge
  long iterations = 0, failures = 0, steps = 0;

 private:
  void rebuild();
  void settle();          // the state at the DC operating point
  double step(double vin); // one sample at the high rate: the voltage at the interface in, the output out

  std::array<double, 64> P{};
  bool haveParams = false;
  Parts parts{};
  DK dk;
  phuzzbox::Oversampler os;
  int latencySamples = 0;

  // the circuit's state: each capacitor's voltage and current, the coil's current and voltage
  std::array<double, 5> vc{}, ic{};
  double iL = 0, vL = 0;
  double v[4] = {}, vPrev[4] = {}, cur[4] = {}; // the junctions (this sample and the one before) and the transistor currents
  // the recording's copy of the bass's circuit, driven by the recorded voltage
  double lastZ[DK::NZ] = {};
  double recIL = 0, recV = 0, recIC = 0, recGl = 0, recRho = 0, recGc = 0;

  // the operating points posted to the page
  int pointEvery = 36, pointAt = 0, points = 0;
  phuzzbox::Message msg;
  long itersSincePost = 0, stepsSincePost = 0;
};

} // namespace phuzz
