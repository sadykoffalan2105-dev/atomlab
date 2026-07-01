/** TS-зеркало C++ perf_guard (fallback без WASM). */
export const ATOMLAB_MAX_PREVIEW_ATOMS = 48
export const ATOMLAB_MAX_PREVIEW_TERMS = 16
export const ATOMLAB_SYNC_BUILD_ATOM_CAP = 12

export function estimatePreviewAtomCountFromTerms(
  terms: readonly { coeff: number }[],
): number {
  let n = 0
  for (const t of terms) {
    const c = Math.floor(t.coeff)
    if (c > 0) n += c
  }
  return n
}

/** До запуска синтеза — только sync layout (стабильность +/-). */
export function shouldForceSyncPreviewLayout(
  atomCount: number,
  coeffEditing: boolean,
): boolean {
  if (coeffEditing) return true
  if (atomCount <= ATOMLAB_SYNC_BUILD_ATOM_CAP) return true
  return false
}

export function shouldAllowWorkerPreviewLayout(
  atomCount: number,
  coeffEditing: boolean,
): boolean {
  if (coeffEditing) return false
  if (atomCount <= ATOMLAB_SYNC_BUILD_ATOM_CAP) return false
  if (atomCount > ATOMLAB_MAX_PREVIEW_ATOMS) return false
  return true
}
