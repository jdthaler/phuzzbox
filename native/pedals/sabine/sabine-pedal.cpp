// sabine-pedal.cpp — the Sabine's Room's PedalInfo: its tables and its engine. A host with this pedal alone
// finds it as phuzz_pedal() (sabine-entry.cpp); the app, which has every pedal, as sabine::pedalInfo().

#include "sabine-engine.h"
#include "sabine-params.h"
#include "phuzzbox/pedal.h"

namespace sabine { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &sabine::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "sabine", "Sabine's Room", PHUZZ_PEDAL_VERSION, "Your bass in a room you build: its early reflections by the image method, its reverberation by Sabine's law", "Sabine's Room",
    sabine::kParams, sabine::kParamCount, sabine::kPresets, sabine::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new sabine::Engine(fs); },
  };
  return info;
}
