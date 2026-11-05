// ringmod-engine.h — the Ring Modulator as an effect: the ring (ringmod-model.h) solved by Newton
// at every step, at M times the host's rate (phuzzbox/oversample.h; M = 4, 2, 1 at high, medium,
// low quality), its two transformers' magnetising inductances by the trapezoidal rule, and the
// carrier from an oscillator whose phase runs on at the high rate.
#pragma once

#include "ringmod-model.h"
#include "phuzzbox/effect.h"
#include "phuzzbox/oversample.h"

namespace ringmod {

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // the ring as it plays: 4 × (the carrier's voltage, u, w, and the four diodes' currents), then
  // the Newton iterations per step, on average, and the carrier's frequency (Hz)
  kPoints = 1,
};

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  int latency() const override { return latencySamples; }
  void setQuality(phuzzbox::Quality q) override;

  // for the tests: Newton's iterations so far, the steps that didn't converge, and the steps
  long iterations = 0, failures = 0, steps = 0;

 private:
  double step(double vin); // one step at the high rate: the input in, the output out

  Parts parts{};
  bool haveParams = false;
  phuzzbox::Oversampler os;
  int latencySamples = 0;
  double h = 0;           // the step (s)
  double phase = 0;       // the carrier's, in cycles
  Ring ring, last, before; // this step's, the last two steps' solutions
  double iL1 = 0, iL2 = 0; // the transformers' magnetising currents

  int pointEvery = 48, pointAt = 0, points = 0;
  phuzzbox::Message msg;
  long itersSincePost = 0, stepsSincePost = 0;
};

} // namespace ringmod
