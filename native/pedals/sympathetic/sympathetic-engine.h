// sympathetic-engine.h — the Sympathetic Strings as an effect: every partial of every string a
// damped resonator driven by the bridge's velocity, summed as the force on the bridge
// (sympathetic-model.h).
#pragma once

#include "phuzzbox/effect.h"
#include "sympathetic-model.h"
#include "sympathetic-params.h"

namespace sympathetic {

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // every 40 ms: each string's energy now (its modes' |z|², scaled to the loudest possible)
  kStrings = 1,
};

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  double tail() const override { return 20; }

  int strings = 0, modes = 0;
  String string[MAX_STRINGS];
  // each mode: its string, partial number, frequency (Hz), decay rate (1/s), coupling (N per m/s)
  int ofString[MAX_MODES] = {}, partial[MAX_MODES] = {};
  double freq[MAX_MODES] = {}, decay[MAX_MODES] = {}, coupling[MAX_MODES] = {};
  double gain = 1; // the pickup's volts per newton (with the driver's metres per second per volt)
  double b1 = 0, b3 = 0;

 private:
  static constexpr int W = 8, BLOCK = 128;
  double P[kParamCount] = {};
  int builtKey = -1, builtScale = -1, builtOctave = -1;
  double builtWire = -1;
  void build();
  void tune();
  alignas(32) float pr[MAX_MODES] = {}, pi[MAX_MODES] = {}, b[MAX_MODES] = {}, e[MAX_MODES] = {};
  alignas(32) float zr[MAX_MODES] = {}, zi[MAX_MODES] = {};
  alignas(32) float acc[BLOCK * W] = {};
  double cc[MAX_MODES] = {}, rr[MAX_MODES] = {}, ww[MAX_MODES] = {}; // build()'s scratch
  int order[MAX_MODES] = {};
  float wet[BLOCK] = {};
  int every = 1920, tick = 0;
  phuzzbox::Message msg;
};

} // namespace sympathetic
