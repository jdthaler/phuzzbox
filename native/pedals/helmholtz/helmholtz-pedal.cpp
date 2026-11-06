// helmholtz-pedal.cpp — the Helmholtz's Resonators' PedalInfo: its tables and its engine. A host with this pedal alone
// finds it as phuzz_pedal() (helmholtz-entry.cpp); the app, which has every pedal, as helmholtz::pedalInfo().

#include "helmholtz-engine.h"
#include "helmholtz-params.h"
#include "phuzzbox/pedal.h"

namespace helmholtz { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &helmholtz::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "helmholtz", "Helmholtz's Resonators", PHUZZ_PEDAL_VERSION, "Your bass through one of Helmholtz's glass resonators held to your ear: the partial it is tuned to rings out", "Helmholtz's Resonators",
    helmholtz::kParams, helmholtz::kParamCount, helmholtz::kPresets, helmholtz::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new helmholtz::Engine(fs); },
  };
  return info;
}
