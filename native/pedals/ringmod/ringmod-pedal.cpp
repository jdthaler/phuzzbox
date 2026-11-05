// ringmod-pedal.cpp — the Ring Modulator's PedalInfo: its tables and its engine. A host with this pedal alone
// finds it as phuzz_pedal() (ringmod-entry.cpp); the app, which has every pedal, as ringmod::pedalInfo().

#include "ringmod-engine.h"
#include "ringmod-params.h"
#include "phuzzbox/pedal.h"

namespace ringmod { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &ringmod::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "ringmod", "Ring Modulator", PHUZZ_PEDAL_VERSION, "Four diodes in a ring, switched by a carrier: each note comes out as its sum and difference with it", "Ring",
    ringmod::kParams, ringmod::kParamCount, ringmod::kPresets, ringmod::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new ringmod::Engine(fs); },
  };
  return info;
}
