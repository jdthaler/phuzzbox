// sabine-engine.h — Sabine's Room as an effect. The bass is split into the six octave bands
// (complementary: the bands sum back to the bass exactly) and kept for half a second. The direct
// sound and the first 64 reflections (sabine-model.h) are taps on those bands, each with its own
// gain in each band, at its own fractional delay after the direct sound. After them the late sound:
// in each band (a second, steeper set of bands) a feedback delay network, 16 delay lines mixed by a
// Hadamard matrix, each line losing 60 dB in the band's reverberation time (Eyring's, with the air's absorption), its input delayed
// to begin where the 64th reflection leaves off, its output scaled so that its power is the diffuse
// field's, 4π c/V (relative to the direct sound at a metre), at that moment. A change of the room
// fades the taps and the late sound's input over to the new ones in 1024 samples.
#pragma once

#include <vector>

#include "sabine-model.h"
#include "sabine-params.h"
#include "phuzzbox/effect.h"

namespace sabine {

constexpr int kLines = 16;

// the late sound in one band: impulse in, its power per block out (for the tests)
struct Late {
  int m[kLines] = {};          // the lines' delays (samples)
  double g[kLines] = {};       // the gains each line passes per trip
  double kappa = 0;            // the output's scale
};

// one band's feedback delay network: kLines delay lines, read, scaled by their gains, mixed by the
// 16 × 16 Hadamard matrix over 4 (orthogonal: the mixing loses nothing) and written back with the
// input, which each line takes a quarter of, with its sign
class Network {
 public:
  void size(int longest);                 // room for lines up to `longest` samples
  void clear();
  double step(double u, const Late &l);   // the input in, the lines' sum out (before the scale)
 private:
  std::vector<float> lines; // line j at lines[j × stride + t]
  int mask = 0, pos = 0, stride = 0;
};

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  // the room's longest reverberation time: the late sound is 60 dB down by then
  double tail() const override {
    double t = 0;
    for (int b = 0; b < kBands; b++) t = room.eyring(b) > t ? room.eyring(b) : t;
    return t;
  }

  struct Config {
    int taps = 0;
    int delay[kEarly + 1] = {};
    float frac[kEarly + 1] = {};
    float gain[kEarly + 1][kBands] = {};
    float g0[kEarly + 1][kBands] = {}, g1[kEarly + 1][kBands] = {}; // gain × (1 − frac), gain × frac: the two samples' shares
    Late late[kBands];
    int pre = 0;                 // the late sound's input's delay after the direct sound (samples)
  };
  static void configure(const Parts &p, double fs, const int base[kBands][kLines], Config &c, Reflection *scratch);
  const Config &config() const { return cfg[active]; }
  int lineDelay(int b, int j) const { return base[b][j]; }

 private:
  bool sameRoom(const double *a, const double *b) const;
  Parts room{};
  void load(int which);
  double want[kParamCount] = {}, playing[kParamCount] = {};
  bool fresh = true, pending = false, fading = false;
  int active = 0, fadeAt = 0, fadeLen = 1024;
  Config cfg[2];
  int base[kBands][kLines] = {};
  // the band split: lowpasses at the crossovers 177, 354, 707, 1414, 2828 Hz
  double lp[kBands - 1][5] = {}, lpz[kBands - 1][2] = {};
  std::vector<float> hist, dry; // the bands, interleaved: hist[kBands × t + b]
  int mask = 0, w = 0, sinceFlush = 0;
  // the late sound's bands, Butterworth filters of the twelfth order by the bilinear transform: a
  // lowpass to 177 Hz, bandpasses an octave wide between 177 and 2828 Hz, a highpass from 2828 Hz;
  // their powers sum to within 0.4 dB of the input's, and each band is 36 dB down at the next one's centre
  struct Section { double b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0, z1 = 0, z2 = 0; };
  static constexpr int kOrder = 6; // the late bands' Butterworth prototype order (even)
  Section sec[kBands][kOrder];
  int nsec[kBands] = {};
  Network nets[kBands];
  std::vector<Reflection> scratch;
  double levelNow = 1, levelWant = 1, alpha = 0;
  // each band's late sound as played: its lines' gains and its scale glide to the room's as the Level
  // does, so that no line's gain jumps (a jump comes out a trip later as a step in the note)
  Late live[kBands];
  bool gliding = false;
  void settle(); // live = the room's
};

} // namespace sabine
