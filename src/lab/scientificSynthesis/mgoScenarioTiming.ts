import { storyWallDuration } from '../cinema/core/storyTime'
import { MGO_FINISH } from '../cinema/scenes/mgo/mgoSteps'

/**
 * Бюджет на старт урока MgO (2 Mg + O₂ → 2 MgO). Как и у ClO₂ и NaCl, сам урок
 * идёт по шагам и ждёт ученика: watchdog лаборатории проверяет только, что сцена
 * подключилась к clo2StepStore (isScientificLessonHolding), а дальше ждёт её
 * собственного complete.
 */

/** Запас на разгон WebGL, композер и появление hero-слота после сцены. */
const WATCHDOG_MARGIN_MS = 6500

export function mgoScientificWatchdogMs(): number {
  return Math.ceil(storyWallDuration([MGO_FINISH]) * 1000 + WATCHDOG_MARGIN_MS)
}
