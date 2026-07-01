/** Макс. ожидание crossfade продукта после merge (мс). */
export const SYNTH_PRODUCT_CROSSFADE_MAX_MS = 100

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
