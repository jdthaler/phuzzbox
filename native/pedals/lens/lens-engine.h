// lens-engine.h — the Gravitational Lens as an effect: the bass convolved with the lens's impulse
// response (lens-model.h), with no latency. The kernel's first 128 taps are applied sample by
// sample; the rest in blocks of 128 by FFT (uniformly partitioned overlap-save, a delay line of
// the input's spectra shared by every partition), each block's sum ready by the time the block it
// belongs to begins. A change of the lens builds a new kernel a little each block, then fades
// over to it while the old one still plays.
//
// The rays (geometric optics) are two paths beside it: a delay line, read kRayLead samples back
// for the minimum's image and kRayLead + Δt back (between samples, by a Kaiser-windowed sinc) for
// the saddle's, each through its allpass chain (RayPair in lens-model.h), the delay and the images'
// sizes gliding when the lens changes. Both run all the time; Optics fades between them.
#pragma once

#include <complex>
#include <cstdint>
#include <vector>

#include "lens-model.h"
#include "phuzzbox/effect.h"

namespace lens {

constexpr int kBlock = 128, kFFT = 2 * kBlock, kBins = kBlock + 1;

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // about 30 times a second: the input's RMS voltage since the last message and the output's
  // (before Level), and 1 while a new kernel is on its way (0 when the lens heard is the lens set)
  kLight = 1,
};

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  double tail() const override { return (double)slot[active].taps / fs; }

  const std::vector<double> &kernel() const { return slot[active].h; } // the kernel playing

 private:
  struct Slot {
    std::vector<double> h; // the kernel's taps (its first kBlock are the head)
    std::vector<float> re, im; // its partitions' spectra, partition p ≥ 1 at (p − 1)·kBins
    int taps = 0, parts = 0;    // taps, and partitions after the head
    double tailOut[kBlock] = {};
  };
  void load(Slot &s, const Kernel &k); // copy a finished kernel in
  void transform(Slot &s, int p);       // partition p's spectrum
  void blockDone();                     // a block of input is in: its spectrum, the next tails
  void tails(Slot &s);
  bool sameLens(const Parts &a, const Parts &b) const;
  double rayStep(double x);             // the rays' output for this input sample

  int cap = 0, maxParts = 0;
  Parts want{}, building{};
  bool fresh = true; // nothing played since construction or reset: a new lens is built at once
  bool haveParams = false, pending = false;
  Kernel kernelB;
  enum { quiet, build, transforming, waiting, fading } stage = quiet;
  int transformAt = 0, fadeAt = 0, fadeLen = 0;
  Slot slot[2];
  int active = 0;
  double gain = 1;

  // the input: the last kBlock samples twice over (for the head), the block coming in and the one
  // before, and the delay line of spectra (newest at fdlAt)
  std::vector<double> hist;
  int histAt = 0, pos = 0;
  double cur[kBlock] = {}, prev[kBlock] = {};
  std::vector<float> xre, xim;
  int fdlAt = 0;
  // the FFT's scratch and tables
  std::complex<double> buf[kFFT];
  std::complex<double> twiddle[kFFT / 2];
  int rev[kFFT];
  void fft(bool inverse);

  // the rays: the delay line, the chains' coefficients and states, the delay (samples) and the
  // images' sizes, gliding to their targets, and how much of the output is the rays'
  static constexpr int kTaps = 16, kPhases = 256;
  std::vector<double> line, sinc; // sinc: (kPhases + 1) rows of kTaps
  int lineAt = 0, lineMask = 0;
  double ca[kRaySections] = {}, cb[kRaySections] = {};
  double ax[kRaySections] = {}, ay[kRaySections] = {}, bx[kRaySections] = {}, by[kRaySections] = {};
  double delayNow = 0, delayTo = 0, gaNow = 0, gaTo = 0, gbNow = 0, gbTo = 0, glide = 0;
  double raysNow = 0, raysTo = 0, raysStep = 0;

  // the light, for the page
  int lightEvery = 1600, lightAt = 0;
  double sumIn = 0, sumOut = 0;
  phuzzbox::Message msg;
};

} // namespace lens
