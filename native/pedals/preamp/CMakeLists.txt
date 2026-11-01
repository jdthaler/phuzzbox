# The Tube Preamp: its model and engine in C++, its plugins and its WebAssembly.
include(preamp-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_preamp STATIC preamp-model.cpp preamp-engine.cpp preamp-pedal.cpp preamp-entry.cpp)
target_include_directories(phuzz_preamp PUBLIC .)
target_link_libraries(phuzz_preamp PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(preamp NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_preamp)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(preamp PEDAL phuzz_preamp SOURCES preamp-web.cpp OUT ${PHUZZ_ROOT}/preamp/wasm/preamp.wasm)
endif()
