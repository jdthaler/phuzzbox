# phuzz_plugin: the CLAP effect every pedal shares; phuzz_add_plugin() (cmake/phuzzbox.cmake)
# makes each pedal's CLAP, VST3, AU v2 and standalone from it.
add_library(phuzz_plugin STATIC plugin.cpp)
target_include_directories(phuzz_plugin PUBLIC .)
target_link_libraries(phuzz_plugin PUBLIC phuzzbox_core clap)
