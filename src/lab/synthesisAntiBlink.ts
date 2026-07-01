import type { MutableRefObject } from 'react'
import { synthesisContinuityCoveredV2 } from './visualCoverageController'

export type SynthesisStickyMountRef = {
  runId: number
  compoundId: string
  productMounted: boolean
}

export type SynthesisPreviewStickyRef = {
  runId: number
  previewMounted: boolean
}

export type SynthesisContinuityInput = {
  runId: number
  synthActive: boolean
  synthesisRunActive: boolean
  synthesisPhase: string
  showSettledHero: boolean
  mountReactorPreview: boolean
  reactorViewOpen: boolean
  gpuPrewarmAllowed: boolean
  prewarmReady: boolean
  productCompoundId: string | null
  earlyProductReveal: boolean
  forceProductSlot: boolean
  productRevealReady: boolean
  productPainted?: boolean
  keepPreviewDuringProduct?: boolean
  coeffEditBurst?: boolean
  /** burst или !editIdle — любое редактирование уравнения */
  coeffEditing?: boolean
  stickyMountRef: MutableRefObject<SynthesisStickyMountRef | null>
  previewStickyRef: MutableRefObject<SynthesisPreviewStickyRef | null>
}

export type SynthesisContinuityView = {
  reactorPreviewVisible: boolean
  reactorPreviewMounted: boolean
  productMeshMounted: boolean
  productSlotVisible: boolean
  productPrewarm: boolean
  holdVisualOverlap: boolean
}

/**
 * Инвариант:
 * - при редактировании +/- — атомы видны;
 * - после отрисовки молекулы — только продукт (атомы скрыты);
 * - settled — превью размонтировано.
 */
export function resolveSynthesisContinuity(input: SynthesisContinuityInput): SynthesisContinuityView {
  const {
    runId,
    synthActive,
    synthesisRunActive,
    showSettledHero,
    mountReactorPreview,
    reactorViewOpen,
    gpuPrewarmAllowed: _gpuPrewarmAllowed,
    prewarmReady: _prewarmReady,
    productCompoundId,
    forceProductSlot: _forceProductSlot,
    productRevealReady,
    productPainted = false,
    keepPreviewDuringProduct = false,
    coeffEditBurst = false,
    coeffEditing = coeffEditBurst,
    stickyMountRef,
    previewStickyRef,
  } = input

  /** Жёсткий override: +/- — только превью атомов, без product GPU (zero black screen). */
  if (
    coeffEditing &&
    mountReactorPreview &&
    reactorViewOpen &&
    !synthActive &&
    !synthesisRunActive
  ) {
    previewStickyRef.current = { runId: -1, previewMounted: true }
    return {
      reactorPreviewVisible: true,
      reactorPreviewMounted: true,
      productMeshMounted: false,
      productSlotVisible: false,
      productPrewarm: false,
      holdVisualOverlap: false,
    }
  }

  const synthLive = synthActive || synthesisRunActive

  const earlyGpuPrewarm =
    !synthLive &&
    !showSettledHero &&
    !coeffEditing &&
    !coeffEditBurst &&
    _gpuPrewarmAllowed &&
    productCompoundId != null &&
    reactorViewOpen

  if (productCompoundId && reactorViewOpen) {
    if (synthLive && runId > 0) {
      stickyMountRef.current = { runId, compoundId: productCompoundId, productMounted: true }
    } else if (earlyGpuPrewarm || showSettledHero) {
      stickyMountRef.current = { runId: 0, compoundId: productCompoundId, productMounted: true }
    }
  }

  if (!synthLive && !showSettledHero && !earlyGpuPrewarm && !productCompoundId) {
    stickyMountRef.current = null
  }

  const sticky = stickyMountRef.current
  const stickyMatch =
    sticky != null &&
    productCompoundId != null &&
    sticky.compoundId === productCompoundId &&
    sticky.productMounted

  const productMeshMounted =
    !coeffEditing &&
    !coeffEditBurst &&
    productCompoundId != null &&
    reactorViewOpen &&
    (showSettledHero || (stickyMatch && ((synthLive && runId > 0) || earlyGpuPrewarm)))

  const productSlotVisible =
    productMeshMounted &&
    (showSettledHero ||
      (synthActive &&
        runId > 0 &&
        productRevealReady &&
        (_prewarmReady || _forceProductSlot)))

  /** Молекула на экране — атомы скрываем только после реальной отрисовки продукта. */
  const productTakeover =
    productSlotVisible &&
    productPainted &&
    (showSettledHero || (synthLive && productRevealReady))

  /** Settled, но продукт ещё не отрисован — держим shell превью (без чёрного кадра). */
  const settledHandoff = showSettledHero && productSlotVisible && !productPainted

  const editingEquation =
    !synthLive && !showSettledHero && !productTakeover && mountReactorPreview && reactorViewOpen

  const synthPreviewLock =
    synthLive &&
    mountReactorPreview &&
    reactorViewOpen &&
    !showSettledHero &&
    !productTakeover &&
    (keepPreviewDuringProduct || !productPainted)

  if (showSettledHero && productPainted) {
    previewStickyRef.current = null
  } else if (editingEquation) {
    previewStickyRef.current = { runId: runId > 0 ? runId : -1, previewMounted: true }
  } else if (synthLive && runId > 0 && mountReactorPreview) {
    previewStickyRef.current = { runId, previewMounted: true }
  } else if (!synthLive && !showSettledHero && !mountReactorPreview) {
    previewStickyRef.current = null
  }

  const previewSticky =
    previewStickyRef.current != null && previewStickyRef.current.previewMounted

  /** Держим shell превью во время synthLive и settled-handoff — без «пустого» кадра. */
  const reactorPreviewMounted =
    mountReactorPreview &&
    reactorViewOpen &&
    (editingEquation || synthLive || synthPreviewLock || previewSticky || settledHandoff)

  const productPrewarm = productMeshMounted && !productSlotVisible && !showSettledHero
  const holdVisualOverlap = (synthLive || settledHandoff) && !productTakeover

  /** Редактирование +/- — атомы всегда видны, пока есть terms (без takeover). */
  const reactorEditVisible =
    mountReactorPreview && reactorViewOpen && !synthLive && !showSettledHero && !productTakeover

  const reactorPreviewVisible =
    reactorPreviewMounted &&
    !productTakeover &&
    (reactorEditVisible || synthPreviewLock || settledHandoff)

  const synthEmptyGuard =
    synthLive &&
    reactorPreviewMounted &&
    !productTakeover &&
    !productSlotVisible &&
    !productPrewarm &&
    !showSettledHero &&
    !reactorPreviewVisible

  return {
    reactorPreviewVisible: synthEmptyGuard ? true : reactorPreviewVisible,
    reactorPreviewMounted,
    productMeshMounted,
    productSlotVisible,
    productPrewarm,
    holdVisualOverlap,
  }
}

export function synthesisContinuityCovered(
  view: SynthesisContinuityView,
  mergeFx: boolean,
  convergeFx: boolean,
  editMode = false,
): boolean {
  return synthesisContinuityCoveredV2(view, mergeFx, convergeFx, editMode)
}
