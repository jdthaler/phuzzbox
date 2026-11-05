// neon-engine.h — the Neon Tremolo as an effect: the oscillator advanced exactly each sample
// (neon-model.h), the lamp's light the charge that passed through it, the cell's electrons by
// Heun's method, and the bass through the divider the cell makes. Everything moves far slower than
// the bass, so nothing is oversampled.
#pragma once

#include <cstdint>

#include "neon-model.h"
#include "phuzzbox/effect.h"

namespace neon {

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // the lamp as it plays, 240 times a second: 5 × (the capacitor's voltage (V), the lamp's largest
  // current since the last (mA), the cell's resistance (kΩ), the divider's gain (dB))
  kTrace = 1,
};

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;

 private:
  Parts parts{};
  bool haveParams = false;
  Osc osc;
  double nCell = 0, rCell = kRdark, g = 1;

  int traceEvery = 200, traceAt = 0, traced = 0;
  double peak = 0;
  phuzzbox::Message msg;
};

} // namespace neon
