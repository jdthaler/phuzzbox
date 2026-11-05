# The Lamp Vibe: its model and engine in C++, its plugins and its WebAssembly.
include(lampvibe-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_lampvibe STATIC lampvibe-model.cpp lampvibe-engine.cpp lampvibe-pedal.cpp lampvibe-entry.cpp)
target_include_directories(phuzz_lampvibe PUBLIC .)
target_link_libraries(phuzz_lampvibe PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(lampvibe NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_lampvibe)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(lampvibe PEDAL phuzz_lampvibe SOURCES lampvibe-web.cpp OUT ${PHUZZ_ROOT}/lampvibe/wasm/lampvibe.wasm)
endif()
