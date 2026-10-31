# dependencies.cmake — every dependency, pinned to a commit (the same pins as Forte's). FetchContent
# downloads them into the build tree at configure time; set FETCHCONTENT_SOURCE_DIR_<NAME> to use
# a local copy. SOURCE_SUBDIR points nowhere, so fetching only downloads.

include(FetchContent)
set(FETCHCONTENT_QUIET ON)

function(phuzz_fetch name repo commit)
  FetchContent_Declare(${name} GIT_REPOSITORY ${repo} GIT_TAG ${commit} SOURCE_SUBDIR fetch-only ${ARGN})
  FetchContent_MakeAvailable(${name})
  set(${name}_SOURCE_DIR ${${name}_SOURCE_DIR} PARENT_SCOPE)
endfunction()

if (PHUZZ_PLUGINS)
  # CLAP 1.2.10 (MIT) is the plugin; clap-wrapper 0.16.0 (MIT) makes the VST3, AU v2 and
  # standalone from it, with the SDKs below.
  phuzz_fetch(clap https://github.com/free-audio/clap 195b42a004144fab0b3cf95e9c067187d15365b7)               # 1.2.10
  phuzz_fetch(clapwrapper https://github.com/free-audio/clap-wrapper 1cca996e96f29ab2be7ae9f8cfe532bbc92e1dd6) # 0.16.0
  phuzz_fetch(vst3sdk https://github.com/steinbergmedia/vst3sdk 9fad9770f2ae8542ab1a548a68c1ad1ac690abe0       # 3.8.0 build 66 (MIT)
    GIT_SUBMODULES base public.sdk pluginterfaces cmake)
  phuzz_fetch(rtaudio https://github.com/thestk/rtaudio b4f04903312e0e0efffbe77655172e0f060dc085)             # 6.0.1, standalone audio
  phuzz_fetch(rtmidi https://github.com/thestk/rtmidi 1e5b49925aa60065db52de44c366d446a902547b)               # 6.0.0, standalone MIDI
  set(CLAP_SDK_ROOT ${clap_SOURCE_DIR} CACHE PATH "" FORCE)
  set(VST3_SDK_ROOT ${vst3sdk_SOURCE_DIR} CACHE PATH "" FORCE)
  set(RTAUDIO_SDK_ROOT ${rtaudio_SOURCE_DIR} CACHE PATH "" FORCE)
  set(RTMIDI_SDK_ROOT ${rtmidi_SOURCE_DIR} CACHE PATH "" FORCE)
  if (APPLE)
    phuzz_fetch(audiounitsdk https://github.com/apple/AudioUnitSDK 53a9a2008aae7fb1b0a9f093dd523b9b12f6c0d9)  # 1.1.0 (Apache 2)
    set(AUDIOUNIT_SDK_ROOT ${audiounitsdk_SOURCE_DIR} CACHE PATH "" FORCE)
  endif()
  if (WIN32)
    phuzz_fetch(wil https://github.com/microsoft/wil f0c6a81c0c9a4b23b6801f40554b8bec425a83b4)                # standalone
    set(WIL_SDK_ROOT ${wil_SOURCE_DIR} CACHE PATH "" FORCE)
  endif()

  if (PHUZZ_APP)
    phuzz_fetch(choc https://github.com/Tracktion/choc 1c3ab9ed0b59a145ad6a2f38e35b601117a657b4)             # 2026-10-08 (ISC), the app's window, as Forte's
  endif()

  set(CLAP_WRAPPER_DOWNLOAD_DEPENDENCIES OFF CACHE BOOL "" FORCE)
  set(CLAP_WRAPPER_BUILD_AUV2 ${APPLE} CACHE BOOL "" FORCE)
  set(CLAP_WRAPPER_BUILD_STANDALONE ON CACHE BOOL "" FORCE)
  add_subdirectory(${clapwrapper_SOURCE_DIR} ${CMAKE_BINARY_DIR}/clap-wrapper EXCLUDE_FROM_ALL)
endif()
