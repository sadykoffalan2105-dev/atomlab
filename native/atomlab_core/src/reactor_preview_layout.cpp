// ATOMLAB — reactor preview atom layout (C++/WASM, off main thread)
// Mirrors src/components/lab/reactorPreviewLayout.ts (dense packing, min gap).
#include <cmath>
#include <cstdint>

namespace {

constexpr float kPi = 3.14159265358979323846f;
constexpr float kAtomMinGap = 0.52f;
constexpr int32_t kMaxPreviewTerms = 16;
constexpr int32_t kMaxPreviewAtoms = 48;

float layout_mini_radius(int32_t atom_count) {
  if (atom_count <= 1) return 0.0f;
  if (atom_count == 2) return kAtomMinGap * 0.5f / 0.62f;
  if (atom_count <= 8) {
    return kAtomMinGap / (2.0f * std::sin(kPi / static_cast<float>(atom_count)));
  }
  // Outer ring index for concentric pack: 1 + rings of 6,12,18…
  int32_t left = atom_count - 1;
  int32_t ring = 1;
  while (left > 0) {
    const int32_t cap = ring * 6;
    const int32_t take = left < cap ? left : cap;
    left -= take;
    if (left > 0) ring += 1;
  }
  return kAtomMinGap * static_cast<float>(ring);
}

float layout_group_radius(int32_t group_count, int32_t max_cluster) {
  const float base = 1.28f + (group_count < 6 ? group_count : 6) * 0.2f;
  if (group_count <= 1) return base;
  const float cluster_r = layout_mini_radius(max_cluster);
  const float need_sep = 2.0f * cluster_r + kAtomMinGap;
  const float span = 172.0f * kPi / 180.0f;
  const float d_theta = span / static_cast<float>(group_count > 1 ? group_count - 1 : 1);
  const float arc_z = 0.52f;
  const float denom = 2.0f * arc_z * std::sin(d_theta / 2.0f);
  const float r_from_sep = need_sep / (denom > 0.2f ? denom : 0.2f);
  return r_from_sep > base ? r_from_sep : base;
}

void group_center_on_front_arc(
  int32_t group_index,
  int32_t group_count,
  float radius,
  float& out_x,
  float& out_y,
  float& out_z
) {
  if (group_count <= 0) {
    out_x = 0.0f;
    out_y = 0.12f;
    out_z = 0.24f;
    return;
  }
  if (group_count == 1) {
    out_x = 0.0f;
    out_y = 0.12f;
    out_z = 0.24f;
    return;
  }
  const float span = 172.0f * kPi / 180.0f;
  const float start = -kPi / 2.0f - span / 2.0f;
  const float t = static_cast<float>(group_index) / static_cast<float>(group_count - 1);
  const float a = start + t * span;
  out_x = std::sin(a) * radius;
  out_z = std::cos(a) * radius * 0.52f + 0.22f;
  out_y = 0.12f + std::sin(a * 0.38f) * 0.04f;
}

void mini_atom_offset(
  int32_t atom_index,
  int32_t atom_count,
  float mini_r,
  float& ox,
  float& oy,
  float& oz
) {
  if (atom_count <= 1) {
    ox = oy = oz = 0.0f;
    return;
  }
  if (atom_count == 2) {
    ox = atom_index == 0 ? -mini_r * 0.62f : mini_r * 0.62f;
    oy = oz = 0.0f;
    return;
  }
  if (atom_count <= 8) {
    const float a =
      (static_cast<float>(atom_index) / static_cast<float>(atom_count)) * kPi * 2.0f - kPi / 2.0f;
    ox = std::cos(a) * mini_r;
    oy = (atom_index % 2) * 0.02f;
    oz = std::sin(a) * mini_r;
    return;
  }

  // Build ring counts: 1, 6, 12, 18… (same as TS previewClusterRingCounts)
  int32_t rings[16];
  int32_t ring_n = 0;
  rings[ring_n++] = 1;
  int32_t left = atom_count - 1;
  int32_t ring = 1;
  while (left > 0 && ring_n < 16) {
    const int32_t cap = ring * 6;
    const int32_t take = left < cap ? left : cap;
    rings[ring_n++] = take;
    left -= take;
    ring += 1;
  }

  int32_t idx = atom_index;
  int32_t ring_i = 0;
  while (ring_i < ring_n && idx >= rings[ring_i]) {
    idx -= rings[ring_i];
    ring_i += 1;
  }
  if (ring_i >= ring_n) {
    ox = oy = oz = 0.0f;
    return;
  }
  const int32_t count_on_ring = rings[ring_i];
  if (ring_i == 0 && count_on_ring == 1) {
    ox = oy = oz = 0.0f;
    return;
  }
  const float r = kAtomMinGap * static_cast<float>(ring_i);
  const float a =
    (static_cast<float>(idx) / static_cast<float>(count_on_ring > 0 ? count_on_ring : 1)) * kPi * 2.0f -
    kPi / 2.0f + static_cast<float>(ring_i) * 0.12f;
  oy = (ring_i % 2 == 0 ? 0.0f : 0.028f) + (idx % 2) * 0.014f;
  ox = std::cos(a) * r;
  oz = std::sin(a) * r;
}

} // namespace

extern "C" {

/**
 * Layout preview atoms for reactor (coeff = model count, O2 = one atom per coeff).
 * terms: [z(u8), coeff(u8), diatomic(u8)] * term_count
 * out: [x,y,z, z(u8 as float), term_index, atom_in_term] * written_atoms
 * Returns atom count or -1.
 */
int32_t reactor_preview_layout(
  const uint8_t* terms,
  int32_t term_count,
  float* out,
  int32_t out_atom_cap
) {
  if (!terms || !out || term_count < 0 || out_atom_cap < 0) return -1;
  if (term_count > kMaxPreviewTerms) return -1;

  int32_t atom_budget = 0;
  int32_t max_cluster = 0;
  int32_t active = 0;
  for (int32_t i = 0; i < term_count; ++i) {
    const uint8_t coeff = terms[i * 3 + 1];
    if (coeff > 0) {
      atom_budget += static_cast<int32_t>(coeff);
      if (static_cast<int32_t>(coeff) > max_cluster) max_cluster = static_cast<int32_t>(coeff);
      active++;
    }
  }
  if (atom_budget <= 0) return 0;
  if (atom_budget > kMaxPreviewAtoms) return -1;
  if (out_atom_cap < atom_budget) return -1;
  if (active <= 0) return 0;

  const float group_r = layout_group_radius(active, max_cluster);
  int32_t written = 0;
  int32_t group_i = 0;

  for (int32_t ti = 0; ti < term_count; ++ti) {
    const int32_t off = ti * 3;
    const uint8_t z = terms[off];
    const uint8_t coeff = terms[off + 1];
    if (coeff < 1 || z < 1) continue;

    float cx, cy, cz;
    group_center_on_front_arc(group_i, active, group_r, cx, cy, cz);
    group_i++;

    const int32_t shown = static_cast<int32_t>(coeff);
    const float mini_r = layout_mini_radius(shown);

    for (int32_t ai = 0; ai < shown; ++ai) {
      if (written >= out_atom_cap) return -1;
      float ox, oy, oz;
      mini_atom_offset(ai, shown, mini_r, ox, oy, oz);
      const int32_t base = written * 6;
      out[base + 0] = cx + ox;
      out[base + 1] = cy + oy;
      out[base + 2] = cz + oz;
      out[base + 3] = static_cast<float>(z);
      out[base + 4] = static_cast<float>(group_i - 1);
      out[base + 5] = static_cast<float>(ai);
      written++;
    }
  }

  return written;
}

} // extern "C"
