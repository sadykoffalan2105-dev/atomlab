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

function isLateSynthPhase(phase: string): boolean {
  return phase === 'mergeFlash' || phase === 'product'
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
    synthesisPhase,
    showSettledHero,
    mountReactorPreview,
    reactorViewOpen,
    gpuPrewarmAllowed,
    prewarmReady,
    productCompoundId,
    earlyProductReveal,
    forceProductSlot,
    stickyMountRef,
    previewStickyRef,
  } = input

  const synthLive = synthActive || synthesisRunActive
  const latePhase = isLateSynthPhase(synthesisPhase)

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
    if (prewarmReady && gpuPrewarmAllowed && !showSettledHero) {
      stickyMountRef.current = { runId, compoundId: productCompoundId, productMounted: true }
    }
    if (synthLive && runId > 0) {
      stickyMountRef.current = { runId, compoundId: productCompoundId, productMounted: true }
    }
  }

  if (!synthLive && !showSettledHero) {
    stickyMountRef.current = null
  }

  const sticky = stickyMountRef.current
  const stickyMatch =
    sticky != null &&
    productCompoundId != null &&
    sticky.compoundId === productCompoundId &&
    sticky.productMounted

  const productMeshMounted =
    productCompoundId != null &&
    reactorViewOpen &&
    (showSettledHero ||
      stickyMatch ||
      (gpuPrewarmAllowed && prewarmReady) ||
      (synthLive && runId > 0))

  const productSlotVisible =
    productMeshMounted &&
    (showSettledHero ||
      earlyProductReveal ||
      forceProductSlot ||
      (synthActive && latePhase))

  const productPrewarm = productMeshMounted && !productSlotVisible && !showSettledHero
  const holdVisualOverlap = synthLive

  /** Корень превью никогда не гасим во время синтеза — только scale/GSAP. */
  const reactorPreviewVisible =
    reactorPreviewMounted &&
    (!showSettledHero || synthLive || productPrewarm)

  return {
    reactorPreviewVisible,
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
): boolean {
  return (
    (view.reactorPreviewVisible && view.reactorPreviewMounted) ||
    view.productSlotVisible ||
    view.productPrewarm ||
    mergeFx ||
    convergeFx
  )
}
