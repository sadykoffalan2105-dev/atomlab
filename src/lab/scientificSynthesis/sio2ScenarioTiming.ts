import { storyWallDuration } from '../cinema/core/storyTime'
import { SIO2_FINISH } from '../cinema/scenes/sio2/sio2Steps'

/**
 * Бюджет на старт урока SiO₂ (Si + O₂ → SiO₂). Урок идёт по шагам и ждёт ученика:
 * watchdog лаборатории проверяет только, что сцена подключилась к clo2StepStore
 * (isScientificLessonHolding), а дальше ждёт её собственного complete.
 */

/** Запас на разгон WebGL, композер и появление hero-слота после сцены. */
const WATCHDOG_MARGIN_MS = 6500

export function sio2ScientificWatchdogMs(): number {
  return Math.ceil(storyWallDuration([SIO2_FINISH]) * 1000 + WATCHDOG_MARGIN_MS)
}
