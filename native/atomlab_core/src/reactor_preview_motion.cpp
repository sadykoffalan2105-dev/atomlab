// ATOMLAB — reactor preview Bohr motion (C++/WASM)
// Mirrors src/lab/reactorPreviewMotionEngine.ts
#include <cmath>
#include <cstdint>

namespace {

constexpr float kPi = 3.14159265358979323846f;
constexpr int32_t kDenseFrom = 10;
constexpr int32_t kUltraDenseFrom = 18;
constexpr float kSpinSlow = 0.032f;
constexpr float kSpinNormal = 0.045f;
constexpr float kDriftNormal = 0.032f;
constexpr float kDriftDense = 0.018f;
constexpr float kDriftUltra = 0.012f;

} // namespace

extern "C" {

/** 1 если slot_count ≥ dense → lite-материалы обязательны. */
int32_t reactor_preview_force_lite(int32_t slot_count) {
  return slot_count >= kDenseFrom ? 1 : 0;
}

float reactor_preview_spin_rate(int32_t slot_count) {
  return slot_count >= kDenseFrom ? kSpinSlow : kSpinNormal;
}

float reactor_preview_drift_amp(int32_t slot_count) {
  if (slot_count >= kUltraDenseFrom) return kDriftUltra;
  if (slot_count >= kDenseFrom) return kDriftDense;
  return kDriftNormal;
}

/**
 * out_xyz[3] = drift offset для слота.
 * Совпадает с samplePreviewAtomMotion (TS).
 */
void reactor_preview_motion_sample(
  float elapsed_sec,
  int32_t slot_index,
  int32_t atomic_z,
  float drift_amp,
  float* out_xyz
) {
  if (!out_xyz) return;
  const float ph = static_cast<float>(slot_index) * 1.6f + static_cast<float>(atomic_z) * 0.37f;
  const float t = elapsed_sec;
  out_xyz[0] = std::sin(t * 0.32f + ph) * drift_amp;
  out_xyz[1] = std::sin(t * 0.25f + ph * 0.9f) * drift_amp * 0.7f;
  out_xyz[2] = std::cos(t * 0.28f + ph * 1.05f) * drift_amp;
}

float reactor_preview_root_spin(float elapsed_sec, float spin_rate) {
  return elapsed_sec * spin_rate;
}

} // extern "C"
