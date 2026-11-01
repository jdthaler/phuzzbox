# phuzz_plugin: the CLAP effect every pedal shares; phuzz_add_plugin() (cmake/phuzzbox.cmake)
# makes each pedal's CLAP, VST3, AU v2 and standalone from it.
add_library(phuzz_plugin STATIC plugin.cpp)
target_include_directories(phuzz_plugin PUBLIC .)
target_link_libraries(phuzz_plugin PUBLIC phuzzbox_core clap)
target_include_directories(phuzz_plugin SYSTEM PRIVATE ${choc_SOURCE_DIR})

# The window: the app's (native/app/window.html) in a web view (editor.h), as Forte's plugins
# have theirs. Off, the plugins have no window and the DAW shows its generic panel.
option(PHUZZ_EDITOR "Give the plugins their window (a web view)" ON)
if (PHUZZ_EDITOR)
  set(gen ${CMAKE_CURRENT_BINARY_DIR}/generated)
  set(page native/app/window.html)
  add_custom_command(OUTPUT ${gen}/editor-files.h
    COMMAND ${CMAKE_COMMAND} -DROOT=${PHUZZ_ROOT} -DFILES=${page} -DOUT=${gen}/editor-files.h -P ${CMAKE_CURRENT_SOURCE_DIR}/../cmake/embed.cmake
    DEPENDS ${PHUZZ_ROOT}/${page} ../cmake/embed.cmake VERBATIM)
  add_library(phuzz_editor STATIC editor.cpp ${gen}/editor-files.h)
  target_include_directories(phuzz_editor PRIVATE ${gen})
  target_include_directories(phuzz_editor SYSTEM PUBLIC ${choc_SOURCE_DIR})
  target_link_libraries(phuzz_editor PUBLIC clap)
  if (APPLE)
    target_link_libraries(phuzz_editor PUBLIC "-framework WebKit" "-framework Cocoa")
  elseif (WIN32)
    target_compile_options(phuzz_editor PRIVATE /bigobj)
  else()
    find_package(PkgConfig REQUIRED)
    pkg_check_modules(gtk3 REQUIRED IMPORTED_TARGET gtk+-3.0)
    pkg_check_modules(webkit2 REQUIRED IMPORTED_TARGET webkit2gtk-4.1)
    find_package(X11 REQUIRED)
    target_link_libraries(phuzz_editor PUBLIC PkgConfig::gtk3 PkgConfig::webkit2 X11::X11)
  endif()
  target_link_libraries(phuzz_plugin PUBLIC phuzz_editor)
  target_compile_definitions(phuzz_plugin PRIVATE PHUZZ_EDITOR=1)
endif()
