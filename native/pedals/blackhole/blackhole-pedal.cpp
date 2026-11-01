// blackhole-pedal.cpp — the Black Hole's PedalInfo: its tables and its engine. A host with this
// pedal alone finds it as phuzz_pedal() (blackhole-entry.cpp); the app, which has every pedal, as
// blackhole::pedalInfo().

#include "phuzzbox/pedal.h"
#include "blackhole-engine.h"
#include "blackhole-params.h"

namespace blackhole { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &blackhole::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "blackhole", "Black Hole", PHUZZ_PEDAL_VERSION, "A spinning black hole ringing in its quasinormal modes", "BHol",
    blackhole::kParams, blackhole::kParamCount, blackhole::kPresets, blackhole::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new blackhole::Engine(fs); },
  };
  return info;
}
