// preamp-pedal.cpp — the Tube Preamp's PedalInfo: its tables and its engine. A host with this
// pedal alone finds it as phuzz_pedal() (preamp-entry.cpp); the app, which has every pedal, as
// preamp::pedalInfo().

#include "phuzzbox/pedal.h"
#include "preamp-engine.h"
#include "preamp-params.h"

namespace preamp { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &preamp::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "preamp", "Tube Preamp", PHUZZ_PEDAL_VERSION, "A 1959 Bassman's preamp: three 12AX7 triodes that conduct at the grid, and its passive tone stack", "Tube",
    preamp::kParams, preamp::kParamCount, preamp::kPresets, preamp::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new preamp::Engine(fs); },
    preamp::kExpression,
  };
  return info;
}
