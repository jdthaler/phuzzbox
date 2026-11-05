# The Bucket Brigade: its model and engine in C++, its plugins and its WebAssembly.
include(bbd-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_bbd STATIC bbd-model.cpp bbd-engine.cpp bbd-pedal.cpp bbd-entry.cpp)
target_include_directories(phuzz_bbd PUBLIC .)
target_link_libraries(phuzz_bbd PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(bbd NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_bbd)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(bbd PEDAL phuzz_bbd SOURCES bbd-web.cpp OUT ${PHUZZ_ROOT}/bbd/wasm/bbd.wasm)
endif()
