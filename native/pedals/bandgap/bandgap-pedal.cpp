// bandgap-pedal.cpp — the Bandgap's PedalInfo: its tables and its engine. A host with this pedal alone
// finds it as phuzz_pedal() (bandgap-entry.cpp); the app, which has every pedal, as bandgap::pedalInfo().

#include "bandgap-engine.h"
#include "bandgap-params.h"
#include "phuzzbox/pedal.h"

namespace bandgap { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &bandgap::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "bandgap", "Bandgap", PHUZZ_PEDAL_VERSION, "An op-amp overdrive whose clipping diodes turn on at their bandgap", "Bgap",
    bandgap::kParams, bandgap::kParamCount, bandgap::kPresets, bandgap::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new bandgap::Engine(fs); },
  };
  return info;
}
