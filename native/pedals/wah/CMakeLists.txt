# The Wah: its model and engine in C++, its plugins and its WebAssembly.
include(wah-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_wah STATIC wah-model.cpp wah-engine.cpp wah-pedal.cpp wah-entry.cpp)
target_include_directories(phuzz_wah PUBLIC .)
target_link_libraries(phuzz_wah PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(wah NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_wah)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(wah PEDAL phuzz_wah SOURCES wah-web.cpp OUT ${PHUZZ_ROOT}/wah/wasm/wah.wasm)
endif()
