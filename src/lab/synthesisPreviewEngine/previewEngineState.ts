import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import type { ReactorPreviewAtom } from '../../components/lab/reactorPreviewLayout'
import { buildPreviewRenderSnapshot } from '../previewRenderAtoms'
import { mergePreviewLayoutSlots } from '../previewLayoutSlots'

export type PreviewEngineState = {
  shellAtoms: readonly ReactorPreviewAtom[]
  maxPool: number
  visibleLatch: boolean
  fullDetailLatch: boolean
  denseLightLatch: boolean
  slotZ: number[]
}

export function createPreviewEngineState(): PreviewEngineState {
  return {
    shellAtoms: [],
    maxPool: 0,
    visibleLatch: false,
    fullDetailLatch: false,
    denseLightLatch: false,
    slotZ: [],
  }
}

export function estimateExpectedAtomCount(terms: readonly ReactorEquationTerm[]): number {
  let count = 0
  for (const t of terms) {
    const c = Math.floor(t.coeff)
    if (c > 0) count += c
  }
  return count
}

/**
 * Шаг квантизации пула слотов: при +/- длина массива слотов меняется реже,
 * поэтому React не монтирует/размонтирует узлы на каждый шаг — только переключает
 * visible у уже смонтированных слотов. Это убирает «мигание» на сложных
 * уравнениях с большим числом коэффициентов.
 */
export const PREVIEW_POOL_STEP = 8

export function quantizePoolSize(target: number): number {
  if (target <= 0) return 0
  return Math.ceil(target / PREVIEW_POOL_STEP) * PREVIEW_POOL_STEP
}

export type PreviewEngineFrame = {
  renderAtoms: readonly ReactorPreviewAtom[]
  layoutAtoms: readonly ReactorPreviewAtom[]
  slotCount: number
  poolSize: number
  groupVisible: boolean
  expectedAtomCount: number
  hasActiveTerms: boolean
}

export function resolvePreviewEngineFrame(
  state: PreviewEngineState,
  opts: {
    terms: readonly ReactorEquationTerm[]
    previewAtoms: readonly ReactorPreviewAtom[]
    editingActive: boolean
    previewOnlyMode: boolean
    synthHoldPreview: boolean
    coeffEditing: boolean
    layoutPending: boolean
    lockPoolSize: boolean
  },
): PreviewEngineFrame {
  const {
    terms,
    previewAtoms,
    editingActive,
    previewOnlyMode,
    synthHoldPreview,
    coeffEditing,
    layoutPending,
    lockPoolSize,
  } = opts

  const expectedAtomCount = estimateExpectedAtomCount(terms)
  const hasActiveTerms = expectedAtomCount > 0

  const snapshot = buildPreviewRenderSnapshot(
    previewAtoms,
    state.shellAtoms,
    expectedAtomCount,
    editingActive,
  )
  const renderAtoms = snapshot.atoms
  if (renderAtoms.length > 0) {
    state.shellAtoms = renderAtoms
  }

  const slotCount = snapshot.renderCount > 0 ? snapshot.renderCount : renderAtoms.length
  const quantizedTarget = quantizePoolSize(Math.max(slotCount, expectedAtomCount))
  state.maxPool = Math.max(state.maxPool, quantizedTarget)
  if (!lockPoolSize && terms.length === 0 && slotCount === 0) {
    state.maxPool = 0
  }
  const poolSize = state.maxPool

  const layoutAtoms = mergePreviewLayoutSlots(slotCount, renderAtoms, state.shellAtoms)
  for (let i = 0; i < slotCount; i++) {
    state.slotZ[i] = layoutAtoms[i]?.z ?? state.slotZ[i] ?? 1
  }

  const shouldRender =
    terms.length > 0 &&
    hasActiveTerms &&
    (previewOnlyMode ||
      synthHoldPreview ||
      coeffEditing ||
      layoutPending ||
      slotCount > 0 ||
      state.shellAtoms.length > 0)

  if (shouldRender && previewOnlyMode) state.visibleLatch = true
  const groupVisible =
    previewOnlyMode && state.visibleLatch && hasActiveTerms
      ? true
      : shouldRender || (previewOnlyMode && state.visibleLatch && hasActiveTerms)

  if (slotCount > 16) state.denseLightLatch = true
  else if (slotCount < 12) state.denseLightLatch = false

  return {
    renderAtoms,
    layoutAtoms,
    slotCount,
    poolSize,
    groupVisible,
    expectedAtomCount,
    hasActiveTerms,
  }
}
