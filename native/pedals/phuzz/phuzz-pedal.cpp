// phuzz-pedal.cpp — the Phuzz's PedalInfo: its tables and its engine. A host with this pedal alone
// finds it as phuzz_pedal() (phuzz-entry.cpp); the app, which has every pedal, as phuzz::pedalInfo().

#include "phuzz-engine.h"
#include "phuzz-params.h"
#include "phuzzbox/pedal.h"

namespace phuzz { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &phuzz::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "phuzz", "Phuzz", PHUZZ_PEDAL_VERSION, "A two-transistor germanium fuzz, from Ebers-Moll transistors that drift with temperature", "Phuz",
    phuzz::kParams, phuzz::kParamCount, phuzz::kPresets, phuzz::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new phuzz::Engine(fs); },
    phuzz::kExpression,
  };
  return info;
}
