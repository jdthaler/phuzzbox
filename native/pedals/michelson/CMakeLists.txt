# The Michelson Interferometer: its model and engine in C++, its plugins and its WebAssembly.
include(michelson-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_michelson STATIC michelson-model.cpp michelson-engine.cpp michelson-pedal.cpp michelson-entry.cpp)
target_include_directories(phuzz_michelson PUBLIC .)
target_link_libraries(phuzz_michelson PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(michelson NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_michelson)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(michelson PEDAL phuzz_michelson SOURCES michelson-web.cpp OUT ${PHUZZ_ROOT}/michelson/wasm/michelson.wasm)
endif()
