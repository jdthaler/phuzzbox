# The Tape Echo: its model and engine in C++, its plugins and its WebAssembly.
include(echo-info.cmake) # generated: PHUZZ_NAME, PHUZZ_VERSION, PHUZZ_AU_SUBTYPE

add_library(phuzz_echo STATIC echo-model.cpp echo-engine.cpp echo-pedal.cpp echo-entry.cpp)
target_include_directories(phuzz_echo PUBLIC .)
target_link_libraries(phuzz_echo PUBLIC phuzzbox_core)

if (PHUZZ_PLUGINS)
  phuzz_add_plugin(echo NAME "${PHUZZ_NAME}" VERSION ${PHUZZ_VERSION} AU_SUBTYPE ${PHUZZ_AU_SUBTYPE} PEDAL phuzz_echo)
endif()
if (EMSCRIPTEN)
  phuzz_add_wasm(echo PEDAL phuzz_echo SOURCES echo-web.cpp OUT ${PHUZZ_ROOT}/echo/wasm/echo.wasm)
endif()
