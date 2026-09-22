import { storyWallDuration } from '../cinema/core/storyTime'
import { CO2_FINISH } from '../cinema/scenes/co2/co2Steps'

/**
 * Бюджет на старт урока CO₂ (C (графит) + O₂ → CO₂). Как и у NaCl, сам урок идёт
 * по шагам и ждёт ученика: watchdog лаборатории проверяет только, что сцена
 * подключилась к clo2StepStore (isScientificLessonHolding), а дальше ждёт её
 * собственного complete.
 */

/** Запас на разгон WebGL, композер и появление hero-слота после сцены. */
const WATCHDOG_MARGIN_MS = 6500

export function co2ScientificWatchdogMs(): number {
  return Math.ceil(storyWallDuration([CO2_FINISH]) * 1000 + WATCHDOG_MARGIN_MS)
}
