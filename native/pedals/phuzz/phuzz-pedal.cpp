// phuzz-pedal.cpp — the Phuzz's PedalInfo: its tables and its engine.

#include "phuzz-engine.h"
#include "phuzz-params.h"
#include "phuzzbox/pedal.h"

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &phuzz_pedal() {
  static const phuzzbox::PedalInfo info{
    "phuzz", "Phuzz", PHUZZ_PEDAL_VERSION, "A two-transistor germanium fuzz, from Ebers-Moll transistors that drift with temperature", "Phuz",
    phuzz::kParams, phuzz::kParamCount, phuzz::kPresets, phuzz::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new phuzz::Engine(fs); },
    phuzz::kExpression,
  };
  return info;
}
