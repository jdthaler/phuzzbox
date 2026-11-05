# The Tunnel Diode: its model and engine in C++, its plugins and its WebAssembly.
include(tunnel-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_tunnel STATIC tunnel-model.cpp tunnel-engine.cpp tunnel-pedal.cpp tunnel-entry.cpp)
target_include_directories(phuzz_tunnel PUBLIC .)
target_link_libraries(phuzz_tunnel PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(tunnel NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_tunnel)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(tunnel PEDAL phuzz_tunnel SOURCES tunnel-web.cpp OUT ${PHUZZ_ROOT}/tunnel/wasm/tunnel.wasm)
endif()
