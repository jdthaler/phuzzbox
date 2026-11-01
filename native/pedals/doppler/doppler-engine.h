// doppler-engine.h — the Doppler as an effect: a source plays the signal as it passes the listener,
// pass after pass, and each ear hears it at its retarded times (doppler-model.h), the field of a
// moving point source integrated over each output sample.
#pragma once

#include <cstdint>
#include <vector>

#include "phuzzbox/effect.h"
#include "doppler-model.h"
#include "doppler-params.h"

namespace doppler {

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // every 20 ms, the newest pass: time from its middle (s), its length T (s), v, u (m/s), d (m), c (m/s)
  kPass = 1,
};

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  double tail() const override { return 12; }

  // the pass the controls make now (the next pass takes it)
  Pass next() const;

  static constexpr int MAXP = 16; // passes heard at once, at most

 private:
  struct Live {
    Pass p;
    int64_t start = 0;            // its first sample
    double Tmid = 0, reach = 0;   // its middle and how long its sound can take, in samples
    int count[2] = {};            // each ear's roots at the last sample boundary
    double D[2][2] = {};          // and their delays (samples)
    bool on = false;
  };
  double P[kParamCount] = {};
  std::vector<float> buf;          // the input, a ring
  int64_t mask = 0, n = 0, nextStart = 0;
  Live live[MAXP];
  int cadence = 960, tick = 0;
  phuzzbox::Message msg;

  void begin(int64_t at);
  double integral(double a, double b) const; // ∫ of the input, linearly interpolated, from sample a to b
  double hear(Live &q, int ear, double e);   // what an ear hears from a pass over the sample ending at n + 1
};

} // namespace doppler
