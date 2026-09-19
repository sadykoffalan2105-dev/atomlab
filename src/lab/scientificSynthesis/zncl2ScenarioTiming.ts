import { storyWallDuration } from '../cinema/core/storyTime'
import { ZNCL2_FINISH } from '../cinema/scenes/zncl2/zncl2Steps'

/**
 * Бюджет на старт урока ZnCl₂ (Zn + 2 HCl → ZnCl₂ + H₂↑). Как и у ClO₂/NaCl,
 * сам урок идёт по шагам и ждёт ученика: watchdog лаборатории проверяет только,
 * что сцена подключилась к clo2StepStore (isScientificLessonHolding), а дальше
 * ждёт её собственного complete.
 */

/** Запас на разгон WebGL, композер и появление hero-слота после сцены. */
const WATCHDOG_MARGIN_MS = 6500

export function zncl2ScientificWatchdogMs(): number {
  return Math.ceil(storyWallDuration([ZNCL2_FINISH]) * 1000 + WATCHDOG_MARGIN_MS)
}
