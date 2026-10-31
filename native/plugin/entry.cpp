// entry.cpp — the exported clap_entry, compiled into each format (clap-wrapper's clap-first build).

#include <clap/clap.h>

bool phuzz_entry_init(const char *path);
void phuzz_entry_deinit();
const void *phuzz_entry_get_factory(const char *id);

extern "C" {
#ifdef __GNUC__
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wattributes"
#endif
CLAP_EXPORT const clap_plugin_entry_t clap_entry = {CLAP_VERSION, phuzz_entry_init, phuzz_entry_deinit, phuzz_entry_get_factory};
#ifdef __GNUC__
#pragma GCC diagnostic pop
#endif
}
