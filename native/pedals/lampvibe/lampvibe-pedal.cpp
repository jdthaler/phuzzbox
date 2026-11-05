// lampvibe-pedal.cpp — the Lamp Vibe's PedalInfo: its tables and its engine. A host with this pedal alone
// finds it as phuzz_pedal() (lampvibe-entry.cpp); the app, which has every pedal, as lampvibe::pedalInfo().

#include "lampvibe-engine.h"
#include "lampvibe-params.h"
#include "phuzzbox/pedal.h"

namespace lampvibe { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &lampvibe::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "lampvibe", "Lamp Vibe", PHUZZ_PEDAL_VERSION, "A phase vibe lit by a glowing tungsten filament", "LVib",
    lampvibe::kParams, lampvibe::kParamCount, lampvibe::kPresets, lampvibe::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new lampvibe::Engine(fs); },
  };
  return info;
}
