// octave-engine.h — the Octave Down as an effect: the divider (octave-model.h) a sample at a time.
#pragma once

#include "phuzzbox/effect.h"
#include "octave-model.h"
#include "octave-params.h"

namespace octave {

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // every 10 ms: the frequency the comparator is toggling at (Hz, from its last rising edges; 0
  // when it has stopped), and the flip-flops' states q₁, q₂
  kState = 1,
};

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  double tail() const override { return 0.05; }

  // the divider's state, public for the page's picture of it (octave-web.cpp)
  OnePole t1, t2, o1, o2; // the tracking filter's two sections; the tone filters
  double xf = 0;          // the filtered bass
  int c = -1, q1 = 1, q2 = 1;
  double y1 = 0, y2 = 0;  // the octave paths after the tone filters
  void step(double x);    // one sample of the divider

 private:
  double P[kParamCount] = {};
  Model M;
  int every = 480, at = 0;
  long since = 0, period = 0; // samples since the comparator last rose, and between its last two rises
  phuzzbox::Message msg;
};

} // namespace octave
