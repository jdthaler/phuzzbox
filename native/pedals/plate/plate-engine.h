// plate-engine.h — the Plate Reverb as an effect: the plate's modes (plate-model.h), each a damped
// resonator driven at the driver and read at the two pickups.
//
// Played at two rates: the modes up to 0.09 fs at a quarter of the sample rate, the ones above
// at half, between linear-phase lowpass filters that bring the driver's signal down to each rate
// and the pickups' back up. Each mode is the same sampled impulse response at any rate; what the
// filters cost is a short delay of the wet signal (`delay`, about 1.8 ms at 48 kHz), and the
// modes cost a quarter as much.
#pragma once

#include "phuzzbox/effect.h"
#include "plate-model.h"
#include "plate-params.h"

namespace plate {

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // every 40 ms: the 15 modes moving most now, as (m + 1000 n, their velocity's real part) pairs,
  // for the page's picture of the plate
  kModes = 1,
};

// A linear-phase lowpass (Kaiser window, 70 dB) at the higher of two rates a factor 2 apart: it
// takes a signal down (keeping every other sample) and back up (zeros between, gain 2).
struct Lowpass {
  static constexpr int MAXT = 63;
  int taps = 1;
  double h[MAXT] = {1};
  void design(double pass, double stop, double rate);
};
struct Down {
  const Lowpass *f = nullptr;
  double hist[2 * Lowpass::MAXT] = {};
  int at = 0, phase = 0;
  void clear();
  // push one sample at the high rate; true, with out set, when a sample at the low rate is due
  bool push(double x, double &out);
};
struct Up {
  const Lowpass *f = nullptr;
  double hist[2 * Lowpass::MAXT] = {};
  int at = 0;
  void clear();
  // one sample at the high rate, from the low rate's sample when one is due (else 0)
  double push(double x);
};

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void setQuality(phuzzbox::Quality q) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  double tail() const override { return 12; }

  int modes = 0, low = 0;  // the modes, the first `low` of them played at fs/4, the rest at fs/2
  int delay = 0;           // samples by which the filters delay the plate's sound
  double top = 0;          // the highest mode played (Hz)
  // each mode: its numbers, frequency (Hz) and decay rate (1/s)
  int mm[MAX_MODES] = {}, nn[MAX_MODES] = {};
  double freq[MAX_MODES] = {}, decay[MAX_MODES] = {};
  double gain = 1;  // the transducers: a volt in, a volt out (plate-engine.cpp)
  // the plate alone, n ≤ 128 samples of the driver in, the pickups out
  void run(const float *x, float *yl, float *yr, int n);

 private:
  static constexpr int W = 8, BLOCK = 128;
  double P[kParamCount] = {};
  double builtTop = -1;
  void build();
  void tune();
  // the modes from..to, n samples at rate fs/D
  void bank(int from, int to, const float *x, float *yl, float *yr, int n);
  alignas(32) float pr[MAX_MODES] = {}, pi[MAX_MODES] = {}, b[MAX_MODES] = {}, e[MAX_MODES] = {};
  alignas(32) float wl[MAX_MODES] = {}, wr[MAX_MODES] = {};
  alignas(32) float zr[MAX_MODES] = {}, zi[MAX_MODES] = {};
  alignas(32) float accL[BLOCK * W] = {}, accR[BLOCK * W] = {};
  double shapeD[MAX_MODES] = {}, shapeL[MAX_MODES] = {}, shapeR[MAX_MODES] = {};
  Lowpass f1, f2;  // fs ↔ fs/2, fs/2 ↔ fs/4
  Down d1, d2;
  Up u1[2], u2[2];
  float align[2 * Lowpass::MAXT] = {}; // the fs/2 modes' input, delayed to meet the fs/4 modes'
  int alignAt = 0, alignLen = 0;
  float in2[BLOCK] = {}, in4[BLOCK] = {}, y2[2][BLOCK] = {}, y4[2][BLOCK] = {};
  bool due2[BLOCK] = {}, due4[BLOCK] = {};
  float wetL[BLOCK] = {}, wetR[BLOCK] = {};
  int every = 1920, tick = 0;
  phuzzbox::Message msg;
};

} // namespace plate
