// bandgap-engine.h — the Bandgap as an effect: the circuit (bandgap-model.h) stepped by TR-BDF2
// (a trapezoidal stage, then a second-order backward difference: second-order accurate and
// L-stable, so the op-amp's loop and the diodes, far faster than a sample, settle instead of
// ringing at the Nyquist frequency) with Newton on all four states, at M times the host's rate
// (phuzzbox/oversample.h; M = 4, 2, 1 at high, medium, low quality).
#pragma once

#include "bandgap-model.h"
#include "phuzzbox/effect.h"
#include "phuzzbox/oversample.h"

namespace bandgap {

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // the diodes and the op-amp as they play: 7 × (the diodes' voltage, their current, the op-amp's
  // output, its input error over Vs: past ±1 it is slewing), then the rail (V) and the Newton
  // iterations per step, on average
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
  double step(double vin); // one step at the high rate: the input in, the diodes' voltage out
  bool solve(double *y, double a, const double *r, double vin, int &its); // y − a f(y) = r

  Parts parts{};
  bool haveParams = false;
  phuzzbox::Oversampler os;
  int latencySamples = 0;
  double h = 0;               // the step (s)
  double y[4] = {}, yPrev[4] = {}, f0[4] = {}; // the state and its derivatives at the start of the step
  double lastIn = 0, id = 0;

  int pointEvery = 36, pointAt = 0, points = 0;
  phuzzbox::Message msg;
  long itersSincePost = 0, stepsSincePost = 0;
};

} // namespace bandgap
