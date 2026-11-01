// blackhole-engine.h — the Black Hole as an effect: the signal perturbs a Kerr hole, and each of its
// quasinormal modes rings with it (blackhole-model.h); the left channel is h₊, the right h×.
#pragma once

#include <complex>

#include "phuzzbox/effect.h"
#include "blackhole-model.h"
#include "blackhole-params.h"

namespace blackhole {

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  double tail() const override { return 10; }

  static constexpr int MODES = 4; // (2,2,0), (2,1,0), (3,3,0), (4,4,0)
  struct Mode {
    int l = 0, m = 0, n = 0;
    double f = 0, gamma = 0, Q = 0, amp = 0; // Hz, 1/s, πf/γ, the merger's amplitude
    double plus = 0, cross = 0;               // h₊ = plus·Re ζ, h× = cross·Im ζ
    bool on = false;                          // below 0.45 fs
  };
  Mode mode[MODES];
  double a = 0, gain = 1; // the spin; the detector's volts per strain, with the driver's strain per volt

 private:
  double P[kParamCount] = {};
  std::complex<double> p[MODES], z[MODES];
};

} // namespace blackhole
