// effect.h — the effect contract: what the plugins, the WebAssembly build and the Node tests call,
// so every host drives a pedal alike. Forte's engine contract (forte/engine.h) with notes taken out
// and a signal put in.
#pragma once

#include <cstdint>

#include "phuzzbox/queue.h"

namespace phuzzbox {

// What a pedal tells its page or editor while it plays: a type its own wrapper names and up to 30
// numbers. Posting never waits: when nobody reads, messages are dropped.
struct Message {
  uint16_t type = 0;
  uint16_t count = 0;
  float values[30] = {};
};

// How much of its physics a pedal plays, for slower machines (Forte's Quality): High plays it all;
// Medium and Low oversample less or trim what is heard least. Each pedal's README says what.
enum class Quality : int { high = 0, medium = 1, low = 2 };

class Effect {
 public:
  explicit Effect(double fs) : fs(fs) {}
  virtual ~Effect() = default;
  Effect(const Effect &) = delete;
  Effect &operator=(const Effect &) = delete;

  // Every parameter, indexed as in the pedal's ParamInfo table (params.h): a choice is its index,
  // a toggle 0 or 1. Called before the first block and after any change.
  virtual void setParams(const double *P) = 0;
  // Forget the signal so far (the host stopped, or the pedal went unstable).
  virtual void reset() {}
  // Mono in (the instrument's line, in volts at the jack: a passive bass peaks around 0.1–1 V),
  // stereo out, n samples (any n ≥ 1; the hosts call it with at most 128). Never allocates.
  // Out is in the same volts: a pedal at unity leaves a signal's level alone.
  virtual void process(const float *in, float *L, float *R, int n) = 0;
  // Samples by which the output lags the input (oversampling filters, look-ahead): hosts that
  // compensate delay read it.
  virtual int latency() const { return 0; }
  // Seconds the output keeps sounding after the input stops (reverbs, echoes).
  virtual double tail() const { return 0; }

  virtual void setQuality(Quality q) { quality = q; }
  Quality quality = Quality::high;
  template <class T> T pick(T high, T medium, T low) const { return quality == Quality::high ? high : quality == Quality::medium ? medium : low; }

  SpscQueue<Message> *messages = nullptr; // set by the host; null: nobody listens
  void post(const Message &m) { if (messages) messages->push(m); }

  const double fs;
};

} // namespace phuzzbox
