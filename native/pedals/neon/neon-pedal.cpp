// neon-pedal.cpp — the Neon Tremolo's PedalInfo: its tables and its engine. A host with this pedal alone
// finds it as phuzz_pedal() (neon-entry.cpp); the app, which has every pedal, as neon::pedalInfo().

#include "neon-engine.h"
#include "neon-params.h"
#include "phuzzbox/pedal.h"

namespace neon { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &neon::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "neon", "Neon Tremolo", PHUZZ_PEDAL_VERSION, "A tremolo from a neon lamp flashing in a relaxation oscillator", "Neon",
    neon::kParams, neon::kParamCount, neon::kPresets, neon::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new neon::Engine(fs); },
  };
  return info;
}
