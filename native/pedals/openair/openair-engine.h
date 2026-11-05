// openair-engine.h — Open Air as an effect: the bass through a filter that plays the field's
// response, H (openair-model.h), 4096 taps long at 44.1 or 48 kHz (85 ms; 8192 at 88.2 or 96 kHz,
// 16 384 above), long enough for the slow ground wave over soft ground; minimum-phase, so the sound
// begins at once and the pedal has no latency. The filter runs as a partitioned convolution, also
// with no latency: its first B taps (128 at 48 kHz) directly, sample by sample, and the rest in
// partitions of B by FFT, each block's worth worked out at the end of the block before (overlap-save).
// A change of the field designs a new filter at the next block boundary and fades over to it while the
// old one still plays, over 8 blocks.
#pragma once

#include <vector>

#include "openair-model.h"
#include "phuzzbox/effect.h"

namespace openair {

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  double tail() const override { return (double)taps / fs; }

  const std::vector<double> &kernel() const { return h; } // the filter last designed, for the tests
  int size() const { return taps; }
  int designs() const { return designed; }

 private:
  bool sameField(const Parts &a, const Parts &b) const;
  void load(int which);        // design `want` and load it into kernel `which`
  void boundary();             // a block is in: its spectrum, maybe a new kernel, the next block's tails
  Parts want{}, playing{};
  bool fresh = true, pending = false;
  int taps = 4096, B = 128, M = 32, fadeLen = 1024;
  std::vector<double> head[2]; // each kernel's first B taps, reversed
  std::vector<cplx> spec[2];   // each kernel's partitions 1 … M − 1, transformed: (M − 1) × (B + 1)
  std::vector<cplx> fdl;       // the input's last M − 1 blocks, transformed: (M − 1) × (B + 1)
  std::vector<double> hist;    // the input's last B samples, written twice, B apart
  std::vector<double> blk;     // the block before and the block coming in (2B)
  std::vector<double> tails[2];// each kernel's tail for the block coming in
  std::vector<cplx> work, scratch;
  std::vector<double> h;       // a design
  int pos = 0, fill = 0, newest = 0, active = 0, fadeAt = 0, designed = 0;
  bool fading = false;
  double levelNow = 1, alpha = 0;
  double dot(const std::vector<double> &kk) const;
  void tail(int which);
};

} // namespace openair
