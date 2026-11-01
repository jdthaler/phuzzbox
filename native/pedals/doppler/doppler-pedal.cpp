// doppler-pedal.cpp — the Doppler's PedalInfo: its tables and its engine. A host with this
// pedal alone finds it as phuzz_pedal() (doppler-entry.cpp); the app, which has every pedal, as
// doppler::pedalInfo().

#include "phuzzbox/pedal.h"
#include "doppler-engine.h"
#include "doppler-params.h"

namespace doppler { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &doppler::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "doppler", "Doppler", PHUZZ_PEDAL_VERSION, "A source passing you, heard at its retarded time: the Doppler shift and, above Mach 1, the boom", "Dopp",
    doppler::kParams, doppler::kParamCount, doppler::kPresets, doppler::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new doppler::Engine(fs); },
  };
  return info;
}
