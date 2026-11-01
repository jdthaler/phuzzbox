# The Speaker Cabinet: its model and engine in C++, its plugins and its WebAssembly.
include(cabinet-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_cabinet STATIC cabinet-model.cpp cabinet-engine.cpp cabinet-pedal.cpp cabinet-entry.cpp)
target_include_directories(phuzz_cabinet PUBLIC .)
target_link_libraries(phuzz_cabinet PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(cabinet NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_cabinet)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(cabinet PEDAL phuzz_cabinet SOURCES cabinet-web.cpp OUT ${PHUZZ_ROOT}/cabinet/wasm/cabinet.wasm)
endif()
