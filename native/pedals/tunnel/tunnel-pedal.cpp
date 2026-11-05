// tunnel-pedal.cpp — the Tunnel Diode's PedalInfo: its tables and its engine. A host with this pedal alone
// finds it as phuzz_pedal() (tunnel-entry.cpp); the app, which has every pedal, as tunnel::pedalInfo().

#include "tunnel-engine.h"
#include "tunnel-params.h"
#include "phuzzbox/pedal.h"

namespace tunnel { const phuzzbox::PedalInfo &pedalInfo(); }

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &tunnel::pedalInfo() {
  static const phuzzbox::PedalInfo info{
    "tunnel", "Tunnel Diode", PHUZZ_PEDAL_VERSION, "Esaki's tunnel diode, whose current falls as its voltage rises: a switch with memory, or with an inductor a relaxation oscillator", "Tunnel",
    tunnel::kParams, tunnel::kParamCount, tunnel::kPresets, tunnel::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new tunnel::Engine(fs); },
  };
  return info;
}
