// rotary-engine.h — the Rotary Speaker as an effect: two rotors (rotary-model.h) a sample at a time.
#pragma once

#include <vector>

#include "phuzzbox/effect.h"
#include "rotary-model.h"
#include "rotary-params.h"

namespace rotary {

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // every 20 ms: the horn's and the drum's angles (rad) and rates (Hz) now; then, for the horn and
  // the drum at the left and right microphones, the pitch each is heard at now over the pitch it
  // sent (the Doppler factor); its level there from its distance alone (1 at the microphone's
  // distance); and sin θ for the angle it faced (1 behind it), whose pattern sets each pitch's level
  kState = 1,
};

struct Rotor {
  double r = 0.15, a = 0.04;        // its radius and its mouth's
  double w = 0, slow = 0, fast = 0;  // its rate now and the switch's two (rad/s)
  double tau = 1;                    // its spin-up time constant
  double alpha = 0;                  // its angle now
  Pattern pattern;
  float buf[2048] = {};              // what it was sent, for the delays
  std::vector<double> hist[2];       // what each microphone heard of it, twice over (a mirrored
  int hp = 0;                        // ring, so the pattern's taps read it in one run)
  double lastTau[2] = {0, 0};
  double doppler[2] = {1, 1}, gain[2] = {1, 1}, sin[2] = {0, 0};
};

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  int latency() const override { return lat; }
  double tail() const override { return 0.02; }

  Rotor horn, drum;

 private:
  double P[kParamCount] = {};
  double mic[2][2] = {};            // the microphones' places (m)
  double dist = 1, offset = 0;      // their distance, and the flight taken out of every path (s)
  double gHorn = 1, gDrum = 1, gOut = 1;
  double lpA[5] = {}, lpS[1][2] = {}; // the crossover: a biquad for each half
  double hpA[5] = {}, hpS[1][2] = {};
  int w = 0, lat = 0, half = 0, every = 960, tick = 0;
  bool blank = true;
  phuzzbox::Message msg;
  double hear(Rotor &q, int m, double ww);
  double biquad(const double *a, double *s, double x);
};

} // namespace rotary
