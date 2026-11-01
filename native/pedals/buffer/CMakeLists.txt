# The Buffer: its model and engine in C++, its plugins and its WebAssembly.
include(buffer-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_buffer STATIC buffer-model.cpp buffer-engine.cpp buffer-pedal.cpp buffer-entry.cpp)
target_include_directories(phuzz_buffer PUBLIC .)
target_link_libraries(phuzz_buffer PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(buffer NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_buffer)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(buffer PEDAL phuzz_buffer SOURCES buffer-web.cpp OUT ${PHUZZ_ROOT}/buffer/wasm/buffer.wasm)
endif()
