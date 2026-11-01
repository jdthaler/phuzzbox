// echo-engine.h — the Tape Echo as an effect: the tape loop (echo-model.h) a sample at a time.
#pragma once

#include <vector>

#include "phuzzbox/effect.h"
#include "echo-model.h"
#include "echo-params.h"

namespace echo {

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // every 20 ms: the tape's speed now (m/s), the three heads' delays now (s), and the largest
  // g·x the record head saw since the last (where on the tape's curve it is working)
  kState = 1,
  // every 20 ms: where the record head was on the tape at the first of them (m, modulo 1000), the
  // samples between messages, then 24 values of the magnetisation the record head left, each the
  // mean of an equal share of those samples, oldest first (the page draws the tape with them)
  kTape = 2,
};

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  double tail() const override { return 10; }

  double step(double x);       // one sample: the dry input in, the echo out (before the mix)
  double v = 0.19;             // the motor's speed (m/s), and the tape's with the capstan's waver
  double vTape = 0.19;
  double fir[TAPS] = {};       // the heads' losses
  double recordPeak = 0;

 private:
  double P[kParamCount] = {};
  Model M;
  int N = 0, w = 0;               // the tape: N samples, the record head at w
  std::vector<float> buf;         // what is on the tape
  std::vector<double> pos;        // where on the tape each was written (m)
  double X = 0;                   // the tape that has passed the record head (m)
  double theta = 0;               // the capstan's angle
  int at[3] = {};                 // each head's place in the buffer
  double hist[TAPS] = {};         // the heads' sum, for the FIR
  int hp = 0;
  double designedV = 0, designedD = 0, designedG = 0;
  double fb = 0;                  // the last echo, recorded again
  bool blank = true;              // nothing recorded since the last reset
  double hpS = 0, hpG = 0;        // the coupling RC (a TPT one-pole high-pass)
  int every = 960, tick = 0;
  phuzzbox::Message msg;
  double read(int j, double p);   // head j at tape position p
  void seat(int j);               // head j's place in the buffer, found afresh
  double placed[3] = {-1, -1, -1};// where the heads were seated
  static constexpr int STRIPES = 24;
  phuzzbox::Message tapeMsg;
  double stripe = 0, tapeAt = 0;  // the magnetisation summed so far for the next value, and where it began
  int stripes = 0, inStripe = 0;
 public:
  void redesign();
};

} // namespace echo
