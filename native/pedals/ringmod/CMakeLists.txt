# The Ring Modulator: its model and engine in C++, its plugins and its WebAssembly.
include(ringmod-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_ringmod STATIC ringmod-model.cpp ringmod-engine.cpp ringmod-pedal.cpp ringmod-entry.cpp)
target_include_directories(phuzz_ringmod PUBLIC .)
target_link_libraries(phuzz_ringmod PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(ringmod NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_ringmod)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(ringmod PEDAL phuzz_ringmod SOURCES ringmod-web.cpp OUT ${PHUZZ_ROOT}/ringmod/wasm/ringmod.wasm)
endif()
