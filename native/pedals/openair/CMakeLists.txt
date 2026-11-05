# The Open Air: its model and engine in C++, its plugins and its WebAssembly.
include(openair-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_openair STATIC openair-model.cpp openair-engine.cpp openair-pedal.cpp openair-entry.cpp)
target_include_directories(phuzz_openair PUBLIC .)
target_link_libraries(phuzz_openair PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(openair NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_openair)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(openair PEDAL phuzz_openair SOURCES openair-web.cpp OUT ${PHUZZ_ROOT}/openair/wasm/openair.wasm)
endif()
