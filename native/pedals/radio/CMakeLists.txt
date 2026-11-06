# The Crystal Radio: its model and engine in C++, its plugins and its WebAssembly.
include(radio-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_radio STATIC radio-model.cpp radio-engine.cpp radio-pedal.cpp radio-entry.cpp)
target_include_directories(phuzz_radio PUBLIC .)
target_link_libraries(phuzz_radio PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(radio NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_radio)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(radio PEDAL phuzz_radio SOURCES radio-web.cpp OUT ${PHUZZ_ROOT}/radio/wasm/radio.wasm)
endif()
