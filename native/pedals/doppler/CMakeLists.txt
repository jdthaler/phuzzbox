# The Doppler: its model and engine in C++, its plugins and its WebAssembly.
include(doppler-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_doppler STATIC doppler-model.cpp doppler-engine.cpp doppler-pedal.cpp doppler-entry.cpp)
target_include_directories(phuzz_doppler PUBLIC .)
target_link_libraries(phuzz_doppler PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(doppler NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_doppler)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(doppler PEDAL phuzz_doppler SOURCES doppler-web.cpp OUT ${PHUZZ_ROOT}/doppler/wasm/doppler.wasm)
endif()
