/**
 * WebGL context loss — soft recover only.
 * Remount Canvas ЗАПРЕЩЁН по умолчанию (красный/чёрный экран + cold Bohr).
 */

export type WebGlRecoveryController = {
  /** Вызвать из webglcontextlost (после preventDefault). */
  onContextLost: () => void
  /** Вызвать из webglcontextrestored. */
  onContextRestored: () => void
  /** true — можно remount Canvas (только если soft recover отключён и restore не помог). */
  shouldRemount: () => boolean
  reset: () => void
}

/** Remount почти никогда — ReactorPreviewShield.softRecoverOnly. */
const ALLOW_CANVAS_REMOUNT = false
const REMOUNT_AFTER_MS = 4000

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
      if (!ALLOW_CANVAS_REMOUNT) return
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
      return ALLOW_CANVAS_REMOUNT && remountScheduled
    },
    reset() {
      clearTimer()
      lostAt = 0
      remountScheduled = false
    },
  }
}
