// bbd-model.h — the Bucket Brigade's circuit: a bucket-brigade device, a chain of N capacitors
// (the stages) joined by switches that a two-phase clock opens and closes, so that each clock
// cycle every charge moves two stages along. The bass, through a third-order Butterworth
// anti-aliasing filter, is sampled onto the first capacitor once a clock cycle and comes out N/2
// cycles later, held until the next comes, through a matching reconstruction filter.
//
// At each transfer a share ε of a charge is left behind and joins the charge behind it, one clock
// cycle later. Over N transfers that is the filter
//   C(z) = ((1 − ε) / (1 − ε z⁻¹))^N,  z the clock's,
// whose impulse response is the negative binomial distribution p_m = C(N + m − 1, m) (1 − ε)^N ε^m:
// a charge arrives in N transfers, plus m more clock cycles for the m times it was left behind.
//
// A triangle wave swings the clock, fclk (1 + depth · tri); the count of stages stays, so the
// delay N / (2 fclk) shortens as the clock speeds up, and the charges inside come out faster: the
// pitch rises. Feedback returns the delayed signal to the input; Mix sets it against the dry.
#pragma once

#include <complex>

namespace bbd {

constexpr int kMaxTaps = 64;   // the transfer loss's taps, at most (its tail under 1e-9 by then)
constexpr int kMaxStages = 4096;

struct Parts {
  int stages;                  // N
  double clock;                // fclk at rest (Hz)
  double rate, depth;          // the triangle's frequency (Hz) and swing (share of fclk)
  double feedback, mix, gain;
  double eps;                  // the transfer loss ε
  double corner;               // the filters' corner (Hz)
  int taps;                    // the transfer loss's taps
  double p[kMaxTaps];          // p_m
};
Parts parts(const double *P);

// the transfer loss's response at f (Hz) for the clock fc: ((1 − ε) / (1 − ε e^(−iωT)))^N
std::complex<double> transfer(const Parts &p, double f, double fc);
// a third-order Butterworth low-pass with its corner at fc (Hz), at f
std::complex<double> butterworth(double f, double fc);
// the chip's response at f, the clock still at fc: the anti-aliasing filter, the sample-and-hold
// (sinc(f/fc) and half a clock cycle), the transfer loss, the N/2 cycles' delay, and the
// reconstruction filter
std::complex<double> chip(const Parts &p, double f, double fc);
// the whole pedal's: the dry, and the chip in its feedback loop: (1 − mix) + mix H / (1 − g H)
std::complex<double> response(const Parts &p, double f);

} // namespace bbd
