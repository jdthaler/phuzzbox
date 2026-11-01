// envelope-pedal.cpp — the Envelope Filter's PedalInfo: its tables and its engine. A host with this
// pedal alone finds it as phuzz_pedal() (envelope-entry.cpp); the app, which has every pedal, as
// envelope::pedalInfo().

#include "phuzzbox/pedal.h"
#include "envelope-engine.h"
#include "envelope-params.h"

namespace envelope { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &envelope::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "envelope", "Envelope Filter", PHUZZ_PEDAL_VERSION, "A resonant filter swept by how hard you play, through an LED and photocells", "Envf",
    envelope::kParams, envelope::kParamCount, envelope::kPresets, envelope::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new envelope::Engine(fs); },
  };
  return info;
}
