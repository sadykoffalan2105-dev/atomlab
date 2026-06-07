// ATOMLAB reactor balance — fast C++ path for equation validation (WASM)
#include <cstdint>
#include <cstring>

namespace {

struct Pair {
  uint16_t z;
  uint16_t count;
};

/** Interleaved [z0,c0,z1,c1,...] sorted by z. Returns true if equal. */
bool compositions_equal(const uint16_t* a, int32_t n_a, const uint16_t* b, int32_t n_b) {
  if (n_a != n_b) return false;
  if (n_a <= 0) return false;
  const int32_t bytes = n_a * 2 * static_cast<int32_t>(sizeof(uint16_t));
  return std::memcmp(a, b, static_cast<std::size_t>(bytes)) == 0;
}

/** Expand left terms: each term = z(u8), coeff(u8), diatomic(u8). Returns atom count or -1. */
int32_t expand_terms_to_z(
  const uint8_t* terms,
  int32_t term_count,
  uint8_t* out_z,
  int32_t out_cap
) {
  if (!terms || !out_z || term_count < 0 || out_cap < 0) return -1;
  int32_t written = 0;
  for (int32_t i = 0; i < term_count; ++i) {
    const int32_t off = i * 3;
    const uint8_t z = terms[off];
    const uint8_t coeff = terms[off + 1];
    const uint8_t diatomic = terms[off + 2];
    if (z < 1 || coeff < 1) return -1;
    const int32_t atoms = static_cast<int32_t>(coeff) * (diatomic ? 2 : 1);
    if (written + atoms > out_cap) return -1;
    for (int32_t k = 0; k < atoms; ++k) {
      out_z[written++] = z;
    }
  }
  return written;
}

} // namespace

extern "C" {

/**
 * Compare two sorted composition buffers (interleaved z,count pairs).
 * Returns 1 if balanced, 0 if not.
 */
int32_t reactor_balance(
  const uint16_t* left,
  int32_t left_pairs,
  const uint16_t* right,
  int32_t right_pairs
) {
  if (!left || !right || left_pairs < 1 || right_pairs < 1) return 0;
  return compositions_equal(left, left_pairs, right, right_pairs) ? 1 : 0;
}

/** Returns number of z slots written, or -1 on error. */
int32_t reactor_expand_z_slots(
  const uint8_t* terms,
  int32_t term_count,
  uint8_t* out_z,
  int32_t out_cap
) {
  return expand_terms_to_z(terms, term_count, out_z, out_cap);
}

} // extern "C"
