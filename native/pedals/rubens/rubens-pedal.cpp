// rubens-pedal.cpp — the Rubens' Tube's PedalInfo: its tables and its engine. A host with this pedal alone
// finds it as phuzz_pedal() (rubens-entry.cpp); the app, which has every pedal, as rubens::pedalInfo().

#include "rubens-engine.h"
#include "rubens-params.h"
#include "phuzzbox/pedal.h"

namespace rubens { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &rubens::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "rubens", "Rubens' Tube", PHUZZ_PEDAL_VERSION, "Your bass through a loudspeaker into a closed pipe of propane: its resonances, as the flames show them", "Rubens' Tube",
    rubens::kParams, rubens::kParamCount, rubens::kPresets, rubens::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new rubens::Engine(fs); },
  };
  return info;
}
