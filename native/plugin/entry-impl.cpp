// entry-impl.cpp — the CLAP entry's functions for one pedal: its PedalInfo (phuzz_pedal(), from the
// pedal's library) handed to the shared plugin (plugin.cpp).

#include "plugin.h"

const phuzzbox::PedalInfo &phuzz_pedal();

bool phuzz_entry_init(const char *) { return phuzzbox::entryInit(phuzz_pedal()); }
void phuzz_entry_deinit() {}
const void *phuzz_entry_get_factory(const char *id) { return phuzzbox::entryFactory(id); }
