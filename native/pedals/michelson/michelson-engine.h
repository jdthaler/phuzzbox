// michelson-engine.h — the Michelson Interferometer as an effect: the bass drives the actuator
// (a resonance, as a state-variable filter by the bilinear transform), the air drifts the arm
// (an Ornstein–Uhlenbeck process), and the detector sees the fringes (michelson-model.h), each
// line's cosine averaged over the step by its antiderivative so the folds alias less; all at
// M times the host's rate (phuzzbox/oversample.h; M = 4, 2, 1 at high, medium, low quality).
// Then the detector's coupling capacitor (a 5 Hz high-pass) and the Level.
#pragma once

#include <cstdint>

#include "michelson-model.h"
#include "phuzzbox/effect.h"
#include "phuzzbox/oversample.h"

namespace michelson {

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // the light as it plays: 9 × (the mirror's travel from rest (nm), the air's drift of the arm
  // (nm), the detector's intensity, 0–1), then the fringes' contrast at rest, and the paths'
  // difference at rest (µm)
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

 private:
  double gaussian();     // a normal deviate, for the air (seeded, so a run repeats)
  void design();         // the actuator's and the coupling's coefficients at the current rates
  void settle();         // the decimator's filters settled on the light now

  Parts parts{};
  bool haveParams = false;
  phuzzbox::Oversampler os;
  int latencySamples = 0;
  // the actuator: a state-variable filter's two integrators (Zavalishin's form), and its coefficients
  double ic1 = 0, ic2 = 0, a1 = 0, a2 = 0, a3 = 0;
  double x = 0, opdPrev = 0;
  // the air: the drift now and at the last sample, and its step's decay and kick
  double w = 0, wPrev = 0, airDecay = 0, airKick = 0;
  uint64_t rng = 0x9e3779b97f4a7c15ull;
  double spare = 0;
  bool haveSpare = false;
  // the detector's coupling capacitor: a one-pole high-pass's integrator and coefficient
  double hp = 0, hpG = 0;
  double lastI = 0.5;

  int pointEvery = 36, pointAt = 0, points = 0;
  phuzzbox::Message msg;
};

} // namespace michelson
