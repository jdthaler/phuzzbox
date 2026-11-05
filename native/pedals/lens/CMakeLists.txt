# The Gravitational Lens: its model and engine in C++, its plugins and its WebAssembly.
include(lens-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_lens STATIC lens-model.cpp lens-engine.cpp lens-pedal.cpp lens-entry.cpp)
target_include_directories(phuzz_lens PUBLIC .)
target_link_libraries(phuzz_lens PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(lens NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_lens)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(lens PEDAL phuzz_lens SOURCES lens-web.cpp OUT ${PHUZZ_ROOT}/lens/wasm/lens.wasm)
endif()
