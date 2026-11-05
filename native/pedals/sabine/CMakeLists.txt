# Sabine's Room: its model and engine in C++, its plugins and its WebAssembly.
include(sabine-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_sabine STATIC sabine-model.cpp sabine-engine.cpp sabine-pedal.cpp sabine-entry.cpp)
target_include_directories(phuzz_sabine PUBLIC .)
target_link_libraries(phuzz_sabine PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(sabine NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_sabine)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(sabine PEDAL phuzz_sabine SOURCES sabine-web.cpp OUT ${PHUZZ_ROOT}/sabine/wasm/sabine.wasm)
endif()
