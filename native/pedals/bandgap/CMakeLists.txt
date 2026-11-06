# The Bandgap: its model and engine in C++, its plugins and its WebAssembly.
include(bandgap-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_bandgap STATIC bandgap-model.cpp bandgap-engine.cpp bandgap-pedal.cpp bandgap-entry.cpp)
target_include_directories(phuzz_bandgap PUBLIC .)
target_link_libraries(phuzz_bandgap PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(bandgap NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_bandgap)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(bandgap PEDAL phuzz_bandgap SOURCES bandgap-web.cpp OUT ${PHUZZ_ROOT}/bandgap/wasm/bandgap.wasm)
endif()
