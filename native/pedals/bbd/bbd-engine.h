// bbd-engine.h — the Bucket Brigade as an effect: the filters by the bilinear transform at M times
// the host's rate (phuzzbox/oversample.h; M = 4, 2, 1 at high, medium, low quality), and the clock
// as a phase running on at that rate. Each time it completes a cycle, at whatever fraction of a
// step, the anti-aliased input there (between the steps, by a straight line) is put on the chain
// and the charge N/2 cycles older, through the transfer loss, comes off it and is held. The
// reconstruction filter is fed each step's average of the held voltage, exact for a staircase
// whose steps fall between the steps.
#pragma once

#include "bbd-model.h"
#include "phuzzbox/dsp.h"
#include "phuzzbox/effect.h"
#include "phuzzbox/oversample.h"

namespace bbd {

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // the chain: 28 charges along it, evenly spaced from the input to the output (V), then the clock
  // now (Hz) and the delay now (s)
  kChain = 1,
};

// a third-order Butterworth low-pass: a first-order section and a biquad
struct Butterworth3 {
  phuzzbox::Biquad a, b;
  void design(double fc, double fs);
  double run(double x) { return b.run(a.run(x)); }
  void reset() { a.reset(); b.reset(); }
  void flush() { a.flush(); b.flush(); }
};

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  int latency() const override { return latencySamples; }
  double tail() const override;
  void setQuality(phuzzbox::Quality q) override;

  long ticks = 0; // for the tests: the clock's cycles so far

 private:
  double step(double vin);
  void design();

  Parts parts{};
  bool haveParams = false;
  phuzzbox::Oversampler os;
  int latencySamples = 0;
  double h = 0;
  Butterworth3 aa, recon;
  double lfo = 0.25;       // the triangle's phase (cycles): a quarter in, where it crosses zero rising
  double phase = 0;        // the clock's (cycles)
  double aaLast = 0;       // the anti-aliased input at the start of the step
  double held = 0;         // the chip's output, held
  double wet = 0;          // the reconstruction filter's last output
  static constexpr int kSize = 8192; // the chain, in clock cycles: N/2 + the taps, at most
  double chain[kSize] = {};
  long head = 0;            // where the next charge goes
  double clockNow = 0;

  int postEvery = 2048, postAt = 0;
  phuzzbox::Message msg;
};

} // namespace bbd
