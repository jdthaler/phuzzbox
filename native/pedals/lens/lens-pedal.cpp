// lens-pedal.cpp — the Gravitational Lens's PedalInfo: its tables and its engine. A host with this pedal alone
// finds it as phuzz_pedal() (lens-entry.cpp); the app, which has every pedal, as lens::pedalInfo().

#include "lens-engine.h"
#include "lens-params.h"
#include "phuzzbox/pedal.h"

namespace lens { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &lens::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "lens", "Gravitational Lens", PHUZZ_PEDAL_VERSION, "Your bass bent round a star or a black hole", "GLns",
    lens::kParams, lens::kParamCount, lens::kPresets, lens::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new lens::Engine(fs); },
  };
  return info;
}
