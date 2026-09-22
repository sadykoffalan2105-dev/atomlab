import { storyWallDuration } from '../cinema/core/storyTime'
import { MN2O7_FINISH } from '../cinema/scenes/mn2o7/mn2o7Steps'

/**
 * Бюджет на старт урока Mn₂O₇ (2 KMnO₄ + H₂SO₄ → Mn₂O₇ + K₂SO₄ + H₂O). Как и у ClO₂ и NaCl, сам урок
 * идёт по шагам и ждёт ученика: watchdog лаборатории проверяет только, что сцена подключилась
 * к clo2StepStore (isScientificLessonHolding), а дальше ждёт её собственного complete.
 */

/** Запас на разгон WebGL, композер и появление hero-слота после сцены. */
const WATCHDOG_MARGIN_MS = 6500

export function mn2o7ScientificWatchdogMs(): number {
  return Math.ceil(storyWallDuration([MN2O7_FINISH]) * 1000 + WATCHDOG_MARGIN_MS)
}
