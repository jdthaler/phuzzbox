# The Plate Reverb: its model and engine in C++, its plugins and its WebAssembly.
include(plate-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_plate STATIC plate-model.cpp plate-engine.cpp plate-pedal.cpp plate-entry.cpp)
target_include_directories(phuzz_plate PUBLIC .)
target_link_libraries(phuzz_plate PUBLIC phuzzbox_core)
if (EMSCRIPTEN)
  target_compile_options(phuzz_plate PRIVATE -msimd128) # the mode bank, eight lanes at a time
endif()

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(plate NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_plate)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(plate PEDAL phuzz_plate SOURCES plate-web.cpp OUT ${PHUZZ_ROOT}/plate/wasm/plate.wasm)
endif()
