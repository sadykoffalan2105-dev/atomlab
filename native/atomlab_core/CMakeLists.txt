# atomlab_core — WASM catalog matcher (Emscripten)

cmake_minimum_required(VERSION 3.16)
project(atomlab_core)

add_library(atomlab_core STATIC
  src/catalog_match.cpp
  src/reactor_balance.cpp
  src/reactor_preview_layout.cpp
  src/reactor_preview_motion.cpp
)

target_compile_features(atomlab_core PUBLIC cxx_std_17)
