import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import type { ReactorPreviewAtom } from '../../components/lab/reactorPreviewLayout'
import { buildPreviewRenderSnapshot, buildPreviewLayoutIndexed } from '../previewRenderAtoms'
import {
  createPreviewSlotBuffer,
  resolvePreviewSlotBuffer,
  type PreviewSlotBuffer,
} from '../previewSlotBuffer'

export type PreviewEngineState = {
  shellAtoms: readonly ReactorPreviewAtom[]
  maxPool: number
  visibleLatch: boolean
  fullDetailLatch: boolean
  denseLightLatch: boolean
  slotZ: number[]
  editHoldCount: number
  slotBuffer: PreviewSlotBuffer
}

export function createPreviewEngineState(): PreviewEngineState {
  return {
    shellAtoms: [],
    maxPool: 0,
    visibleLatch: false,
    fullDetailLatch: true,
    denseLightLatch: false,
    slotZ: [],
    editHoldCount: 0,
    slotBuffer: createPreviewSlotBuffer(),
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

/** Шаг квантизации пула слотов: при +/- длина массива слотов меняется реже. */
export const PREVIEW_POOL_STEP = 8
export const PREVIEW_POOL_STEP_DENSE = 4
export const PREVIEW_POOL_DENSE_THRESHOLD = 16

export function quantizePoolSize(target: number): number {
  if (target <= 0) return 0
  const step =
    target > PREVIEW_POOL_DENSE_THRESHOLD ? PREVIEW_POOL_STEP_DENSE : PREVIEW_POOL_STEP
  return Math.ceil(target / step) * step
}

export type PreviewEngineFrame = {
  renderAtoms: readonly ReactorPreviewAtom[]
  layoutAtoms: readonly (ReactorPreviewAtom | null)[]
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
  const editing = editingActive || coeffEditing

  const snapshot = buildPreviewRenderSnapshot(
    previewAtoms,
    state.shellAtoms,
    expectedAtomCount,
    editing,
  )
  const renderAtoms = snapshot.atoms

  if (renderAtoms.length > 0) {
    if (!editing) {
      state.shellAtoms = renderAtoms
    } else if (renderAtoms.length >= state.shellAtoms.length) {
      state.shellAtoms = renderAtoms
    } else if (expectedAtomCount < state.shellAtoms.length) {
      const layoutReady = previewAtoms.length >= expectedAtomCount
      if (layoutReady) {
        const target = Math.max(expectedAtomCount, renderAtoms.length)
        const next = state.shellAtoms.slice(0, target)
        for (let i = 0; i < Math.min(renderAtoms.length, next.length); i++) {
          next[i] = renderAtoms[i]!
        }
        state.shellAtoms = next
      } else {
        const next = state.shellAtoms.slice()
        for (let i = 0; i < renderAtoms.length; i++) next[i] = renderAtoms[i]!
        state.shellAtoms = next
      }
    } else {
      const next = state.shellAtoms.slice()
      for (let i = 0; i < renderAtoms.length; i++) next[i] = renderAtoms[i]!
      state.shellAtoms = next
    }
  }

  let slotCount = snapshot.renderCount > 0 ? snapshot.renderCount : renderAtoms.length
  if (expectedAtomCount > 0 && slotCount <= 0) {
    slotCount = Math.max(
      expectedAtomCount,
      previewAtoms.length,
      state.shellAtoms.length,
      renderAtoms.length,
    )
  }

  const indexedSpan = Math.max(
    slotCount,
    expectedAtomCount,
    state.shellAtoms.length,
    renderAtoms.length,
  )
  const indexed = buildPreviewLayoutIndexed(indexedSpan, renderAtoms, state.shellAtoms)
  const buffered = resolvePreviewSlotBuffer(
    state.slotBuffer,
    indexed,
    indexedSpan,
    expectedAtomCount,
    editing,
  )
  slotCount = buffered.displayCount

  state.editHoldCount = editing ? buffered.displayCount : 0

  const quantizedTarget = quantizePoolSize(Math.max(slotCount, expectedAtomCount))
  state.maxPool = Math.max(state.maxPool, quantizedTarget)
  if (!hasActiveTerms || terms.length === 0) {
    state.visibleLatch = false
  }
  if (!lockPoolSize && terms.length === 0 && slotCount === 0) {
    state.maxPool = 0
    state.slotBuffer = createPreviewSlotBuffer()
  }
  const poolSize = state.maxPool

  const layoutAtoms = buffered.slots
  // Seed slotZ from terms flatten so new pool slots mount with correct Z, not H(1).
  const termZs: number[] = []
  for (const t of terms) {
    const c = Math.max(0, Math.floor(t.coeff))
    for (let k = 0; k < c; k++) termZs.push(t.z)
  }
  for (let i = 0; i < slotCount; i++) {
    const atom = layoutAtoms[i]
    state.slotZ[i] = atom?.z ?? termZs[i] ?? state.slotZ[i] ?? 1
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

  if (shouldRender && (previewOnlyMode || synthHoldPreview)) state.visibleLatch = true

  const groupVisible =
    hasActiveTerms &&
    terms.length > 0 &&
    ((previewOnlyMode || synthHoldPreview) && state.visibleLatch
      ? true
      : shouldRender)

  if (slotCount > 16) state.denseLightLatch = true
  else if (!lockPoolSize && slotCount < 12) state.denseLightLatch = false

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
