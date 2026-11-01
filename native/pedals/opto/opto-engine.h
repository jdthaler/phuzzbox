// opto-engine.h — the Opto Compressor as an effect: the attenuator with the cell's present
// resistance, the driver and the panel, and the cell's electrons stepped on by one sample
// (opto-model.h). The gain changes slowly beside the signal, so no oversampling is needed.
#pragma once

#include "phuzzbox/effect.h"
#include "opto-model.h"
#include "opto-params.h"

namespace opto {

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // every 10 ms: the gain reduction now (dB, ≤ 0), the free electrons n, the traps' fill m/N,
  // the panel's light Λ, the cell's resistance (Ω), the input's and the output's peaks since the
  // last message (V), and the deepest gain reduction since then (dB)
  kCell = 1,
};

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  double tail() const override { return 0; }

  // the state, for the tests and the page
  double n = 0, m = 0, light = 0;

 private:
  double P[kParamCount] = {};
  Model M;
  double makeup = 1, mix = 0, glow = 0, rest = 1;
  int every = 480, at = 0;
  double inPeak = 0, outPeak = 0, deepest = 0;
};

} // namespace opto
