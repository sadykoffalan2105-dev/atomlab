/**
 * WebGL context loss — без мгновенного remount Canvas (иначе 3–5 с чёрного экрана).
 */

export type WebGlRecoveryController = {
  /** Вызвать из webglcontextlost (после preventDefault). */
  onContextLost: () => void
  /** Вызвать из webglcontextrestored. */
  onContextRestored: () => void
  /** true — можно remount Canvas (только если restore не помог). */
  shouldRemount: () => boolean
  reset: () => void
}

const REMOUNT_AFTER_MS = 3200

export function createWebGlRecoveryController(onRequestRemount: () => void): WebGlRecoveryController {
  let lostAt = 0
  let remountScheduled = false
  let remountTimer: number | null = null

  const clearTimer = () => {
    if (remountTimer != null) {
      window.clearTimeout(remountTimer)
      remountTimer = null
    }
  }

  return {
    onContextLost() {
      lostAt = performance.now()
      remountScheduled = false
      clearTimer()
      remountTimer = window.setTimeout(() => {
        remountTimer = null
        if (performance.now() - lostAt >= REMOUNT_AFTER_MS - 40) {
          remountScheduled = true
          onRequestRemount()
        }
      }, REMOUNT_AFTER_MS)
    },
    onContextRestored() {
      clearTimer()
      lostAt = 0
      remountScheduled = false
    },
    shouldRemount() {
      return remountScheduled
    },
    reset() {
      clearTimer()
      lostAt = 0
      remountScheduled = false
    },
  }
}
