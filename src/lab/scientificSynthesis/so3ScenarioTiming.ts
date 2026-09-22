import { storyWallDuration } from '../cinema/core/storyTime'
import { SO3_FINISH } from '../cinema/scenes/so3/so3Steps'

/**
 * Бюджет на старт урока SO₃ (2 SO₂ + O₂ ⇌ 2 SO₃ на V₂O₅). Как у NaCl: сам урок идёт
 * по шагам и ждёт ученика; watchdog лаборатории проверяет только, что сцена подключилась
 * к clo2StepStore (isScientificLessonHolding), а дальше ждёт её собственного complete.
 */

/** Запас на разгон WebGL, композер и появление hero-слота после сцены. */
const WATCHDOG_MARGIN_MS = 6500

export function so3ScientificWatchdogMs(): number {
  return Math.ceil(storyWallDuration([SO3_FINISH]) * 1000 + WATCHDOG_MARGIN_MS)
}
