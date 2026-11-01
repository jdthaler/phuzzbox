// dryline.h — the dry signal delayed by the pedal's latency, for the footswitch's crossfade. A pedal
// that oversamples is a few samples late (its latency(), which a DAW compensates); bypassed, the dry
// signal must be just as late, or the crossfade sums a signal with a copy of itself a few samples
// apart (a comb filter while it fades), and a bypassed plugin comes out early against the tracks the
// host delayed to match it. The page's worklet does the same (shared/worklet.js).
#pragma once

namespace phuzzbox {

struct DryLine {
  static constexpr int N = 64; // the longest latency it keeps: more than any pedal's
  float buf[N] = {};
  int at = 0, delay = 0;
  void setDelay(int d) { delay = d < 0 ? 0 : d > N - 1 ? N - 1 : d; }
  float run(float x) {
    buf[at] = x;
    const float y = buf[(at - delay + N) % N];
    at = (at + 1) % N;
    return y;
  }
  void reset() { for (float &b : buf) b = 0; at = 0; }
};

} // namespace phuzzbox
