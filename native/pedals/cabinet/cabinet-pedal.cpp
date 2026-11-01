// cabinet-pedal.cpp — the Speaker Cabinet's PedalInfo: its tables and its engine. A host with this
// pedal alone finds it as phuzz_pedal() (cabinet-entry.cpp); the app, which has every pedal, as
// cabinet::pedalInfo().

#include "phuzzbox/pedal.h"
#include "cabinet-engine.h"
#include "cabinet-params.h"

namespace cabinet { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &cabinet::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "cabinet", "Cabinet", PHUZZ_PEDAL_VERSION, "Bass speaker cabinets from their Thiele-Small parameters, heard by a microphone", "Cabn",
    cabinet::kParams, cabinet::kParamCount, cabinet::kPresets, cabinet::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new cabinet::Engine(fs); },
  };
  return info;
}
