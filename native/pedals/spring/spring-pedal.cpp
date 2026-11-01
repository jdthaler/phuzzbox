// spring-pedal.cpp — the Spring Reverb's PedalInfo: its tables and its engine. A host with this
// pedal alone finds it as phuzz_pedal() (spring-entry.cpp); the app, which has every pedal, as
// spring::pedalInfo().

#include "phuzzbox/pedal.h"
#include "spring-engine.h"
#include "spring-params.h"

namespace spring { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &spring::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "spring", "Spring Reverb", PHUZZ_PEDAL_VERSION, "A reverb tank's helical springs, every echo a chirp", "Sprg",
    spring::kParams, spring::kParamCount, spring::kPresets, spring::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new spring::Engine(fs); },
  };
  return info;
}
