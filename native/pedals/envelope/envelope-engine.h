// envelope-engine.h — the Envelope Filter as an effect: the follower and the cells (envelope-model.h)
// a sample at a time, and the state-variable filter by the trapezoidal rule (the bilinear
// transform of its circuit), its integrators' resistance taken from the cells every sample.
#pragma once

#include "phuzzbox/effect.h"
#include "envelope-model.h"
#include "envelope-params.h"

namespace envelope {

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // every 10 ms: the cutoff (Hz), the follower (V), the LED (mA), the cells' free electrons n,
  // their traps' fill m/N, and a cell's resistance (Ω)
  kState = 1,
};

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  double tail() const override { return 0.5; }

  // the state: the follower's capacitor, the cells' electrons, the integrators
  double env = 0, n = 0, m = 0, s1 = 0, s2 = 0;

 private:
  double P[kParamCount] = {};
  Model M;
  int every = 480, at = 0;
  bool started = false;
  phuzzbox::Message msg;
};

} // namespace envelope
