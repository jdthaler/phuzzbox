// plugin.h — the CLAP effect every pedal shares (plugin.cpp).
#pragma once

#include <string>

#include <clap/clap.h>

#include "phuzzbox/pedal.h"

namespace phuzzbox {

bool entryInit(const PedalInfo &info);
const void *entryFactory(const char *id);

// The window's calls without a window (tests/plugin-tests.cpp): window.phuzz(method, …args) as a
// JSON array in, its answer as JSON out. An extension only this project's tests ask for.
inline constexpr const char *kWindowCalls = "net.jthaler.phuzzbox.window-calls";
struct WindowCalls { std::string (*call)(const clap_plugin_t *, const char *json); };

} // namespace phuzzbox
