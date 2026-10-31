# Native unit tests (CTest): the parameter tables and the effect contract, without a host.
add_executable(phuzz_native_tests native-tests.cpp)
target_link_libraries(phuzz_native_tests PRIVATE phuzz_buffer phuzz_testbass)
add_test(NAME native COMMAND phuzz_native_tests)
if (EMSCRIPTEN) # the repository's package.json makes .js an ES module; Emscripten's runner is CommonJS
  set_target_properties(phuzz_native_tests PROPERTIES SUFFIX ".cjs")
endif()

# The circuit solver against closed forms, the Wah's engine, and the MIDI map (phuzzbox/midi.h).
add_executable(phuzz_circuit_tests circuit-tests.cpp)
target_link_libraries(phuzz_circuit_tests PRIVATE phuzz_wah)
add_test(NAME circuit COMMAND phuzz_circuit_tests)
if (EMSCRIPTEN)
  set_target_properties(phuzz_circuit_tests PROPERTIES SUFFIX ".cjs")
endif()

# The plugin as a host drives it: MIDI control changes move its parameters (the Wah's build).
if (PHUZZ_PLUGINS)
  add_executable(phuzz_plugin_tests plugin-tests.cpp)
  target_link_libraries(phuzz_plugin_tests PRIVATE phuzz_wah_impl)
  add_test(NAME plugin COMMAND phuzz_plugin_tests)
endif()
