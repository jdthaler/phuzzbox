// rubens-engine.h — Rubens' Tube as an effect. The bass, through the amplifier's 5 Hz coupling and
// times the Drive, drives the speaker's voice coil; the cone and the pipe's modes (rubens-model.h)
// are integrated together by the trapezoidal rule, which keeps a passive system passive: each step
// is linear in the cone's new velocity, which one division finds. The modes' frequencies are
// prewarped, so that each rings where it should. The microphone hears the pressure at its place,
// p0 + Σ qn cos(nπ xm/L), in volts at 1 mV/Pa, times the Level.
#pragma once

#include "rubens-model.h"
#include "rubens-params.h"
#include "phuzzbox/effect.h"

namespace rubens {

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  double tail() const override;

  static constexpr double kMic = 0.001; // the microphone's sensitivity (V/Pa)
  const Parts &room() const { return pp; }

 private:
  Parts pp{};
  int modes = 0;
  // each mode's step: [q w]new = M [q w] + g (v new + v old)
  double m11[kMaxModes + 1] = {}, m12[kMaxModes + 1] = {}, m21[kMaxModes + 1] = {}, m22[kMaxModes + 1] = {};
  double gq[kMaxModes + 1] = {}, gw[kMaxModes + 1] = {};
  double q[kMaxModes + 1] = {}, w[kMaxModes + 1] = {};
  double weight[kMaxModes + 1] = {}, weightWant[kMaxModes + 1] = {};
  double G = 0, denom = 0, Kt = 0, Rt = 0, force = 0;
  double xi = 0, v = 0, Q = 0, u = 0;           // the cone, the modes' sum at it, the amplifier's last volts
  double hp = 0, hpx = 0, hpA = 0;               // the amplifier's input coupling
  double driveNow = 0, levelNow = 0, glide = 0;  // the Drive and the Level, gliding over 20 ms
  int sinceFlush = 0;
  bool fresh = true;
};

} // namespace rubens
