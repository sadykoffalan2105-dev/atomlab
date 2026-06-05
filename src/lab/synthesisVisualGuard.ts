/** Сколько кадров держать превью после появления продукта (overlap, без мигания). */
export const SYNTH_PREVIEW_RETAIN_FRAMES = 3

/** Порог пустых кадров до авто-восстановления. */
export const SYNTH_EMPTY_FRAME_RECOVER = 2

export type SynthesisCoverage = {
  preview: boolean
  product: boolean
  mergeFx: boolean
  convergeFx: boolean
}

export type SynthesisCoverageTracker = {
  tick: (active: boolean, coverage: SynthesisCoverage, recover: () => void) => void
  reset: () => void
}

/** Гарантия: во время синтеза хотя бы один визуальный слой всегда на сцене. */
export function createSynthesisCoverageTracker(): SynthesisCoverageTracker {
  let emptyFrames = 0
  let lastRecoverMs = 0

  return {
    tick(active, coverage, recover) {
      if (!active) {
        emptyFrames = 0
        return
      }
      const covered =
        coverage.preview ||
        coverage.product ||
        coverage.mergeFx ||
        coverage.convergeFx

      if (covered) {
        emptyFrames = 0
        return
      }

      emptyFrames += 1
      if (import.meta.env.DEV && emptyFrames === SYNTH_EMPTY_FRAME_RECOVER) {
        console.warn(
          '[synthesisVisualGuard] Пустой кадр синтеза — форсируем показ продукта',
        )
      }
      if (emptyFrames >= SYNTH_EMPTY_FRAME_RECOVER) {
        const now = performance.now()
        if (now - lastRecoverMs > 180) {
          lastRecoverMs = now
          recover()
        }
      }
    },
    reset() {
      emptyFrames = 0
      lastRecoverMs = 0
    },
  }
}
