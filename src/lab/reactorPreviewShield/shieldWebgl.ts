/**
 * Soft WebGL recovery — без remount Canvas (нет красного/чёрного экрана и cold Bohr).
 */
import { REACTOR_SHIELD, type ShieldSnapshot, shieldAllowsCanvasRemount } from './reactorPreviewShield'

export type SoftWebGlRecovery = {
  onContextLost: () => void
  onContextRestored: (invalidate: () => void) => void
  /** true только если remount реально разрешён щитом (обычно never). */
  consumeRemountRequest: (snap: ShieldSnapshot, nowMs: number, editing: boolean) => boolean
  reset: () => void
  wasLost: () => boolean
}

/**
 * Context loss: preventDefault уже снаружи.
 * Remount по умолчанию ЗАПРЕЩЁН (softRecoverOnly) — ждём webglcontextrestored + invalidate.
 */
export function createSoftWebGlRecovery(): SoftWebGlRecovery {
  let lost = false
  let remountWanted = false
  let lostAt = 0

  return {
    onContextLost() {
      lost = true
      remountWanted = false
      lostAt = performance.now()
      // Не планируем remount — soft only.
      if (!REACTOR_SHIELD.softRecoverOnly) {
        remountWanted = true
      }
    },
    onContextRestored(invalidate) {
      lost = false
      remountWanted = false
      lostAt = 0
      try {
        invalidate()
      } catch {
        /* ignore */
      }
    },
    consumeRemountRequest(snap, nowMs, editing) {
      if (REACTOR_SHIELD.softRecoverOnly) {
        remountWanted = false
        return false
      }
      if (!remountWanted) return false
      if (!shieldAllowsCanvasRemount(snap, nowMs, editing)) return false
      // Даём браузеру шанс восстановить контекст сам (≥2с).
      if (lost && performance.now() - lostAt < 2000) return false
      remountWanted = false
      return true
    },
    reset() {
      lost = false
      remountWanted = false
      lostAt = 0
    },
    wasLost() {
      return lost
    },
  }
}
