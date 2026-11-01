// echo-pedal.cpp — the Tape Echo's PedalInfo: its tables and its engine. A host with this
// pedal alone finds it as phuzz_pedal() (echo-entry.cpp); the app, which has every pedal, as
// echo::pedalInfo().

#include "phuzzbox/pedal.h"
#include "echo-engine.h"
#include "echo-params.h"

namespace echo { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &echo::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "echo", "Tape Echo", PHUZZ_PEDAL_VERSION, "A tape loop past a record head and three playback heads", "Tape",
    echo::kParams, echo::kParamCount, echo::kPresets, echo::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new echo::Engine(fs); },
  };
  return info;
}
