// openair-pedal.cpp — the Open Air's PedalInfo: its tables and its engine. A host with this pedal alone
// finds it as phuzz_pedal() (openair-entry.cpp); the app, which has every pedal, as openair::pedalInfo().

#include "openair-engine.h"
#include "openair-params.h"
#include "phuzzbox/pedal.h"

namespace openair { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &openair::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "openair", "Open Air", PHUZZ_PEDAL_VERSION, "Your bass heard across open ground: the air absorbing its treble, the ground's reflection digging a dip", "Open Air",
    openair::kParams, openair::kParamCount, openair::kPresets, openair::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new openair::Engine(fs); },
  };
  return info;
}
