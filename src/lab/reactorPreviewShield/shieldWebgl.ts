/**
 * Soft WebGL recovery + hard remount если контекст так и не вернулся.
 * Soft-only навсегда оставлял белый canvas / иконку сбоя после dichromate GPU hitch.
 */
import { REACTOR_SHIELD } from './reactorPreviewShield'

export type SoftWebGlRecovery = {
  onContextLost: () => void
  onContextRestored: (invalidate: () => void) => void
  /** true — пора remount'ить Canvas (context мёртв дольше hardRecoverAfterMs). */
  shouldHardRemount: (nowMs?: number) => boolean
  /** Вызвать после remount, чтобы не зациклить. */
  acknowledgeHardRemount: () => void
  reset: () => void
  wasLost: () => boolean
}

/**
 * Context loss: preventDefault уже снаружи.
 * 1) Ждём webglcontextrestored + invalidate
 * 2) Если не восстановилось — hard remount (новый Canvas key)
 */
export function createSoftWebGlRecovery(): SoftWebGlRecovery {
  let lost = false
  let lostAt = 0
  let hardRemountConsumed = false

  return {
    onContextLost() {
      lost = true
      lostAt = performance.now()
      hardRemountConsumed = false
    },
    onContextRestored(invalidate) {
      lost = false
      lostAt = 0
      hardRemountConsumed = false
      try {
        invalidate()
      } catch {
        /* ignore */
      }
    },
    shouldHardRemount(nowMs = performance.now()) {
      if (!lost || hardRemountConsumed) return false
      if (lostAt <= 0) return false
      return nowMs - lostAt >= REACTOR_SHIELD.hardRecoverAfterMs
    },
    acknowledgeHardRemount() {
      hardRemountConsumed = true
      lost = false
      lostAt = 0
    },
    reset() {
      lost = false
      lostAt = 0
      hardRemountConsumed = false
    },
    wasLost() {
      return lost
    },
  }
}
