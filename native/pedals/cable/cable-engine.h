// cable-engine.h — the Transatlantic Cable as an effect. An unloaded or coil-loaded line is solved
// as its ladder of sections (cable-model.h), every section's current and voltage at once by the
// trapezoidal rule: a tridiagonal system each sample, factored once when the parameters change.
// Heaviside's distortionless line is solved exactly, as d'Alembert's two waves: delays with a flat
// loss, reflected at each end by the mismatch there.
#pragma once

#include <cstdint>
#include <vector>

#include "cable-model.h"
#include "phuzzbox/effect.h"

namespace cable {

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // the voltage along the line, now: 24 points from the near end to the far end (V), then the
  // far end's
  kAlong = 1,
};

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;

 private:
  void factor();          // the ladder's system, factored for this rate and these parts
  double stepLadder(double u);
  double stepWaves(double u);
  double along(int k) const; // the voltage at the k-th of 24 points along the line
  double read(const std::vector<double> &buf, double back) const; // back: samples behind the newest

  Parts parts{};
  bool haveParams = false;
  // the ladder: its state [i₁, v₁, i₂, v₂, …], the right-hand side's diagonal (its off-diagonals
  // are ±h/2) and it over the pivots, and the left side factored by Thomas's algorithm (the
  // modified super-diagonal and the pivots' reciprocals)
  int n2 = 0;
  std::vector<double> x, qd, qe, cp, inv, rhs;
  double uPrev = 0;
  // the waves: the forward wave launched at the near end and the backward one at the far end
  std::vector<double> fwd, bwd;
  int at = 0, mask = 0;
  double tauS = 0, gammaS = 0, gammaL = 0, lastFar = 0;

  int alongEvery = 1600, alongAt = 0;
  phuzzbox::Message msg;
};

} // namespace cable
