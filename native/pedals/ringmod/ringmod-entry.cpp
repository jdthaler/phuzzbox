// ringmod-entry.cpp — phuzz_pedal(), by which a host of this pedal alone (its plugin, its WebAssembly,
// the native tests) finds the Ring Modulator. It is a file of its own so that the app, which links every
// pedal and names each as <slug>::pedalInfo(), never pulls in a second phuzz_pedal().

#include "phuzzbox/pedal.h"

namespace ringmod { const phuzzbox::PedalInfo &pedalInfo(); }

const phuzzbox::PedalInfo &phuzz_pedal() { return ringmod::pedalInfo(); }
