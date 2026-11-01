// pedal.h — everything a host needs to run a pedal, as its JavaScript descriptor
// (<slug>/src/<slug>-pedal.js) has it: identity, parameters and presets, and its effect.
#pragma once

#include "phuzzbox/effect.h"
#include "phuzzbox/params.h"

namespace phuzzbox {

struct PedalInfo {
  const char *slug;
  const char *name;        // the plugin's name: the pedal's ("Buffer")
  const char *version;
  const char *description;
  const char *auSubtype;   // four characters, unique (shared/registry.js's plugin.code)

  const ParamInfo *params;
  int paramCount;
  const Preset *presets;
  int presetCount;

  Effect *(*create)(double fs);
  int expression = -1;     // the parameter an expression pedal moves (MIDI CC 1), or −1
};

} // namespace phuzzbox
