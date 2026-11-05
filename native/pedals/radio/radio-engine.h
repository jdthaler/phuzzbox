// radio-engine.h — the Crystal Radio as an effect: the transmitter, the next station, the tuned circuit
// and the detector (radio-model.h) at M times the host's rate (phuzzbox/oversample.h; M = 4, 2, 1
// at high, medium, low quality), then the amplifier after the set.
//
// The amplifier: it takes off the voltage the unmodulated carrier gives the earphone (what a
// coupling capacitor would take off in time, so a knob turned doesn't thump), passes what is left
// through a 5 Hz coupling high-pass, and amplifies it by 1/(k Ac dV/dA): the detector's own gain for
// a small modulation, tuned in, made up, so a faint station or a gentle modulation changes how the
// bass sounds rather than how loud it is.
#pragma once

#include "radio-model.h"
#include "phuzzbox/dsp.h"
#include "phuzzbox/effect.h"
#include "phuzzbox/oversample.h"

namespace radio {

// Message types the engine posts (Effect::post).
enum MessageType : uint16_t {
  // the detector as it plays: 14 × (the carrier's amplitude at the diode A, the earphone's
  // voltage V), then the resting carrier's amplitude at the diode, and Newton's iterations a step
  kPoints = 1,
};

class Engine : public phuzzbox::Effect {
 public:
  explicit Engine(double fs);
  void setParams(const double *P) override;
  void reset() override;
  void process(const float *in, float *L, float *R, int n) override;
  int latency() const override { return latencySamples; }
  void setQuality(phuzzbox::Quality q) override;

  Receiver rx; // for the tests: its iterations and steps

 private:
  void glide(bool snap);     // move the gliding parts a host sample on (or all the way)
  double amplifierGain(const Parts &p) const;

  Parts target{}, now{};
  double gainTarget = 1, gainNow = 1; // the amplifier's gain, with the Level
  double rest = 0;                     // the earphone's voltage on the resting carrier, now
  bool fresh = true;                   // nothing played since the start or a reset: knobs snap
  phuzzbox::Oversampler os;
  phuzzbox::DCBlock dc;
  int latencySamples = 0;
  double h = 0;       // the step at the high rate (s)
  cplx beat = 1;      // the next station's beat against this one, e^{iΩt}
  double alpha = 0;   // the glides' one-pole coefficient a host sample

  int pointEvery = 48, pointAt = 0, points = 0;
  phuzzbox::Message msg;
  long itersMark = 0, stepsMark = 0;
};

} // namespace radio
