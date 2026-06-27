/**
 * Защита WebGL-кадра: не даём Canvas «провалиться» в чёрный при блокировке main thread.
 * Используется в LabScene во время редактирования уравнения и синтеза.
 */

export type LabCanvasFrameHoldGuard = {
  markRendered: () => void
  /** true если принудительно запросили invalidate */
  tick: (invalidate: () => void, reactorActive: boolean) => boolean
  reset: () => void
}

const STALL_MS = 36
const REACTOR_STALL_MS = 28

export function createLabCanvasFrameHoldGuard(): LabCanvasFrameHoldGuard {
  let lastRenderMs = performance.now()
  let stallFrames = 0

  return {
    markRendered() {
      lastRenderMs = performance.now()
      stallFrames = 0
    },
    tick(invalidate, reactorActive) {
      const gap = performance.now() - lastRenderMs
      const limit = reactorActive ? REACTOR_STALL_MS : STALL_MS
      if (gap < limit) {
        stallFrames = 0
        return false
      }
      stallFrames += 1
      if (stallFrames <= 4) {
        invalidate()
        return true
      }
      return false
    },
    reset() {
      lastRenderMs = performance.now()
      stallFrames = 0
    },
  }
}

/** Политика GPU-prewarm продукта: при балансе уравнения и во время синтеза. */
export type GpuPrewarmPolicy = 'off' | 'synthesis-only' | 'intent'

export function shouldMountProductGpuPrewarm(opts: {
  policy: GpuPrewarmPolicy
  synthesisRunActive: boolean
  synthActive: boolean
  showSettledHero: boolean
  hasPrewarmIntent?: boolean
}): boolean {
  const { policy, synthesisRunActive, synthActive, showSettledHero, hasPrewarmIntent } = opts
  if (showSettledHero) return false
  if (policy === 'off') return false
  if (policy === 'intent') return hasPrewarmIntent === true || synthesisRunActive || synthActive
  if (policy === 'synthesis-only') return synthesisRunActive || synthActive
  return synthesisRunActive || synthActive
}
