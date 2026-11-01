// preamp-engine.h — the Tube Preamp as an effect: its circuit (preamp-model.h) solved sample by
// sample by the nodal DK method (phuzzbox/dk.h), Newton on the three triodes' six port voltages,
// at M times the host's rate (phuzzbox/oversample.h; M = 4, 2, 1 at high, medium, low quality),
// from the operating point the supply sets.
//
// The input is the voltage recorded at the interface. The bass behind it is a Norton source at
// the jack: the current that, into everything the recording saw (the coil, the capacitances, the
// pots, the interface's input), makes that voltage. Into the preamp's 1 MΩ grid leak instead, the
// same current makes whatever that input lets it, as the Phuzz does (phuzz-engine.h).
#pragma once

#include <array>
#include <memory>

#include "phuzzbox/dk.h"
#include "phuzzbox/effect.h"
#include "phuzzbox/oversample.h"
#include "preamp-model.h"
#include "preamp-params.h"

namespace preamp {

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // the triodes as they play: 4 × (V1a's plate-to-cathode voltage and plate current, V2a's, the
  // cathode follower's), then the rail D's voltage, the Newton iterations per sample on average,
  // and the largest grid current any triode drew since the last message (A)
  kTubePoints = 1,
};

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  int latency() const override { return latencySamples; }
  double tail() const override { return 0.05; }
  void setQuality(phuzzbox::Quality q) override;

  // for the tests: the Newton iterations so far, the samples that didn't converge, the samples
  long iterations = 0, failures = 0, steps = 0;

 private:
  void rebuild();          // a new circuit at the running rate
  void settle();           // the state at the DC operating point
  double step(double vin); // one sample at the high rate: the voltage at the interface in, the output out

  double P[kParamCount] = {};
  bool haveParams = false;
  std::unique_ptr<phuzzbox::dk::Circuit> circuit;
  Parts parts{};
  phuzzbox::Oversampler os;
  int latencySamples = 0;
  double u[2] = {}, y[4] = {};

  // the recording's copy of the bass's circuit, driven by the recorded voltage
  Recording rec{};
  double recIL = 0, recV = 0, recIC = 0;

  // the triodes' points posted to the page
  int pointEvery = 36, pointAt = 0, points = 0;
  phuzzbox::Message msg;
  long itersSincePost = 0, stepsSincePost = 0;
  double gridPeak = 0;
};

} // namespace preamp
