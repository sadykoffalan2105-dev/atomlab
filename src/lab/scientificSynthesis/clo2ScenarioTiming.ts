import { storyWallDuration } from '../cinema/core/storyTime'
import { CLO2_SEGMENTS, CLO2_SEGMENTS_TEACHER } from '../cinema/scenes/clo2/storyboard'
import { hasLabTeacherScript } from '../teacher/clo2TeacherScript'

/**
 * Таймауты гарантии успеха для научных сцен.
 *
 * Сама раскадровка живёт в ATOMLAB Cinema (src/lab/cinema/scenes), здесь только
 * пересчёт её экранной длительности в watchdog лаборатории: сцена со slow-motion
 * идёт дольше «времени сюжета», и гарантия обязана это учитывать.
 */

/** Запас на разгон WebGL, композер и появление hero-слота после сцены. */
const WATCHDOG_MARGIN_MS = 4500
/** Доп. запас под озвучку преподавателя (короткий хвост complete). */
const TEACHER_WATCHDOG_MARGIN_MS = 3500

export function scientificSynthesisWatchdogMs(productId: string): number | null {
  if (productId === 'clo2') {
    const teacher = hasLabTeacherScript(productId)
    const segments = teacher ? CLO2_SEGMENTS_TEACHER : CLO2_SEGMENTS
    const margin = teacher ? TEACHER_WATCHDOG_MARGIN_MS : WATCHDOG_MARGIN_MS
    return Math.ceil(storyWallDuration(segments) * 1000 + margin)
  }
  return null
}
