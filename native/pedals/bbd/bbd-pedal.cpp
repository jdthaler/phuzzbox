// bbd-pedal.cpp — the Bucket Brigade's PedalInfo: its tables and its engine. A host with this pedal alone
// finds it as phuzz_pedal() (bbd-entry.cpp); the app, which has every pedal, as bbd::pedalInfo().

#include "bbd-engine.h"
#include "bbd-params.h"
#include "phuzzbox/pedal.h"

namespace bbd { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &bbd::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "bbd", "Bucket Brigade", PHUZZ_PEDAL_VERSION, "A chain of capacitors passing charges along at a clock: an analog delay, chorus and flanger", "BBDl",
    bbd::kParams, bbd::kParamCount, bbd::kPresets, bbd::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new bbd::Engine(fs); },
  };
  return info;
}
