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
    if (productPrewarmActive) {
      const gpuReady =
        isProductGpuCompiled(productForSlot.id) ||
        (prewarmReady && prewarmCompoundId === productForSlot.id)
      return { visible: false, prewarm: true, gpuReady }
    }
    return {
      visible: false,
      prewarm: false,
      gpuReady:
        isProductGpuCompiled(productForSlot.id) ||
        (prewarmReady && prewarmCompoundId === productForSlot.id),
    }
  }

  if (gpuReady) {
    return {
      visible: productSlotVisible || synthLive,
      prewarm: false,
      gpuReady: true,
    }
  }

  /** Синтез: показываем слот сразу, compile идёт на полном масштабе (не micro-prewarm). */
  if (synthLive && productSlotVisible) {
    return { visible: true, prewarm: false, gpuReady: false }
  }

  if (productPrewarmActive) {
    return { visible: false, prewarm: true, gpuReady: false }
  }

  return {
    visible: false,
    prewarm: false,
    gpuReady: false,
  }
}
