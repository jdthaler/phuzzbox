# The Sympathetic Strings: its model and engine in C++, its plugins and its WebAssembly.
include(sympathetic-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_sympathetic STATIC sympathetic-model.cpp sympathetic-engine.cpp sympathetic-pedal.cpp sympathetic-entry.cpp)
target_include_directories(phuzz_sympathetic PUBLIC .)
target_link_libraries(phuzz_sympathetic PUBLIC phuzzbox_core)
if (EMSCRIPTEN)
  target_compile_options(phuzz_sympathetic PRIVATE -msimd128) # the mode bank, eight lanes at a time
endif()

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(sympathetic NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_sympathetic)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(sympathetic PEDAL phuzz_sympathetic SOURCES sympathetic-web.cpp OUT ${PHUZZ_ROOT}/sympathetic/wasm/sympathetic.wasm)
endif()
