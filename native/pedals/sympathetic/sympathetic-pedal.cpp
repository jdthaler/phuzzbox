// sympathetic-pedal.cpp — the Sympathetic Strings' PedalInfo: its tables and its engine. A host with this
// pedal alone finds it as phuzz_pedal() (sympathetic-entry.cpp); the app, which has every pedal, as
// sympathetic::pedalInfo().

#include "phuzzbox/pedal.h"
#include "sympathetic-engine.h"
#include "sympathetic-params.h"

namespace sympathetic { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &sympathetic::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "sympathetic", "Sympathetic Strings", PHUZZ_PEDAL_VERSION, "Steel strings on one bridge, ringing along with your notes", "Symp",
    sympathetic::kParams, sympathetic::kParamCount, sympathetic::kPresets, sympathetic::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new sympathetic::Engine(fs); },
  };
  return info;
}
