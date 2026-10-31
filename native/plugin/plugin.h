// plugin.h — the CLAP effect every pedal shares (plugin.cpp).
#pragma once

#include "phuzzbox/pedal.h"

namespace phuzzbox {

bool entryInit(const PedalInfo &info);
const void *entryFactory(const char *id);

} // namespace phuzzbox
