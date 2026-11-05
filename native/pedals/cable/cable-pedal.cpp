// cable-pedal.cpp — the Transatlantic Cable's PedalInfo: its tables and its engine. A host with this pedal alone
// finds it as phuzz_pedal() (cable-entry.cpp); the app, which has every pedal, as cable::pedalInfo().

#include "cable-engine.h"
#include "cable-params.h"
#include "phuzzbox/pedal.h"

namespace cable { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &cable::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "cable", "Transatlantic Cable", PHUZZ_PEDAL_VERSION, "Your bass sent down a long cable", "Cabl",
    cable::kParams, cable::kParamCount, cable::kPresets, cable::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new cable::Engine(fs); },
  };
  return info;
}
