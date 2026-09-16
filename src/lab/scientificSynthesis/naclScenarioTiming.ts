import { storyWallDuration } from '../cinema/core/storyTime'
import { NACL_FINISH } from '../cinema/scenes/nacl/naclSteps'

/**
 * Бюджет на старт урока NaCl (2 Na + Cl₂ → 2 NaCl). Как и у ClO₂, сам урок идёт
 * по шагам и ждёт ученика: watchdog лаборатории проверяет только, что сцена
 * подключилась к clo2StepStore (isScientificLessonHolding), а дальше ждёт её
 * собственного complete.
 */

/** Запас на разгон WebGL, композер и появление hero-слота после сцены. */
const WATCHDOG_MARGIN_MS = 6500

export function naclScientificWatchdogMs(): number {
  return Math.ceil(storyWallDuration([NACL_FINISH]) * 1000 + WATCHDOG_MARGIN_MS)
}
