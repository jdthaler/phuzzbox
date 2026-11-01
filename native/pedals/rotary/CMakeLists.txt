# The Rotary Speaker: its model and engine in C++, its plugins and its WebAssembly.
include(rotary-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_rotary STATIC rotary-model.cpp rotary-engine.cpp rotary-pedal.cpp rotary-entry.cpp)
target_include_directories(phuzz_rotary PUBLIC .)
target_link_libraries(phuzz_rotary PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(rotary NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_rotary)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(rotary PEDAL phuzz_rotary SOURCES rotary-web.cpp OUT ${PHUZZ_ROOT}/rotary/wasm/rotary.wasm)
endif()
