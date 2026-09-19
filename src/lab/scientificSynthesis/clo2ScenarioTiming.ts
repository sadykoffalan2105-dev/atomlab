import { storyWallDuration } from '../cinema/core/storyTime'
import { CLO2_FINISH } from '../cinema/scenes/clo2/storyboard'
import { mgoScientificWatchdogMs } from './mgoScenarioTiming'
import { naclScientificWatchdogMs } from './naclScenarioTiming'
import { zncl2ScientificWatchdogMs } from './zncl2ScenarioTiming'

/**
 * Таймауты гарантии успеха для научных сцен.
 *
 * ClO₂ — урок по шагам: сколько он идёт, решает ученик, поэтому watchdog здесь —
 * это только бюджет на старт сцены (WebGL, шейдеры, первый кадр). Как только
 * сцена подключилась к clo2StepStore, лаборатория ждёт её собственного complete
 * (см. isScientificLessonHolding).
 */

/** Запас на разгон WebGL, композер и появление hero-слота после сцены. */
const WATCHDOG_MARGIN_MS = 6500

export function scientificSynthesisWatchdogMs(productId: string): number | null {
  if (productId === 'clo2') {
    return Math.ceil(storyWallDuration([CLO2_FINISH]) * 1000 + WATCHDOG_MARGIN_MS)
  }
  if (productId === 'nacl') return naclScientificWatchdogMs()
  if (productId === 'mgo') return mgoScientificWatchdogMs()
  if (productId === 'salt_zn_cl') return zncl2ScientificWatchdogMs()
  return null
}

/** Пока урок по шагам на связи, повторная проверка гарантии — с таким шагом. */
export const SCIENTIFIC_LESSON_RECHECK_MS = 4000
