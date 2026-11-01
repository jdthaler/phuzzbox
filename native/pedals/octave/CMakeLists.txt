# The Octave Down: its model and engine in C++, its plugins and its WebAssembly.
include(octave-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_octave STATIC octave-model.cpp octave-engine.cpp octave-pedal.cpp octave-entry.cpp)
target_include_directories(phuzz_octave PUBLIC .)
target_link_libraries(phuzz_octave PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(octave NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_octave)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(octave PEDAL phuzz_octave SOURCES octave-web.cpp OUT ${PHUZZ_ROOT}/octave/wasm/octave.wasm)
endif()
