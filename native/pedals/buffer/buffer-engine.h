// buffer-engine.h — the Buffer as an effect: the circuit's filter (buffer-model.h), discretised by
// the matched-z transform (phuzzbox/dsp.h), so both circuits' resonances ring exactly.
#pragma once

#include "phuzzbox/dsp.h"
#include "phuzzbox/effect.h"

namespace buffer {

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs) : Effect(fs) {}
  void setParams(const double *P) override;
  void reset() override { filter.reset(); }
  void process(const float *in, float *L, float *R, int n) override;

  phuzzbox::Biquad filter;
  double gain = 1;
};

} // namespace buffer
