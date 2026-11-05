// radio-pedal.cpp — the Crystal Radio's PedalInfo: its tables and its engine. A host with this pedal alone
// finds it as phuzz_pedal() (radio-entry.cpp); the app, which has every pedal, as radio::pedalInfo().

#include "radio-engine.h"
#include "radio-params.h"
#include "phuzzbox/pedal.h"

namespace radio { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &radio::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "radio", "Crystal Radio", PHUZZ_PEDAL_VERSION, "Your bass on the air as an AM station, heard through a crystal set: a tuned coil and a point-contact diode", "Radio",
    radio::kParams, radio::kParamCount, radio::kPresets, radio::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new radio::Engine(fs); },
  };
  return info;
}
