import { storyWallDuration } from '../cinema/core/storyTime'
import { PBO_FINISH } from '../cinema/scenes/pbo/pboSteps'

/**
 * Бюджет на старт урока PbO (2 Pb + O₂ → 2 PbO). Как и у NaCl, урок идёт по шагам и ждёт
 * ученика: watchdog лаборатории проверяет только, что сцена подключилась к clo2StepStore
 * (isScientificLessonHolding), а дальше ждёт её собственного complete.
 */

/** Запас на разгон WebGL, композер и появление hero-слота после сцены. */
const WATCHDOG_MARGIN_MS = 6500

export function pboScientificWatchdogMs(): number {
  return Math.ceil(storyWallDuration([PBO_FINISH]) * 1000 + WATCHDOG_MARGIN_MS)
}
