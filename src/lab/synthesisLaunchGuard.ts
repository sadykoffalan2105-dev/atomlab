/** Макс. ожидание crossfade продукта после merge (мс). */
export const SYNTH_PRODUCT_CROSSFADE_MAX_MS = 100

export type SynthesisHandoffGuard = {
  signalReady: () => void
  cancel: () => void
}

/**
 * @deprecated Handoff превью больше не скрывает атомы — переиспользуются те же meshes.
 * Оставлено для совместимости тестов.
 */
export function createSynthesisHandoffGuard(onReady: () => void): SynthesisHandoffGuard {
  let done = false
  const timer = window.setTimeout(() => {
    if (done) return
    done = true
    onReady()
  }, 0)

  return {
    signalReady() {
      if (done) return
      done = true
      window.clearTimeout(timer)
      onReady()
    },
    cancel() {
      if (done) return
      done = true
      window.clearTimeout(timer)
    },
  }
}

export type ProductCrossfadeGuard = {
  signalProductReady: () => void
  cancel: () => void
}

/** Если продукт не показан вовремя — форсировать слот. */
export function createProductCrossfadeGuard(onReady: () => void): ProductCrossfadeGuard {
  let done = false
  const timer = window.setTimeout(() => {
    if (done) return
    done = true
    onReady()
  }, SYNTH_PRODUCT_CROSSFADE_MAX_MS)

  return {
    signalProductReady() {
      if (done) return
      done = true
      window.clearTimeout(timer)
      onReady()
    },
    cancel() {
      if (done) return
      done = true
      window.clearTimeout(timer)
    },
  }
}

let continuityEmptyFrames = 0

/** Dev-only continuity counter (без логов — не блокирует main thread). */
export function tickSynthesisVisualContinuity(hasVisibleContent: boolean): void {
  if (hasVisibleContent) {
    continuityEmptyFrames = 0
    return
  }
  continuityEmptyFrames += 1
}
