# The test bass (testbass/README.md): a signal source for the tests, the demos and the pages.
add_library(phuzz_testbass STATIC testbass.cpp)
target_include_directories(phuzz_testbass PUBLIC .)
target_link_libraries(phuzz_testbass PUBLIC phuzzbox_core)
if (EMSCRIPTEN)
  phuzz_add_wasm_source(testbass LIBRARY phuzz_testbass SOURCES testbass-web.cpp OUT ${PHUZZ_ROOT}/testbass/wasm/testbass.wasm)
endif()
