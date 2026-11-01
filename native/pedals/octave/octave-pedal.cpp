// octave-pedal.cpp — the Octave Down's PedalInfo: its tables and its engine. A host with this
// pedal alone finds it as phuzz_pedal() (octave-entry.cpp); the app, which has every pedal, as
// octave::pedalInfo().

#include "phuzzbox/pedal.h"
#include "octave-engine.h"
#include "octave-params.h"

namespace octave { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &octave::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "octave", "Octave Down", PHUZZ_PEDAL_VERSION, "The analog octave divider: a comparator and flip-flops flipping the bass's polarity", "Octv",
    octave::kParams, octave::kParamCount, octave::kPresets, octave::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new octave::Engine(fs); },
  };
  return info;
}
