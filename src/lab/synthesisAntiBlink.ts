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
  /** true — молекула уже отрисована, можно скрыть превью атомов */
  productRevealReady: boolean
  /** true — меш молекулы реально отрисован ≥1 кадра на полном масштабе (first-paint latch). */
  productPainted?: boolean
  /** Мгновенный синтез — держим атомы до settled (нет чёрного кадра). */
  keepPreviewDuringProduct?: boolean
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
 * Инвариант: во время синтеза на сцене всегда есть атомы И/ИЛИ продукт.
 * Меш продукта не размонтируется после первого mount на runId.
 */
export function resolveSynthesisContinuity(input: SynthesisContinuityInput): SynthesisContinuityView {
  const {
    runId,
    synthActive,
    synthesisRunActive,
    synthesisPhase: _synthesisPhase,
    showSettledHero,
    mountReactorPreview,
    reactorViewOpen,
    gpuPrewarmAllowed: _gpuPrewarmAllowed,
    prewarmReady: _prewarmReady,
    productCompoundId,
    earlyProductReveal: _earlyProductReveal,
    forceProductSlot: _forceProductSlot,
    productRevealReady,
    productPainted = false,
    keepPreviewDuringProduct = false,
    stickyMountRef,
    previewStickyRef,
  } = input

  const synthLive = synthActive || synthesisRunActive

  /** GPU-prewarm до клика «Синтез»: невидимый меш (scale≈0) пока уравнение сбалансировано. */
  const earlyGpuPrewarm =
    !synthLive &&
    !showSettledHero &&
    _gpuPrewarmAllowed &&
    productCompoundId != null &&
    reactorViewOpen

  /** Во время подбора коэффициентов и синтеза превью атомов всегда видно. */
  const editPreviewLock =
    !showSettledHero && mountReactorPreview && reactorViewOpen

  /** До first-paint продукта атомы не убираем — overlap против GPU hitch. */
  const synthPreviewLock =
    synthLive &&
    mountReactorPreview &&
    reactorViewOpen &&
    !showSettledHero &&
    !productPainted

  if (synthLive && runId > 0 && mountReactorPreview) {
    previewStickyRef.current = { runId, previewMounted: true }
  }

  if (!synthLive && !showSettledHero) {
    previewStickyRef.current = null
  }

  const previewSticky =
    previewStickyRef.current != null &&
    previewStickyRef.current.runId === runId &&
    previewStickyRef.current.previewMounted

  const reactorPreviewMounted =
    mountReactorPreview ||
    (previewSticky && reactorViewOpen && synthLive)

  if (productCompoundId && reactorViewOpen) {
    if (synthLive && runId > 0) {
      stickyMountRef.current = { runId, compoundId: productCompoundId, productMounted: true }
    } else if (earlyGpuPrewarm) {
      stickyMountRef.current = { runId: 0, compoundId: productCompoundId, productMounted: true }
    }
  }

  if (!synthLive && !showSettledHero && !earlyGpuPrewarm) {
    stickyMountRef.current = null
  }

  const sticky = stickyMountRef.current
  const stickyMatch =
    sticky != null &&
    productCompoundId != null &&
    sticky.compoundId === productCompoundId &&
    sticky.productMounted

  /** Меш продукта — после запуска, в settled или при раннем GPU-prewarm. */
  const productMeshMounted =
    productCompoundId != null &&
    reactorViewOpen &&
    (showSettledHero ||
      (stickyMatch && ((synthLive && runId > 0) || earlyGpuPrewarm)))

  /** Видимость — после GPU compile или принудительного reveal (атомы держим до productPainted). */
  const productSlotVisible =
    productMeshMounted &&
    (showSettledHero ||
      (synthActive &&
        runId > 0 &&
        productRevealReady &&
        (_prewarmReady || _forceProductSlot)))

  const productPrewarm = productMeshMounted && !productSlotVisible && !showSettledHero
  const holdVisualOverlap = synthLive

  /**
   * Превью атомов скрываем только в settled-режиме после отрисовки продукта.
   * Во время synthLive атомы остаются — нет чёрного кадра в конце анимации.
   */
  const hidePreviewForProduct =
    showSettledHero &&
    productSlotVisible &&
    productRevealReady &&
    productPainted &&
    !synthLive

  const reactorPreviewVisible =
    reactorPreviewMounted &&
    (editPreviewLock ||
      synthPreviewLock ||
      keepPreviewDuringProduct ||
      (!hidePreviewForProduct && (!showSettledHero || synthLive || productPrewarm)))

  const reactorPreviewVisibleFinal =
    synthLive &&
    reactorPreviewMounted &&
    !reactorPreviewVisible &&
    !productSlotVisible &&
    !productPrewarm &&
    !showSettledHero
      ? true
      : reactorPreviewVisible

  return {
    reactorPreviewVisible: reactorPreviewVisibleFinal,
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
