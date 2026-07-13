/**
 * TS + WASM (atomlab_core) guard for reactor preview continuity and layout policy.
 * Falls back to pure TS when WASM is unavailable.
 */
import {
  ATOMLAB_MAX_PREVIEW_ATOMS,
  ATOMLAB_MAX_PREVIEW_TERMS,
  ATOMLAB_SYNC_BUILD_ATOM_CAP,
  estimatePreviewAtomCountFromTerms,
} from './atomlabPerfGuard'
import { getAtomlabWasmInstanceSync, prefetchAtomlabWasm } from '../wasm/atomlabWasmShared'

export type PreviewCoverageInput = {
  termsNonempty: boolean
  previewMounted: boolean
  rootVisible: boolean
  productPainted: boolean
  synthLive: boolean
}

export type PreviewCoverageResult = 'ok' | 'not_mounted' | 'root_hidden'

type GuardExports = {
  atomlab_defer_heavy_layout_rebuild?: (atomCount: number, coeffEditing: number) => number
  atomlab_layout_build_budget_ms?: (atomCount: number) => number
  atomlab_allow_product_gpu_mount?: (
    coeffBurst: number,
    coeffEditing: number,
    synthLive: number,
  ) => number
  atomlab_assert_preview_coverage?: (
    termsNonempty: number,
    previewMounted: number,
    rootVisible: number,
    productPainted: number,
    synthLive: number,
  ) => number
}

function guardExports(): GuardExports | null {
  const inst = getAtomlabWasmInstanceSync()
  if (!inst) return null
  return inst.exports as unknown as GuardExports
}

/** Прогрев WASM guard (фон). */
export function warmupAtomlabSynthesisGuard(): void {
  prefetchAtomlabWasm()
}

export function deferHeavyLayoutRebuild(atomCount: number, coeffEditing: boolean): boolean {
  const fn = guardExports()?.atomlab_defer_heavy_layout_rebuild
  if (fn) return fn(atomCount, coeffEditing ? 1 : 0) !== 0
  return coeffEditing && atomCount > ATOMLAB_SYNC_BUILD_ATOM_CAP
}

export function layoutBuildBudgetMs(atomCount: number): number {
  const fn = guardExports()?.atomlab_layout_build_budget_ms
  if (fn) return fn(atomCount)
  if (atomCount <= ATOMLAB_SYNC_BUILD_ATOM_CAP) return 12
  if (atomCount <= 24) return 20
  if (atomCount <= 36) return 28
  return 36
}

export function allowProductGpuMount(
  coeffBurst: boolean,
  coeffEditing: boolean,
  synthLive: boolean,
): boolean {
  const fn = guardExports()?.atomlab_allow_product_gpu_mount
  if (fn) {
    return fn(coeffBurst ? 1 : 0, coeffEditing ? 1 : 0, synthLive ? 1 : 0) !== 0
  }
  return synthLive && !coeffBurst && !coeffEditing
}

export function assertPreviewCoverage(input: PreviewCoverageInput): PreviewCoverageResult {
  // Продукт на экране (settled) — скрытый preview root это норма, не «дыра».
  if (input.productPainted && !input.synthLive) return 'ok'
  if (input.synthLive && input.productPainted) return 'ok'

  const fn = guardExports()?.atomlab_assert_preview_coverage
  if (fn) {
    const code = fn(
      input.termsNonempty ? 1 : 0,
      input.previewMounted ? 1 : 0,
      input.rootVisible ? 1 : 0,
      input.productPainted ? 1 : 0,
      input.synthLive ? 1 : 0,
    )
    if (code === -1) return 'not_mounted'
    if (code === -2) return 'root_hidden'
    return 'ok'
  }
  if (!input.termsNonempty) return 'ok'
  if (!input.previewMounted) return 'not_mounted'
  if (!input.rootVisible) return 'root_hidden'
  return 'ok'
}

export function validatePreviewTerms(terms: readonly { coeff: number }[]): number {
  const n = estimatePreviewAtomCountFromTerms(terms)
  if (terms.length <= 0) return -3
  if (terms.length > ATOMLAB_MAX_PREVIEW_TERMS) return -2
  if (n <= 0) return -3
  if (n > ATOMLAB_MAX_PREVIEW_ATOMS) return -4
  return 0
}
