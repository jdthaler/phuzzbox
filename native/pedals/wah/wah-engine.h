// wah-engine.h — the Wah as an effect: its circuit (wah-model.h) solved sample by sample by the
// nodal DK method (phuzzbox/dk.h), the transistors' junctions by Newton. The rocker glides to
// where it is told over about 10 ms, so a MIDI pedal's 128 steps do not zipper.
//
// Plugged in backwards (Reversed), a second circuit plays: the bass drives the output jack. Its
// input is the voltage recorded at the interface; the bass behind it is a Norton source at the
// jack, the current that, into everything the recording saw (the coil, the capacitances, the
// pots, the interface), makes that voltage. The same current drives the wah's output jack.
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

  // the circuit plugged in the right way round, and backwards; `circuit` is the one playing
  std::unique_ptr<phuzzbox::dk::Circuit> forward, back;
  phuzzbox::dk::Circuit *circuit = nullptr;
  Parts parts{}, backParts{};
  double P[kParamCount] = {};
  double a = 0.5, aTarget = 0.5; // the wiper, and where the rocker is taking it
  double supply = 8.15;          // the supply's voltage, gliding to the Supply knob's
  double gain = 1, mix = 0; // the level, and the clean blend
  bool started = false, reversed_ = false;
  // the recording's copy of the bass's circuit, driven by the recorded voltage (backwards only)
  Recording rec{};
  double recIL = 0, recV = 0, recIC = 0;
  static constexpr int SUB = 32; // samples between the wiper's moves

 private:
  void applyParts();
  void settle();
};

} // namespace wah
