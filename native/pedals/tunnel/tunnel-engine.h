// tunnel-engine.h — the Tunnel Diode as an effect: the circuit (tunnel-model.h) at M times the
// host's rate (phuzzbox/oversample.h; M = 4, 2, 1 at high, medium, low quality), its voltage the
// output, through a 5 Hz coupling high-pass.
#pragma once

#include "tunnel-model.h"
#include "phuzzbox/dsp.h"
#include "phuzzbox/effect.h"
#include "phuzzbox/oversample.h"

namespace tunnel {

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // the circuit as it plays: 10 × (the source's voltage Vs, the diode's voltage V, the current
  // through the load i) (V, V, A)
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

  Circuit cx; // for the tests: its evaluations and steps

 private:
  void rest(); // the circuit at rest on the bias, and the filters after it settled there
  Parts p{};
  double biasNow = 0, driveNow = 0, levelNow = 1;
  bool fresh = true; // nothing played since the start or a reset: knobs snap
  phuzzbox::Oversampler os;
  phuzzbox::DCBlock dc;
  int latencySamples = 0;
  double alpha = 0;

  int pointEvery = 48, pointAt = 0, points = 0;
  phuzzbox::Message msg;
};

} // namespace tunnel
