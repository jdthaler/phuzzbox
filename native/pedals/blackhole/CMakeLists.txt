# The Black Hole: its model and engine in C++, its plugins and its WebAssembly.
include(blackhole-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_blackhole STATIC blackhole-model.cpp blackhole-engine.cpp blackhole-pedal.cpp blackhole-entry.cpp)
target_include_directories(phuzz_blackhole PUBLIC .)
target_link_libraries(phuzz_blackhole PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(blackhole NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_blackhole)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(blackhole PEDAL phuzz_blackhole SOURCES blackhole-web.cpp OUT ${PHUZZ_ROOT}/blackhole/wasm/blackhole.wasm)
endif()
