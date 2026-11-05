# Helmholtz's Resonators: its model and engine in C++, its plugins and its WebAssembly.
include(helmholtz-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_helmholtz STATIC helmholtz-model.cpp helmholtz-engine.cpp helmholtz-pedal.cpp helmholtz-entry.cpp)
target_include_directories(phuzz_helmholtz PUBLIC .)
target_link_libraries(phuzz_helmholtz PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(helmholtz NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_helmholtz)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(helmholtz PEDAL phuzz_helmholtz SOURCES helmholtz-web.cpp OUT ${PHUZZ_ROOT}/helmholtz/wasm/helmholtz.wasm)
endif()
