// spring-engine.h — the Spring Reverb as an effect: every spring's modes (spring-model.h), each a
// damped resonator driven by the drive bead's torque and read at the pickup bead.
#pragma once

#include "phuzzbox/effect.h"
#include "spring-model.h"
#include "spring-params.h"

namespace spring {

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  double tail() const override { return 8; }
  void setQuality(phuzzbox::Quality q) override { Effect::setQuality(q); built = -1; setParams(P); }

  // the tank, public for the page and the tests (spring-web.cpp)
  Spring springs[MAX_SPRINGS];
  int count = 0;                 // springs in the tank
  int modes = 0;                 // modes in the bank
  double fMax = 8000;            // the highest mode kept
  // each mode: its spring, number n, frequency (Hz), group velocity (m/s), weight (1/s) and decay σ (1/s)
  int spr[MAX_MODES] = {}, num[MAX_MODES] = {};
  double freq[MAX_MODES] = {}, vel[MAX_MODES] = {}, weight[MAX_MODES] = {}, decay[MAX_MODES] = {};
  // the tank alone: n samples of the drive in, the pickup out
  void tank(const float *x, float *y, int n);

 private:
  static constexpr int W = 8, BLOCK = 128;
  double P[kParamCount] = {};
  Model M;
  int built = -1; double builtWire = 0; // the geometry the bank was built for
  void build();
  void tune();
  // the bank as complex one-poles z ← p·z + c·x, out Re z, W at a time
  alignas(32) float pr[MAX_MODES] = {}, pi[MAX_MODES] = {}, cr[MAX_MODES] = {}, ci[MAX_MODES] = {};
  alignas(32) float zr[MAX_MODES] = {}, zi[MAX_MODES] = {};
  alignas(32) float acc[BLOCK * W] = {};
  float wet[BLOCK] = {};
};

} // namespace spring
