# The Opto Compressor: its model and engine in C++, its plugins and its WebAssembly.
include(opto-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_opto STATIC opto-model.cpp opto-engine.cpp opto-pedal.cpp opto-entry.cpp)
target_include_directories(phuzz_opto PUBLIC .)
target_link_libraries(phuzz_opto PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(opto NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_opto)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(opto PEDAL phuzz_opto SOURCES opto-web.cpp OUT ${PHUZZ_ROOT}/opto/wasm/opto.wasm)
endif()
