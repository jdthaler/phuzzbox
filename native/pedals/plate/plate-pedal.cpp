// plate-pedal.cpp — the Plate Reverb's PedalInfo: its tables and its engine. A host with this
// pedal alone finds it as phuzz_pedal() (plate-entry.cpp); the app, which has every pedal, as
// plate::pedalInfo().

#include "phuzzbox/pedal.h"
#include "plate-engine.h"
#include "plate-params.h"

namespace plate { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &plate::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "plate", "Plate Reverb", PHUZZ_PEDAL_VERSION, "A steel plate, its bending modes and its losses", "Plat",
    plate::kParams, plate::kParamCount, plate::kPresets, plate::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new plate::Engine(fs); },
  };
  return info;
}
