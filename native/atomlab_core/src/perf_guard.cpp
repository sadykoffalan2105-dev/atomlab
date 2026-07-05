// ATOMLAB — лимиты превью реактора и инварианты continuity (WASM/native).
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

/** 1 = layout только sync на main thread (burst / edit / малый N). */
int32_t atomlab_force_sync_layout(
  const uint8_t* terms,
  int32_t term_count,
  int32_t coeff_burst,
  int32_t coeff_editing) {
  if (coeff_burst != 0 || coeff_editing != 0) return 1;
  const int32_t n = estimate_atom_count(terms, term_count);
  if (n <= 0) return 1;
  if (n <= kSyncBuildAtomCap) return 1;
  return 0;
}

/** 1 = можно отдавать layout в worker (тяжёлое уравнение, не burst/edit). */
int32_t atomlab_allow_worker_layout(
  const uint8_t* terms,
  int32_t term_count,
  int32_t coeff_burst,
  int32_t coeff_editing) {
  if (coeff_burst != 0 || coeff_editing != 0) return 0;
  if (!terms || term_count <= 0 || term_count > kMaxPreviewTerms) return 0;
  const int32_t n = estimate_atom_count(terms, term_count);
  if (n <= kWorkerLayoutThreshold) return 0;
  if (n > kMaxPreviewAtoms) return 0;
  return 1;
}

/** 1 = отложить тяжёлый rebuild layout — держать shell на экране. */
int32_t atomlab_defer_heavy_layout_rebuild(int32_t atom_count, int32_t coeff_editing) {
  return (coeff_editing != 0 && atom_count > kSyncBuildAtomCap) ? 1 : 0;
}

/** Бюджет времени sync-build (мс) для слабых GPU. */
int32_t atomlab_layout_build_budget_ms(int32_t atom_count) {
  if (atom_count <= kSyncBuildAtomCap) return 12;
  if (atom_count <= 24) return 20;
  if (atom_count <= 36) return 28;
  return 36;
}

/** 1 = можно монтировать GPU продукта (только live-синтез, не edit). */
int32_t atomlab_allow_product_gpu_mount(
  int32_t coeff_burst,
  int32_t coeff_editing,
  int32_t synth_live) {
  if (coeff_burst != 0 || coeff_editing != 0) return 0;
  return synth_live != 0 ? 1 : 0;
}

/**
 * Инвариант coverage превью. 0 = ok, -1 = not mounted, -2 = root hidden.
 * terms_nonempty: есть реагенты; root_visible: Three.js root.visible.
 */
int32_t atomlab_assert_preview_coverage(
  int32_t terms_nonempty,
  int32_t preview_mounted,
  int32_t root_visible,
  int32_t product_painted,
  int32_t synth_live) {
  if (!terms_nonempty) return 0;
  if (synth_live && product_painted) return 0;
  if (!preview_mounted) return -1;
  if (!root_visible) return -2;
  return 0;
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

/**
 * Сколько слотов атомов держать на экране при +/- (shell-hold).
 * Зеркало TS resolveStablePreviewRenderAtoms — быстрый путь без аллокаций.
 */
int32_t atomlab_shell_render_count(
  int32_t preview_count,
  int32_t shell_count,
  int32_t expected_count,
  int32_t editing) {
  if (expected_count <= 0) {
    if (preview_count > 0) return preview_count;
    return shell_count;
  }
  if (editing == 0) {
    if (preview_count >= expected_count) return preview_count;
    if (preview_count > 0) return preview_count;
    return shell_count;
  }
  if (preview_count >= expected_count) return preview_count;
  if (preview_count == 0 && shell_count > 0) {
    return shell_count >= expected_count ? expected_count : shell_count;
  }
  if (expected_count > preview_count && shell_count > preview_count) {
    if (shell_count >= expected_count) return expected_count;
    return shell_count;
  }
  if (preview_count > 0) return preview_count;
  if (shell_count > 0) {
    return shell_count >= expected_count ? expected_count : shell_count;
  }
  return preview_count;
}

} // extern "C"
