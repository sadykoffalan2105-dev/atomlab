import { storyWallDuration } from '../cinema/core/storyTime'
import { CLO2_SEGMENTS } from '../cinema/scenes/clo2/storyboard'

/**
 * Таймауты гарантии успеха для научных сцен.
 *
 * Сама раскадровка живёт в ATOMLAB Cinema (src/lab/cinema/scenes), здесь только
 * пересчёт её экранной длительности в watchdog лаборатории: сцена со slow-motion
 * идёт дольше «времени сюжета», и гарантия обязана это учитывать.
 */

/** Запас на разгон WebGL, композер и появление hero-слота после сцены. */
const WATCHDOG_MARGIN_MS = 4500

export function scientificSynthesisWatchdogMs(productId: string): number | null {
  if (productId === 'clo2') {
    return Math.ceil(storyWallDuration(CLO2_SEGMENTS) * 1000 + WATCHDOG_MARGIN_MS)
  }
  return null
}
