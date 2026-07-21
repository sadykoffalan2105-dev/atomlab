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

/**
 * productPainted валиден только для текущего runId во время синтеза —
 * иначе stale paint с прошлого запуска гасит Bohr на старте.
 * В pre-synth (не settled) paint всегда false — иначе пустой экран без молекулы.
 */
export function isEffectiveProductPainted(input: {
  productPainted: boolean
  synthLive: boolean
  runId: number
  paintedForRunId: number
  showSettledHero?: boolean
}): boolean {
  const { productPainted, synthLive, runId, paintedForRunId, showSettledHero = false } = input
  if (!productPainted) return false
  if (!synthLive) return showSettledHero
  if (runId <= 0) return true
  return paintedForRunId === runId
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
  /**
   * Idle GPU micro-prewarm продукта. false сразу после +/- (cooldown),
   * иначе mount молекулы на edit-end → context hitch → «атомы пропали».
   */
  allowIdleProductPrewarm?: boolean
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
 * - во время синтеза Bohr держится до productPainted (нет кадра без атомов);
 * - после paint продукт владеет экраном, Bohr скрыт (shell остаётся смонтированным);
 * - shell не unmount'ится, чтобы +/- не делал cold remount.
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
    allowIdleProductPrewarm = true,
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
      allowIdleProductPrewarm &&
      _gpuPrewarmAllowed
    if (canPrewarmProduct) {
      stickyMountRef.current = {
        runId: 0,
        compoundId: productCompoundId,
        productMounted: true,
      }
    } else {
      // Не держать stale product GPU после edit/баланса — hitch гасит Bohr.
      stickyMountRef.current = null
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
    allowIdleProductPrewarm &&
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

  /**
   * Слот может подниматься для GPU paint (за Bohr), но только после productRevealReady.
   * forceProductSlot без ready не открывает слот — иначе атомы уходят в пустоту.
   */
  const productSlotVisible =
    productMeshMounted &&
    (showSettledHero ||
      (synthActive && runId > 0 && productRevealReady && (_prewarmReady || _forceProductSlot)))

  /**
   * Продукт владеет экраном только после реального paint.
   * До paint Bohr остаётся — нет кадра без атомов и без молекулы.
   * (productSlotVisible=true ⇒ не micro-prewarm — см. productPrewarm ниже.)
   */
  const productOwnsScreen =
    !userEditing &&
    productSlotVisible &&
    productPainted &&
    (showSettledHero || synthLive || productRevealReady)

  const settledWaitingPaint =
    showSettledHero && productSlotVisible && !productPainted && !userEditing

  const editingEquation =
    !synthLive &&
    !productOwnsScreen &&
    mountReactorPreview &&
    reactorViewOpen &&
    (!showSettledHero || userEditing || !productPainted)

  /** Держим Bohr до paint даже если слот уже поднимается (overlap без дыры). */
  const synthPreviewLock =
    synthLive &&
    mountReactorPreview &&
    reactorViewOpen &&
    !showSettledHero &&
    !productOwnsScreen &&
    (keepPreviewDuringProduct || !productPainted)

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
  const holdVisualOverlap = synthLive && !productOwnsScreen

  const reactorEditVisible =
    mountReactorPreview &&
    reactorViewOpen &&
    !synthLive &&
    !productOwnsScreen &&
    (!showSettledHero || userEditing || !productPainted)

  /** До paint Bohr виден; после paint — только продукт. */
  const reactorPreviewVisible =
    reactorPreviewMounted &&
    !productOwnsScreen &&
    (reactorEditVisible ||
      synthPreviewLock ||
      userEditing ||
      settledWaitingPaint ||
      (synthLive && !productPainted && !showSettledHero))

  const synthEmptyGuard =
    synthLive &&
    mountReactorPreview &&
    reactorViewOpen &&
    !productOwnsScreen &&
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
