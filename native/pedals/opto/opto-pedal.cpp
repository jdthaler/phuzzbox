// opto-pedal.cpp — the Opto Compressor's PedalInfo: its tables and its engine. A host with this
// pedal alone finds it as phuzz_pedal() (opto-entry.cpp); the app, which has every pedal, as
// opto::pedalInfo().

#include "phuzzbox/pedal.h"
#include "opto-engine.h"
#include "opto-params.h"

namespace opto { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &opto::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "opto", "Opto Compressor", PHUZZ_PEDAL_VERSION, "An electro-optical leveler: a glowing panel and a photocell with memory turn the bass down", "Opto",
    opto::kParams, opto::kParamCount, opto::kPresets, opto::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new opto::Engine(fs); },
  };
  return info;
}
