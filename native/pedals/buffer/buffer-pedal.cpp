// buffer-pedal.cpp — the Buffer's PedalInfo: its tables and its engine.

#include "buffer-engine.h"
#include "buffer-params.h"
#include "phuzzbox/pedal.h"

#ifndef PHUZZ_PEDAL_VERSION
#define PHUZZ_PEDAL_VERSION "0.0.0"
#endif

const phuzzbox::PedalInfo &phuzz_pedal() {
  static const phuzzbox::PedalInfo info{
    "buffer", "Buffer", PHUZZ_PEDAL_VERSION, "A passive pickup into a cable and an input, as a circuit", "Bufr",
    buffer::kParams, buffer::kParamCount, buffer::kPresets, buffer::kPresetCount,
    [](double fs) -> phuzzbox::Effect * { return new buffer::Engine(fs); },
  };
  return info;
}
