// wah-pedal.cpp — the Wah's PedalInfo: its tables and its engine. A host with this pedal alone
// finds it as phuzz_pedal() (wah-entry.cpp); the app, which has every pedal, as wah::pedalInfo().

#include "phuzzbox/pedal.h"
#include "wah-engine.h"
#include "wah-params.h"

namespace wah { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &wah::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "wah", "Wah", PHUZZ_PEDAL_VERSION, "An inductor wah: two transistors and a resonant coil, swept by a rocker", "Wahh",
    wah::kParams, wah::kParamCount, wah::kPresets, wah::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new wah::Engine(fs); },
    wah::kExpression,
  };
  return info;
}
