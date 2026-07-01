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

/** Лимиты и политика layout (слабые устройства). */
int32_t atomlab_max_preview_atoms();
int32_t atomlab_max_preview_terms();
int32_t atomlab_sync_build_atom_cap();
int32_t atomlab_force_sync_layout(
  const uint8_t* terms,
  int32_t term_count,
  int32_t coeff_burst,
  int32_t coeff_editing);
int32_t atomlab_allow_worker_layout(
  const uint8_t* terms,
  int32_t term_count,
  int32_t coeff_burst,
  int32_t coeff_editing);
int32_t atomlab_defer_heavy_layout_rebuild(int32_t atom_count, int32_t coeff_editing);
int32_t atomlab_layout_build_budget_ms(int32_t atom_count);
int32_t atomlab_allow_product_gpu_mount(
  int32_t coeff_burst,
  int32_t coeff_editing,
  int32_t synth_live);
int32_t atomlab_assert_preview_coverage(
  int32_t terms_nonempty,
  int32_t preview_mounted,
  int32_t root_visible,
  int32_t product_painted,
  int32_t synth_live);
int32_t atomlab_validate_preview_terms(const uint8_t* terms, int32_t term_count);

/**
 * Preview atom layout — coeff models, symmetric clusters.
 * out: [x,y,z, z, termIndex, atomInTerm] * N (6 floats per atom).
 */
int32_t reactor_preview_layout(
  const uint8_t* terms,
  int32_t term_count,
  float* out,
  int32_t out_atom_cap
);

}

#endif
