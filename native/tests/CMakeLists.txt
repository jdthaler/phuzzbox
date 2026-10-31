# Native unit tests (CTest): the parameter tables and the effect contract, without a host.
add_executable(phuzz_native_tests native-tests.cpp)
target_link_libraries(phuzz_native_tests PRIVATE phuzz_buffer phuzz_testbass phuzz_app_engine)
add_test(NAME native COMMAND phuzz_native_tests)
if (EMSCRIPTEN) # the repository's package.json makes .js an ES module; Emscripten's runner is CommonJS
  set_target_properties(phuzz_native_tests PROPERTIES SUFFIX ".cjs")
  # a stack overflow aborts instead of silently overwriting the data below the stack
  target_link_options(phuzz_native_tests PRIVATE -sSTACK_OVERFLOW_CHECK=2)
endif()
