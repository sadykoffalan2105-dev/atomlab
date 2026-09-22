import { storyWallDuration } from '../cinema/core/storyTime'
import { AL2O3_FINISH } from '../cinema/scenes/al2o3/al2o3Steps'

/**
 * Бюджет на старт урока Al₂O₃ (4 Al + 3 O₂ → 2 Al₂O₃). Как и у NaCl, сам урок идёт
 * по шагам и ждёт ученика: watchdog лаборатории проверяет только, что сцена
 * подключилась к clo2StepStore (isScientificLessonHolding), а дальше ждёт её
 * собственного complete.
 */

/** Запас на разгон WebGL, композер и появление hero-слота после сцены. */
const WATCHDOG_MARGIN_MS = 6500

export function al2o3ScientificWatchdogMs(): number {
  return Math.ceil(storyWallDuration([AL2O3_FINISH]) * 1000 + WATCHDOG_MARGIN_MS)
}
