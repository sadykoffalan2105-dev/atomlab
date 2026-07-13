import type { MutableRefObject } from 'react'

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
 * - при редактировании +/- — Bohr-атомы видны;
 * - как только product slot на полном масштабе — Bohr СКРЫТ (молекула CPK без орбит);
 * - shell остаётся смонтированным скрытым, чтобы +/- не делал cold remount.
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

  const userEditing = (coeffEditing || coeffEditBurst) && mountReactorPreview && reactorViewOpen

  /** До запуска / при edit после settled: атомы видны; product GPU — micro-scale prewarm. */
  const preSynthesisReactor =
    mountReactorPreview &&
    reactorViewOpen &&
    !synthActive &&
    !synthesisRunActive &&
    (!showSettledHero || userEditing)

  if (preSynthesisReactor) {
    previewStickyRef.current = { runId: -1, previewMounted: true }
    const canPrewarmProduct =
      productCompoundId != null &&
      !coeffEditBurst &&
      !coeffEditing &&
      !userEditing &&
      _gpuPrewarmAllowed
    if (canPrewarmProduct) {
      stickyMountRef.current = {
        runId: 0,
        compoundId: productCompoundId,
        productMounted: true,
      }
    }
    return {
      reactorPreviewVisible: true,
      reactorPreviewMounted: true,
      productMeshMounted: canPrewarmProduct,
      productSlotVisible: false,
      productPrewarm: canPrewarmProduct,
      holdVisualOverlap: false,
    }
  }

  const synthLive = synthActive || synthesisRunActive

  const earlyGpuPrewarm =
    !synthLive &&
    !showSettledHero &&
    !coeffEditing &&
    !coeffEditBurst &&
    !userEditing &&
    _gpuPrewarmAllowed &&
    productCompoundId != null &&
    reactorViewOpen

  if (productCompoundId && reactorViewOpen) {
    if (synthLive && runId > 0) {
      stickyMountRef.current = { runId, compoundId: productCompoundId, productMounted: true }
    } else if (earlyGpuPrewarm || (showSettledHero && !userEditing)) {
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
    !userEditing &&
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

  /**
   * Как только продукт в полном слоте — Bohr уходит.
   * Не ждём productPainted: иначе орбиты/ядра залипают поверх молекулы навсегда.
   */
  const productOwnsScreen =
    !userEditing &&
    productSlotVisible &&
    (showSettledHero || productPainted || (synthLive && productRevealReady))

  const settledWaitingPaint =
    showSettledHero && productSlotVisible && !productPainted && !userEditing

  const editingEquation =
    !synthLive &&
    !productOwnsScreen &&
    mountReactorPreview &&
    reactorViewOpen &&
    (!showSettledHero || userEditing)

  const synthPreviewLock =
    synthLive &&
    mountReactorPreview &&
    reactorViewOpen &&
    !showSettledHero &&
    !productOwnsScreen &&
    (keepPreviewDuringProduct || !productPainted) &&
    !productSlotVisible

  if (userEditing || editingEquation) {
    previewStickyRef.current = { runId: runId > 0 ? runId : -1, previewMounted: true }
  } else if (synthLive && runId > 0 && mountReactorPreview) {
    previewStickyRef.current = { runId, previewMounted: true }
  } else if (showSettledHero && mountReactorPreview) {
    previewStickyRef.current = { runId: -1, previewMounted: true }
  } else if (!synthLive && !showSettledHero && !mountReactorPreview) {
    previewStickyRef.current = null
  }

  const previewSticky =
    previewStickyRef.current != null && previewStickyRef.current.previewMounted

  const reactorPreviewMounted =
    mountReactorPreview &&
    reactorViewOpen &&
    (editingEquation ||
      userEditing ||
      synthLive ||
      synthPreviewLock ||
      previewSticky ||
      settledWaitingPaint ||
      (showSettledHero && mountReactorPreview))

  const productPrewarm = productMeshMounted && !productSlotVisible && !showSettledHero
  const holdVisualOverlap = synthLive && !productOwnsScreen && !productSlotVisible

  const reactorEditVisible =
    mountReactorPreview &&
    reactorViewOpen &&
    !synthLive &&
    !productOwnsScreen &&
    (!showSettledHero || userEditing)

  /** Продукт на экране — Bohr never visible (даже без paint). */
  const reactorPreviewVisible =
    reactorPreviewMounted &&
    !productOwnsScreen &&
    !productSlotVisible &&
    (reactorEditVisible || synthPreviewLock || userEditing)

  const synthEmptyGuard =
    synthLive &&
    mountReactorPreview &&
    reactorViewOpen &&
    !productOwnsScreen &&
    !productSlotVisible &&
    !productPainted &&
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
