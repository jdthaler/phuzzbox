# The Spring Reverb: its model and engine in C++, its plugins and its WebAssembly.
include(spring-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_spring STATIC spring-model.cpp spring-engine.cpp spring-pedal.cpp spring-entry.cpp)
target_include_directories(phuzz_spring PUBLIC .)
target_link_libraries(phuzz_spring PUBLIC phuzzbox_core)
if (EMSCRIPTEN)
  target_compile_options(phuzz_spring PRIVATE -msimd128) # the mode bank, eight lanes at a time
endif()

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(spring NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_spring)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(spring PEDAL phuzz_spring SOURCES spring-web.cpp OUT ${PHUZZ_ROOT}/spring/wasm/spring.wasm)
endif()
