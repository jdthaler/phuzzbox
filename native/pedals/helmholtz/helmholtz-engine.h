// helmholtz-engine.h — Helmholtz's Resonators as an effect. All ten resonators (helmholtz-model.h)
// ring all the time, each a state-variable filter (Zavalishin's, its frequency prewarped, its
// trapezoidal integrators keeping it passive as its knobs move): the pressure inside for the pressure
// outside, which is your bass. You hear the one at your ear, the others fading out over 20 ms as the
// Resonator steps, with the bass as it is at your other ear, times the Level.
#pragma once

#include "helmholtz-model.h"
#include "helmholtz-params.h"
#include "phuzzbox/effect.h"

namespace helmholtz {

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  double tail() const override;

  const Parts &room() const { return pp; }

 private:
  Parts pp{};
  double g[kCount] = {}, k[kCount] = {};          // each filter's tan(π f0/fs) and 1/Q
  double s1[kCount] = {}, s2[kCount] = {};        // its integrators
  double gain[kCount] = {}, earNow = 0, levelNow = 0, glide = 0;
  int sinceFlush = 0;
  bool fresh = true;
};

} // namespace helmholtz
