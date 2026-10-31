// web.h — for the WebAssembly builds (native/web): PHUZZ_EXPORT keeps a C function and exports it.
#pragma once

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define PHUZZ_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define PHUZZ_EXPORT
#endif
