# phuzzbox_core: the effect contract and what every pedal shares.
add_library(phuzzbox_core STATIC src/params.cpp src/dk.cpp)
target_include_directories(phuzzbox_core PUBLIC include)
target_compile_features(phuzzbox_core PUBLIC cxx_std_20)
# No fused multiply-adds in the plugins: the WebAssembly has none, so the plugins give the
# WebAssembly's numbers to the last bit on every machine (as Forte does).
if (NOT MSVC AND NOT EMSCRIPTEN)
  target_compile_options(phuzzbox_core PUBLIC -ffp-contract=off)
endif()
