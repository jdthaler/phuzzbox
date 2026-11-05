# The Neon Tremolo: its model and engine in C++, its plugins and its WebAssembly.
include(neon-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_neon STATIC neon-model.cpp neon-engine.cpp neon-pedal.cpp neon-entry.cpp)
target_include_directories(phuzz_neon PUBLIC .)
target_link_libraries(phuzz_neon PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(neon NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_neon)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(neon PEDAL phuzz_neon SOURCES neon-web.cpp OUT ${PHUZZ_ROOT}/neon/wasm/neon.wasm)
endif()
