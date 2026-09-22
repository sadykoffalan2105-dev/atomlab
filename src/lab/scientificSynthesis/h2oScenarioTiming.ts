import { storyWallDuration } from '../cinema/core/storyTime'
import { H2O_FINISH } from '../cinema/scenes/h2o/h2oSteps'

/**
 * Бюджет на старт урока «вода» (2 H₂ + O₂ → 2 H₂O). Как и у NaCl, урок идёт по шагам и ждёт
 * ученика: watchdog лаборатории проверяет только, что сцена подключилась к clo2StepStore
 * (isScientificLessonHolding), а дальше ждёт её собственного complete.
 */

/** Запас на разгон WebGL, композер и появление hero-слота после сцены. */
const WATCHDOG_MARGIN_MS = 6500

export function h2oScientificWatchdogMs(): number {
  return Math.ceil(storyWallDuration([H2O_FINISH]) * 1000 + WATCHDOG_MARGIN_MS)
}
