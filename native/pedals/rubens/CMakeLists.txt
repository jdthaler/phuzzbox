# Rubens' Tube: its model and engine in C++, its plugins and its WebAssembly.
include(rubens-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_rubens STATIC rubens-model.cpp rubens-engine.cpp rubens-pedal.cpp rubens-entry.cpp)
target_include_directories(phuzz_rubens PUBLIC .)
target_link_libraries(phuzz_rubens PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(rubens NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_rubens)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(rubens PEDAL phuzz_rubens SOURCES rubens-web.cpp OUT ${PHUZZ_ROOT}/rubens/wasm/rubens.wasm)
endif()
