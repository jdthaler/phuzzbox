# phuzzbox.cmake — building a pedal (after Forte's cmake/forte.cmake).

set(PHUZZ_PLUGIN_DIR ${CMAKE_CURRENT_LIST_DIR}/../plugin)
set(PHUZZ_WEB_DIR ${CMAKE_CURRENT_LIST_DIR}/../web)

# phuzz_add_plugin(<slug> NAME <name> VERSION <x.y.z> AU_SUBTYPE <code> PEDAL <library>)
#
# <library> holds the pedal's effect and its PedalInfo (it defines phuzz_pedal()). Makes
# phuzz_<slug>_clap, _vst3, _auv2 (macOS) and _standalone into ${CMAKE_BINARY_DIR}/plugins, and
# phuzz_<slug>_all to build them all. Plugin ids: net.jthaler.phuzzbox.<slug>; AU manufacturer Phzz,
# type aufx (an effect).
function(phuzz_add_plugin slug)
  cmake_parse_arguments(A "" "NAME;VERSION;AU_SUBTYPE;PEDAL" "" ${ARGN})
  target_compile_definitions(${A_PEDAL} PRIVATE "PHUZZ_PEDAL_VERSION=\"${A_VERSION}\"")
  set(impl phuzz_${slug}_impl)
  add_library(${impl} STATIC ${PHUZZ_PLUGIN_DIR}/entry-impl.cpp)
  target_link_libraries(${impl} PUBLIC phuzz_plugin ${A_PEDAL})
  make_clapfirst_plugins(
    TARGET_NAME phuzz_${slug}
    IMPL_TARGET ${impl}
    OUTPUT_NAME "${A_NAME}"
    ENTRY_SOURCE ${PHUZZ_PLUGIN_DIR}/entry.cpp
    BUNDLE_IDENTIFIER "net.jthaler.phuzzbox.${slug}"
    BUNDLE_VERSION "${A_VERSION}"
    COPY_AFTER_BUILD FALSE
    WINDOWS_FOLDER_VST3 TRUE
    PLUGIN_FORMATS CLAP VST3 AUV2
    ASSET_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/plugins
    AUV2_MANUFACTURER_NAME "Phuzzbox"
    AUV2_MANUFACTURER_CODE "Phzz"
    AUV2_SUBTYPE_CODE "${A_AU_SUBTYPE}"
    AUV2_INSTRUMENT_TYPE "aufx"
    STANDALONE_CONFIGURATIONS standalone "${A_NAME}" "net.jthaler.phuzzbox.${slug}"
  )
endfunction()

set(PHUZZ_WASM_LINK --no-entry -sSTANDALONE_WASM -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=4mb
  -sSTACK_SIZE=256kb -fno-exceptions -sFILESYSTEM=0 -sEXPORTED_FUNCTIONS=_malloc,_free)

# phuzz_add_wasm(<slug> PEDAL <library> OUT <path.wasm> [SOURCES <model bindings…>])
#
# The pedal's WebAssembly for the website: the effect contract (web/effect-api.cpp) and the model
# functions its views and tests call (SOURCES), as a standalone .wasm with no JavaScript glue
# (shared/wasm.js loads it), copied to OUT, next to the page. It is committed.
function(phuzz_add_wasm slug)
  cmake_parse_arguments(A "" "PEDAL;OUT" "SOURCES" ${ARGN})
  set(t phuzz_${slug}_wasm)
  add_executable(${t} ${PHUZZ_WEB_DIR}/effect-api.cpp ${A_SOURCES})
  target_link_libraries(${t} PRIVATE ${A_PEDAL})
  set_target_properties(${t} PROPERTIES OUTPUT_NAME ${slug} SUFFIX ".wasm")
  target_compile_options(${t} PRIVATE -fno-exceptions)
  target_link_options(${t} PRIVATE ${PHUZZ_WASM_LINK})
  get_filename_component(dir ${A_OUT} DIRECTORY)
  add_custom_command(TARGET ${t} POST_BUILD COMMAND ${CMAKE_COMMAND} -E make_directory ${dir}
                     COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:${t}> ${A_OUT} VERBATIM)
endfunction()

# phuzz_add_wasm_source(<name> LIBRARY <library> OUT <path.wasm> SOURCES <bindings…>)
#
# A signal source (the test bass) as WebAssembly: its own bindings, no effect contract.
function(phuzz_add_wasm_source name)
  cmake_parse_arguments(A "" "LIBRARY;OUT" "SOURCES" ${ARGN})
  set(t phuzz_${name}_wasm)
  add_executable(${t} ${A_SOURCES})
  target_link_libraries(${t} PRIVATE ${A_LIBRARY})
  set_target_properties(${t} PROPERTIES OUTPUT_NAME ${name} SUFFIX ".wasm")
  target_compile_options(${t} PRIVATE -fno-exceptions)
  target_link_options(${t} PRIVATE ${PHUZZ_WASM_LINK})
  get_filename_component(dir ${A_OUT} DIRECTORY)
  add_custom_command(TARGET ${t} POST_BUILD COMMAND ${CMAKE_COMMAND} -E make_directory ${dir}
                     COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:${t}> ${A_OUT} VERBATIM)
endfunction()
