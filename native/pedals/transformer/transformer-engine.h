// transformer-engine.h — the Output Transformer as an effect: the output stage and its transformer
// (transformer-model.h) at M times the host's rate (phuzzbox/oversample.h; M = 2, 1, 1 at high,
// medium, low quality). The output is the speaker's voltage scaled back to the input's, so that with
// an ideal core the pedal would pass your bass unchanged: the primary's voltage over Drive × Vth/Vs.
#pragma once

#include "transformer-model.h"
#include "phuzzbox/dsp.h"
#include "phuzzbox/effect.h"
#include "phuzzbox/oversample.h"

namespace transformer {

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // the core as it plays: 10 × (the field H, the flux density B) (A/m, T)
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

  Transformer tx; // for the tests: its evaluations and steps

 private:
  Parts p{}, now{}; // the knobs, and the parts as they glide toward them
  bool fresh = true; // nothing played since the start or a reset: knobs snap
  phuzzbox::Oversampler os;
  int latencySamples = 0;
  double alpha = 0;

  int pointEvery = 16, pointAt = 0, points = 0;
  phuzzbox::Message msg;
};

} // namespace transformer
