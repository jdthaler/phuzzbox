// rotary-pedal.cpp — the Rotary Speaker's PedalInfo: its tables and its engine. A host with this
// pedal alone finds it as phuzz_pedal() (rotary-entry.cpp); the app, which has every pedal, as
// rotary::pedalInfo().

#include "phuzzbox/pedal.h"
#include "rotary-engine.h"
#include "rotary-params.h"

namespace rotary { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &rotary::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "rotary", "Rotary Speaker", PHUZZ_PEDAL_VERSION, "A horn and a drum spinning past two microphones", "Rtry",
    rotary::kParams, rotary::kParamCount, rotary::kPresets, rotary::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new rotary::Engine(fs); },
  };
  return info;
}
