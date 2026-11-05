// transformer-pedal.cpp — the Output Transformer's PedalInfo: its tables and its engine. A host with this pedal alone
// finds it as phuzz_pedal() (transformer-entry.cpp); the app, which has every pedal, as transformer::pedalInfo().

#include "transformer-engine.h"
#include "transformer-params.h"
#include "phuzzbox/pedal.h"

namespace transformer { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &transformer::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "transformer", "Output Transformer", PHUZZ_PEDAL_VERSION, "A valve amplifier's output transformer, its iron core magnetised round the Jiles–Atherton hysteresis loop", "Transformer",
    transformer::kParams, transformer::kParamCount, transformer::kPresets, transformer::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new transformer::Engine(fs); },
  };
  return info;
}
