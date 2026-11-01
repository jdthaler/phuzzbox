// cabinet-engine.h — the Speaker Cabinet as an effect: one driver and its share of the box
// (cabinet-model.h) integrated by the classical Runge–Kutta method, a sample a step (or several
// when the coil's L/R is short against a sample), its sound N times over at the microphone.
#pragma once

#include "phuzzbox/effect.h"
#include "cabinet-model.h"
#include "cabinet-params.h"

namespace cabinet {

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // every 40 ms: the cone's excursion every 2 ms (20 values, m), the largest excursion since the
  // last message (m), and the port air's fastest speed (m/s)
  kCone = 1,
};

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  double tail() const override { return 0.2; }

  State st;

 private:
  double P[kParamCount] = {};
  Model M;
  int sub = 1;
  int every = 96, at = 0, points = 0;
  double xPeak = 0, upPeak = 0;
  phuzzbox::Message msg;
};

} // namespace cabinet
