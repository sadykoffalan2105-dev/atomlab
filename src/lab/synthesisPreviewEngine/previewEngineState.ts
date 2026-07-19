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

/** Шаг квантизации пула слотов: при idle длина массива слотов меняется реже. */
export const PREVIEW_POOL_STEP = 8
export const PREVIEW_POOL_STEP_DENSE = 4
export const PREVIEW_POOL_DENSE_THRESHOLD = 16
/** При горячем +/- растим пул мельче — меньше cold-mount Bohr за один клик. */
export const PREVIEW_POOL_STEP_BURST = 2

export function quantizePoolSize(target: number, burst = false): number {
  if (target <= 0) return 0
  if (burst) {
    return Math.ceil(target / PREVIEW_POOL_STEP_BURST) * PREVIEW_POOL_STEP_BURST
  }
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
    /** Горячий +/- — меньший шаг роста пула. */
    hotCoeffEdit?: boolean
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
    hotCoeffEdit = false,
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

  const targetSlots = Math.max(slotCount, expectedAtomCount, buffered.displayCount)
  const quantizedTarget = quantizePoolSize(targetSlots, hotCoeffEdit)
  /** Hot/settle: пул сразу = target (щит). Без +2/кадр — иначе «дыры» на дихромате. */
  if (hotCoeffEdit) {
    state.maxPool = Math.max(state.maxPool, quantizedTarget, targetSlots)
  } else {
    state.maxPool = Math.max(state.maxPool, quantizedTarget, editing ? targetSlots : 0)
  }
  // Жёсткий инвариант: при ненулевом expected пул покрывает все слоты (нет «пропавших» mount).
  if (expectedAtomCount > 0 && state.maxPool < targetSlots) {
    state.maxPool = targetSlots
  }
  // Pre-synth: пул = target + небольшой запас (не 32 Bohr сразу — GPU hitch / white flash).
  if ((previewOnlyMode || editing) && expectedAtomCount > 0) {
    const softCap = Math.min(24, Math.max(targetSlots + 2, expectedAtomCount + 2))
    state.maxPool = Math.max(state.maxPool, softCap, targetSlots)
  }
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

  /**
   * Визуальный tier: в pre-synth/edit держим cosmic full (не lite),
   * чтобы nebula/орбиты не пропадали. Lite только при очень плотном idle.
   */
  const sessionHold = previewOnlyMode || synthHoldPreview || coeffEditing || lockPoolSize
  if (!hasActiveTerms || terms.length === 0) {
    state.denseLightLatch = false
    state.fullDetailLatch = true
  } else if (sessionHold) {
    state.denseLightLatch = false
    state.fullDetailLatch = true
  } else if (slotCount >= 20 || expectedAtomCount >= 20 || state.denseLightLatch) {
    state.denseLightLatch = true
    state.fullDetailLatch = false
  } else if (slotCount > 0 && slotCount < 20) {
    state.denseLightLatch = false
    state.fullDetailLatch = true
  }

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
