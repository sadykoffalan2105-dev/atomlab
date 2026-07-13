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
 * - при редактировании +/- — атомы ВСЕГДА смонтированы и видны;
 * - после отрисовки молекулы — продукт виден, превью смонтировано скрытым (без cold remount);
 * - повторный +/- сразу показывает shell без пропадания.
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

  /** Молекула на экране — атомы скрываем только после реальной отрисовки продукта. */
  const productTakeover =
    !userEditing &&
    productSlotVisible &&
    productPainted &&
    (showSettledHero || (synthLive && productRevealReady))

  /** Settled, но продукт ещё не отрисован — держим shell превью (без чёрного кадра). */
  const settledHandoff = showSettledHero && productSlotVisible && !productPainted

  const editingEquation =
    !synthLive &&
    !productTakeover &&
    mountReactorPreview &&
    reactorViewOpen &&
    (!showSettledHero || userEditing)

  const synthPreviewLock =
    synthLive &&
    mountReactorPreview &&
    reactorViewOpen &&
    !showSettledHero &&
    !productTakeover &&
    (keepPreviewDuringProduct || !productPainted)

  /**
   * После paint продукта shell остаётся смонтированным (hidden sticky),
   * чтобы +/- не делал cold remount всех Bohr-моделей.
   */
  if (userEditing || editingEquation) {
    previewStickyRef.current = { runId: runId > 0 ? runId : -1, previewMounted: true }
  } else if (synthLive && runId > 0 && mountReactorPreview) {
    previewStickyRef.current = { runId, previewMounted: true }
  } else if (showSettledHero && productPainted && mountReactorPreview) {
    previewStickyRef.current = { runId: -1, previewMounted: true }
  } else if (!synthLive && !showSettledHero && !mountReactorPreview) {
    previewStickyRef.current = null
  }

  const previewSticky =
    previewStickyRef.current != null && previewStickyRef.current.previewMounted

  /** Shell всегда смонтирован при наличии terms — visibility отдельно. */
  const reactorPreviewMounted =
    mountReactorPreview &&
    reactorViewOpen &&
    (editingEquation ||
      userEditing ||
      synthLive ||
      synthPreviewLock ||
      previewSticky ||
      settledHandoff ||
      (showSettledHero && mountReactorPreview))

  const productPrewarm = productMeshMounted && !productSlotVisible && !showSettledHero
  const holdVisualOverlap = (synthLive || settledHandoff) && !productTakeover

  /** Редактирование +/- — атомы всегда видны. */
  const reactorEditVisible =
    mountReactorPreview &&
    reactorViewOpen &&
    !synthLive &&
    !productTakeover &&
    (!showSettledHero || userEditing)

  const reactorPreviewVisible =
    reactorPreviewMounted &&
    !productTakeover &&
    (reactorEditVisible || synthPreviewLock || settledHandoff || userEditing)

  const synthEmptyGuard =
    synthLive &&
    mountReactorPreview &&
    reactorViewOpen &&
    !productTakeover &&
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
