// ATOMLAB — лимиты превью реактора для слабых устройств (WASM/native).
#include <cstdint>

namespace {

constexpr int32_t kMaxPreviewAtoms = 48;
constexpr int32_t kMaxPreviewTerms = 16;
constexpr int32_t kSyncBuildAtomCap = 12;
constexpr int32_t kWorkerLayoutThreshold = 13;

int32_t estimate_atom_count(const uint8_t* terms, int32_t term_count) {
  if (!terms || term_count <= 0) return 0;
  int32_t total = 0;
  for (int32_t i = 0; i < term_count; ++i) {
    const int32_t coeff = static_cast<int32_t>(terms[i * 3 + 1]);
    if (coeff > 0) total += coeff;
  }
  return total;
}

} // namespace

extern "C" {

int32_t atomlab_max_preview_atoms() { return kMaxPreviewAtoms; }

int32_t atomlab_max_preview_terms() { return kMaxPreviewTerms; }

int32_t atomlab_sync_build_atom_cap() { return kSyncBuildAtomCap; }

/** 1 = layout только sync на main thread (burst / малый N). */
int32_t atomlab_force_sync_layout(const uint8_t* terms, int32_t term_count, int32_t coeff_burst) {
  if (coeff_burst != 0) return 1;
  const int32_t n = estimate_atom_count(terms, term_count);
  if (n <= 0) return 1;
  if (n <= kSyncBuildAtomCap) return 1;
  return 0;
}

/** 1 = можно отдавать layout в worker (тяжёлое уравнение, не burst). */
int32_t atomlab_allow_worker_layout(const uint8_t* terms, int32_t term_count, int32_t coeff_burst) {
  if (coeff_burst != 0) return 0;
  if (!terms || term_count <= 0 || term_count > kMaxPreviewTerms) return 0;
  const int32_t n = estimate_atom_count(terms, term_count);
  if (n <= kWorkerLayoutThreshold) return 0;
  if (n > kMaxPreviewAtoms) return 0;
  return 1;
}

/** Валидация входа; 0 = ok, иначе код ошибки. */
int32_t atomlab_validate_preview_terms(const uint8_t* terms, int32_t term_count) {
  if (!terms) return -1;
  if (term_count < 0 || term_count > kMaxPreviewTerms) return -2;
  const int32_t n = estimate_atom_count(terms, term_count);
  if (n <= 0) return -3;
  if (n > kMaxPreviewAtoms) return -4;
  return 0;
}

} // extern "C"
