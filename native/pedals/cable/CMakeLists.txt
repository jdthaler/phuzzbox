# The Transatlantic Cable: its model and engine in C++, its plugins and its WebAssembly.
include(cable-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_cable STATIC cable-model.cpp cable-engine.cpp cable-pedal.cpp cable-entry.cpp)
target_include_directories(phuzz_cable PUBLIC .)
target_link_libraries(phuzz_cable PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(cable NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_cable)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(cable PEDAL phuzz_cable SOURCES cable-web.cpp OUT ${PHUZZ_ROOT}/cable/wasm/cable.wasm)
endif()
