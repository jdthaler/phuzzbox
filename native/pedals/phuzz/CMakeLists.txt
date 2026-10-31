# The Phuzz: its model and engine in C++, its plugins and its WebAssembly.
include(phuzz-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_phuzz STATIC phuzz-model.cpp phuzz-engine.cpp phuzz-pedal.cpp)
target_include_directories(phuzz_phuzz PUBLIC .)
target_link_libraries(phuzz_phuzz PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(phuzz NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_phuzz)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(phuzz PEDAL phuzz_phuzz SOURCES phuzz-web.cpp OUT ${PHUZZ_ROOT}/phuzz/wasm/phuzz.wasm)
endif()
