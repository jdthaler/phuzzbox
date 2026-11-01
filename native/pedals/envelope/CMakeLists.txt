# The Envelope Filter: its model and engine in C++, its plugins and its WebAssembly.
include(envelope-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_envelope STATIC envelope-model.cpp envelope-engine.cpp envelope-pedal.cpp envelope-entry.cpp)
target_include_directories(phuzz_envelope PUBLIC .)
target_link_libraries(phuzz_envelope PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(envelope NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_envelope)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(envelope PEDAL phuzz_envelope SOURCES envelope-web.cpp OUT ${PHUZZ_ROOT}/envelope/wasm/envelope.wasm)
endif()
