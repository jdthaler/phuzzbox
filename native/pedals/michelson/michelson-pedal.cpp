// michelson-pedal.cpp — the Michelson Interferometer's PedalInfo: its tables and its engine. A host with this pedal alone
// finds it as phuzz_pedal() (michelson-entry.cpp); the app, which has every pedal, as michelson::pedalInfo().

#include "michelson-engine.h"
#include "michelson-params.h"
#include "phuzzbox/pedal.h"

namespace michelson { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &michelson::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "michelson", "Michelson Interferometer", PHUZZ_PEDAL_VERSION, "An interferometer whose mirror your bass moves: its fringes fold the wave", "Mich",
    michelson::kParams, michelson::kParamCount, michelson::kPresets, michelson::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new michelson::Engine(fs); },
  };
  return info;
}
