/**
 * Soft WebGL recovery + hard remount если контекст так и не вернулся.
 * Soft-only навсегда оставлял белый canvas / иконку сбоя после dichromate GPU hitch.
 *
 * Важно: браузер иногда шлёт «пустой» webglcontextrestored без живого буфера —
 * тогда НЕ снимаем hard-remount (иначе вечный белый экран).
 */
import { REACTOR_SHIELD } from './reactorPreviewShield'

export type SoftWebGlRecovery = {
  onContextLost: () => void
  /**
   * @returns true если restore считается успешным (можно отменить hard remount).
   * false — фейковый restored; hard remount остаётся в силе.
   */
  onContextRestored: (invalidate: () => void, glAlive?: boolean) => boolean
  /** true — пора remount'ить Canvas (context мёртв дольше hardRecoverAfterMs). */
  shouldHardRemount: (nowMs?: number) => boolean
  /** Вызвать после remount, чтобы не зациклить. */
  acknowledgeHardRemount: () => void
  reset: () => void
  wasLost: () => boolean
}

/**
 * Context loss: preventDefault уже снаружи.
 * 1) Ждём webglcontextrestored + живой drawing buffer
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
    onContextRestored(invalidate, glAlive = true) {
      if (!glAlive) {
        // Фейковый restored: остаёмся в lost, hard remount по таймеру.
        try {
          invalidate()
        } catch {
          /* ignore */
        }
        return false
      }
      lost = false
      lostAt = 0
      hardRemountConsumed = false
      try {
        invalidate()
      } catch {
        /* ignore */
      }
      return true
    },
    shouldHardRemount(nowMs = performance.now()) {
      if (hardRemountConsumed) return false
      if (!lost || lostAt <= 0) return false
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

/** Проба: GL жив и есть ненулевой drawing buffer (контекст или Three.WebGLRenderer). */
export function isWebGlDrawingBufferAlive(gl: {
  getContextAttributes?: () => unknown
  drawingBufferWidth?: number
  drawingBufferHeight?: number
  isContextLost?: () => boolean
  getContext?: () => { drawingBufferWidth: number; drawingBufferHeight: number; isContextLost: () => boolean } | null
}): boolean {
  try {
    const ctx =
      typeof gl.getContext === 'function'
        ? (gl.getContext() as {
            drawingBufferWidth: number
            drawingBufferHeight: number
            isContextLost: () => boolean
          } | null)
        : null
    const target = ctx ?? gl
    if (typeof target.isContextLost === 'function' && target.isContextLost()) return false
    const w = target.drawingBufferWidth ?? 0
    const h = target.drawingBufferHeight ?? 0
    return w > 0 && h > 0
  } catch {
    return false
  }
}
