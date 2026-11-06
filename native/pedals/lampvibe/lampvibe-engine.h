// lampvibe-engine.h — the Lamp Vibe as an effect: the oscillator sets the lamp's voltage, the
// filament heats and cools (lampvibe-model.h), its glow frees electrons in the cells, and the cells
// set four all-pass stages, each a one-pole filter by the bilinear transform (Zavalishin's form),
// prewarped so each stage's corner lands where 1/(2π R C) says. The lamp and the cells run at a
// quarter of the host's rate (their quickest rates are far slower), the stages at the host's.
#pragma once

#include <cstdint>

#include "lampvibe-model.h"
#include "phuzzbox/effect.h"

namespace lampvibe {

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // the lamp as it plays: 5 × (the filament's temperature (K), its current (mA), the glow the cells
  // see relative to the lamp's rating, the cells' resistance (kΩ), the lamp's voltage (V))
  kTrace = 1,
};

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;

 private:
  void control();  // the oscillator, the lamp and the cells, one control step

  static constexpr int kEvery = 4; // host samples per control step
  Parts parts{};
  bool haveParams = false;
  double theta = 0;     // the oscillator's phase (rad)
  double T = 300;       // the filament's temperature (K)
  double nCell = 0;     // the cells' free electrons
  double v = 0, light = 0, rCell = 1e6;
  double s[kStages] = {};             // the stages' integrators
  double G[kStages] = {}, dG[kStages] = {}; // their coefficients now, and their step per sample
  int at = 0;

  int traceEvery = 400, traceAt = 0, traced = 0;
  phuzzbox::Message msg;
};

} // namespace lampvibe
