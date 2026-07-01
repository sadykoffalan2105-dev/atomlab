import type { CompoundDef } from '../types/chemistry'
import { isProductGpuCompiled } from './productGpuCompileCache'

export type SynthesisProductSlotInput = {
  productForSlot: CompoundDef | null
  productSlotVisible: boolean
  productPrewarmActive: boolean
  showSettledHero: boolean
  synthLive: boolean
  prewarmReady: boolean
  prewarmCompoundId: string | null
}

export type SynthesisProductSlotView = {
  /** Полный масштаб — только после GPU compile. */
  visible: boolean
  /** Скрытый micro-scale compile. */
  prewarm: boolean
  gpuReady: boolean
}

/** Двухфазный слот: prewarm → visible. Без deadlock «ждём compile, но compile не стартует». */
export function resolveSynthesisProductSlot(
  input: SynthesisProductSlotInput,
): SynthesisProductSlotView {
  const {
    productForSlot,
    productSlotVisible,
    productPrewarmActive,
    showSettledHero,
    synthLive,
    prewarmReady,
    prewarmCompoundId,
  } = input

  if (!productForSlot) {
    return { visible: false, prewarm: false, gpuReady: false }
  }

  const gpuReady =
    isProductGpuCompiled(productForSlot.id) ||
    (prewarmReady && prewarmCompoundId === productForSlot.id)

  if (showSettledHero) {
    return {
      visible: productSlotVisible,
      prewarm: false,
      gpuReady,
    }
  }

  if (!productSlotVisible && !synthLive) {
    return { visible: false, prewarm: false, gpuReady }
  }

  if (gpuReady) {
    return {
      visible: productSlotVisible || synthLive,
      prewarm: false,
      gpuReady: true,
    }
  }

  return {
    visible: false,
    prewarm: productPrewarmActive || synthLive || productSlotVisible,
    gpuReady: false,
  }
}
