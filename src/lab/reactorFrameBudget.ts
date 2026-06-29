/** Скользящий бюджет кадра — авто-lite при просадке FPS (редактирование +/- и синтез). */
const WINDOW = 36
const FORCE_LITE_MS = 19
const CRITICAL_MS = 26
const LITE_HOLD_MS = 720
const CRITICAL_HOLD_MS = 1400

export type ReactorFrameBudget = {
  sample: (frameMs: number) => void
  shouldForceLite: () => boolean
  shouldSkipDrift: () => boolean
  avgFrameMs: () => number
  reset: () => void
}

export function createReactorFrameBudget(): ReactorFrameBudget {
  const samples: number[] = []
  let forceLiteUntil = 0
  let skipDriftUntil = 0

  return {
    sample(frameMs: number) {
      const ms = Math.min(120, Math.max(0.1, frameMs))
      samples.push(ms)
      if (samples.length > WINDOW) samples.shift()
      if (samples.length < 6) return
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length
      const now = performance.now()
      if (avg >= CRITICAL_MS) {
        forceLiteUntil = now + CRITICAL_HOLD_MS
        skipDriftUntil = now + CRITICAL_HOLD_MS
      } else if (avg >= FORCE_LITE_MS) {
        forceLiteUntil = Math.max(forceLiteUntil, now + LITE_HOLD_MS)
        skipDriftUntil = Math.max(skipDriftUntil, now + LITE_HOLD_MS * 0.6)
      }
    },
    shouldForceLite() {
      return performance.now() < forceLiteUntil
    },
    shouldSkipDrift() {
      return performance.now() < skipDriftUntil
    },
    avgFrameMs() {
      if (!samples.length) return 16.7
      return samples.reduce((a, b) => a + b, 0) / samples.length
    },
    reset() {
      samples.length = 0
      forceLiteUntil = 0
      skipDriftUntil = 0
    },
  }
}
