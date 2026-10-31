# Phuzzbox's native code: the pedals' physics in C++, built as plugins (CLAP, and through
# clap-wrapper VST3, AU v2 and a standalone app) and as WebAssembly for the website. The layout
# and build follow Forte's (github.com/jdthaler/forte, native/). Configure with a preset:
# cmake --preset linux.

cmake_minimum_required(VERSION 3.25)
project(phuzzbox-native LANGUAGES C CXX)
if (APPLE)
  enable_language(OBJC OBJCXX) # clap-wrapper's AU and standalone are Objective-C++
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
set(CMAKE_CXX_VISIBILITY_PRESET hidden)
set(CMAKE_VISIBILITY_INLINES_HIDDEN ON)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

if (EMSCRIPTEN)
  set(phuzz_plugins_default OFF)
else()
  set(phuzz_plugins_default ON)
endif()
option(PHUZZ_PLUGINS "Build the plugins (CLAP, VST3, AU v2, standalone)" ${phuzz_plugins_default})
option(PHUZZ_TESTS "Build the native unit tests (CTest)" ON)
option(PHUZZ_APP "Build the Phuzzbox app (needs the plugins' dependencies, and WebKitGTK on Linux)" ${phuzz_plugins_default})

# The repository root: the web build writes its WebAssembly next to each pedal's page.
get_filename_component(PHUZZ_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/.. ABSOLUTE)
if (EMSCRIPTEN)
  # the committed WebAssembly must not depend on where it was built
  add_compile_options(-ffile-prefix-map=${PHUZZ_ROOT}=. -ffile-prefix-map=${CMAKE_BINARY_DIR}=build)
endif()

include(cmake/dependencies.cmake)
include(cmake/phuzzbox.cmake)

add_subdirectory(core)
if (PHUZZ_PLUGINS)
  add_subdirectory(plugin)
endif()
add_subdirectory(sources/testbass)
add_subdirectory(pedals/buffer)
add_subdirectory(pedals/phuzz)
add_subdirectory(app)
if (PHUZZ_TESTS)
  enable_testing()
  add_subdirectory(tests)
endif()
