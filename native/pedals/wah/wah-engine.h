// wah-engine.h — the Wah as an effect: its circuit (wah-model.h) solved sample by sample by the
// nodal DK method (phuzzbox/dk.h), the transistors' junctions by Newton. The rocker glides to
// where it is told over about 10 ms, so a MIDI pedal's 128 steps do not zipper.
#pragma once

#include <memory>

#include "phuzzbox/dk.h"
#include "phuzzbox/effect.h"
#include "wah-model.h"
#include "wah-params.h"

namespace wah {

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  double tail() const override { return 0.1; }

  std::unique_ptr<phuzzbox::dk::Circuit> circuit;
  Parts parts{};
  double P[kParamCount] = {};
  double a = 0.5, aTarget = 0.5; // the wiper, and where the rocker is taking it
  double supply = 8.15;          // the supply's voltage, gliding to the Supply knob's
  double gain = 1, mix = 0; // the level, and the clean blend
  bool started = false;
  static constexpr int SUB = 32; // samples between the wiper's moves
};

} // namespace wah
