# The Phuzzbox app: a pedal at a time (pedals.cpp) in a window of its own, through the audio interface at small buffers
# (main.cpp). Its window is app/window.html (tools/bundle-app.mjs), embedded in the program.

# the audio engine and the pedals, for the tests
add_library(phuzz_app_engine STATIC engine.cpp pedals.cpp)
target_include_directories(phuzz_app_engine PUBLIC .)
target_link_libraries(phuzz_app_engine PUBLIC phuzzbox_core phuzz_buffer phuzz_phuzz)

if (NOT PHUZZ_APP OR NOT PHUZZ_PLUGINS)
  return()
endif()

guarantee_rtaudio() # clap-wrapper's: RtAudio 6.0.1 from RTAUDIO_SDK_ROOT, as the target rtaudio

set(gen ${CMAKE_CURRENT_BINARY_DIR}/generated)
set(page native/app/window.html)
add_custom_command(OUTPUT ${gen}/embedded-files.h
  COMMAND ${CMAKE_COMMAND} -DROOT=${PHUZZ_ROOT} -DFILES=${page} -DOUT=${gen}/embedded-files.h -P ${CMAKE_CURRENT_SOURCE_DIR}/../cmake/embed.cmake
  DEPENDS ${PHUZZ_ROOT}/${page} ../cmake/embed.cmake VERBATIM)

set(icon "")
if (APPLE)
  set(icon ${CMAKE_CURRENT_SOURCE_DIR}/../icons/phuzzbox.icns)
  set_source_files_properties(${icon} PROPERTIES MACOSX_PACKAGE_LOCATION Resources)
elseif (WIN32)
  set(icon ${CMAKE_CURRENT_BINARY_DIR}/generated/phuzzbox.rc)
  file(WRITE ${icon} "1 ICON \"${CMAKE_CURRENT_SOURCE_DIR}/../icons/phuzzbox.ico\"\n")
endif()

add_executable(phuzz_app WIN32 MACOSX_BUNDLE main.cpp ${gen}/embedded-files.h ${icon})
target_include_directories(phuzz_app PRIVATE ${gen})
target_include_directories(phuzz_app SYSTEM PRIVATE ${choc_SOURCE_DIR} ${RTAUDIO_SDK_ROOT})
target_link_libraries(phuzz_app PRIVATE phuzz_app_engine rtaudio)
file(READ ${PHUZZ_ROOT}/package.json package)
string(JSON PHUZZ_APP_VERSION GET "${package}" version)
set_target_properties(phuzz_app PROPERTIES OUTPUT_NAME Phuzzbox RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/app)
if (APPLE)
  set_target_properties(phuzz_app PROPERTIES
    MACOSX_BUNDLE_INFO_PLIST ${CMAKE_CURRENT_SOURCE_DIR}/Info.plist.in
    MACOSX_BUNDLE_BUNDLE_NAME Phuzzbox
    MACOSX_BUNDLE_GUI_IDENTIFIER net.jthaler.phuzzbox.app
    MACOSX_BUNDLE_BUNDLE_VERSION ${PHUZZ_APP_VERSION}
    MACOSX_BUNDLE_SHORT_VERSION_STRING ${PHUZZ_APP_VERSION}
    MACOSX_BUNDLE_ICON_FILE phuzzbox.icns)
  target_link_libraries(phuzz_app PRIVATE "-framework WebKit" "-framework Cocoa")
  # an ad-hoc signature, without which an Apple-silicon Mac won't run a downloaded app at all
  add_custom_command(TARGET phuzz_app POST_BUILD COMMAND codesign --force --deep --sign - $<TARGET_BUNDLE_DIR:phuzz_app> VERBATIM)
elseif (WIN32)
  target_compile_options(phuzz_app PRIVATE /bigobj)
  target_compile_definitions(phuzz_app PRIVATE NOMINMAX)
  # a window, no console, with main() as the entry point rather than WinMain()
  target_link_options(phuzz_app PRIVATE /ENTRY:mainCRTStartup)
else()
  find_package(PkgConfig REQUIRED)
  pkg_check_modules(gtk3 REQUIRED IMPORTED_TARGET gtk+-3.0)
  pkg_check_modules(webkit2 REQUIRED IMPORTED_TARGET webkit2gtk-4.1)
  target_link_libraries(phuzz_app PRIVATE PkgConfig::gtk3 PkgConfig::webkit2)
endif()
