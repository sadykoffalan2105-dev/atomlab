#ifndef ATOMLAB_CORE_H
#define ATOMLAB_CORE_H

#include <cstdint>

extern "C" {

/** Sorted interleaved (z, count) pairs — returns 1 if left == right composition. */
int32_t reactor_balance(
  const uint16_t* left,
  int32_t left_pairs,
  const uint16_t* right,
  int32_t right_pairs
);

/** Expand packed terms [z,coeff,diatomic]*n into z atomic numbers. Returns count or -1. */
int32_t reactor_expand_z_slots(
  const uint8_t* terms,
  int32_t term_count,
  uint8_t* out_z,
  int32_t out_cap
);

/** Catalog match stub (worker handles full catalog in JS). */
int32_t catalog_match(const uint8_t* terms, int32_t terms_len, uint8_t* out, int32_t out_cap);

}

#endif
