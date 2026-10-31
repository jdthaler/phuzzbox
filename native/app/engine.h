// engine.h — the Phuzzbox app's audio, as the page's worklet does it (shared/worklet.js): one of
// the interface's input channels, in volts (× Full scale), through the pedal, to every output
// channel; the footswitch's crossfade; Mute; the levels; the input kept for the tuner; and the
// loopback latency test. process() runs on the audio thread and never allocates or locks; the
// rest runs on the main thread.
#pragma once

#include <atomic>
#include <memory>
#include <vector>

#include "phuzzbox/pedal.h"

namespace phuzzbox::app {

class Engine {
 public:
  explicit Engine(const PedalInfo &pedal);

  // before the stream starts (or after it stops): the sample rate and the largest block
  void prepare(double fs, int maxFrames);
  // interleaved blocks, as RtAudio gives them; in may be null (no input)
  void process(const float *in, int inChannels, float *out, int outChannels, int n);

  const PedalInfo &pedal;
  double sampleRate() const { return fs; }

  // the pedal's parameters (constrained to their ranges), and its preset k (0-based)
  void setParam(int i, double v);
  double param(int i) const { return values[i].load(); }
  void applyPreset(int k);

  std::atomic<bool> bypass{false}, mute{false};
  std::atomic<double> fullScale{1.0}; // volts at the jack for a full-scale sample
  std::atomic<int> channel{0};        // the input channel the bass is on

  // the peak volts in and out since the last call
  void takeLevels(double &in, double &out);
  // the newest n input samples in volts, oldest first (n ≤ kKeep)
  static constexpr int kKeep = 32768;
  void snapshot(float *dst, int n) const;
  // the share of the audio thread's time the pedal took, over the last half second or so
  double load() const { return cpuLoad.load(); }

  // the loopback test: a 2 ms click out of every output, timed back into the input channel
  void startMeasure();
  // −1 while measuring, 0 before any, the round trip in ms, or −2 when nothing came back
  double measured() const { return measuredMs.load(); }

 private:
  std::unique_ptr<Effect> effect;
  double fs = 0;
  std::vector<std::atomic<double>> values;
  std::vector<double> P;
  std::atomic<bool> dirty{true};
  std::vector<float> v, L, R;
  double wet = 1;

  std::vector<float> keep;        // a ring of the input, in volts
  std::atomic<int> keepAt{0};     // where the next sample goes
  std::atomic<float> inPeak{0}, outPeak{0};
  std::atomic<double> cpuLoad{0};
  double busy = 0, span = 0;

  enum class Phase { off, quiet, click, listen };
  std::atomic<bool> measureRequest{false};
  Phase phase = Phase::off;
  long t = 0, sentAt = 0;
  float floor = 0;
  std::atomic<double> measuredMs{0};
  float loopback(float x);
};

} // namespace phuzzbox::app
