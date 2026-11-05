# The Output Transformer: its model and engine in C++, its plugins and its WebAssembly.
include(transformer-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_transformer STATIC transformer-model.cpp transformer-engine.cpp transformer-pedal.cpp transformer-entry.cpp)
target_include_directories(phuzz_transformer PUBLIC .)
target_link_libraries(phuzz_transformer PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(transformer NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_transformer)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(transformer PEDAL phuzz_transformer SOURCES transformer-web.cpp OUT ${PHUZZ_ROOT}/transformer/wasm/transformer.wasm)
endif()
