import { SCHOOL_STEP_IDS, type SchoolStepId } from '../school/schoolSpec'
import type { SceneFinish } from '../kit/sceneKit'

/**
 * 2C + O₂ → 2CO — школьная сцена (движок scenes/school). Шаги — SCHOOL_STEP_IDS, разметка времени —
 * в научной спецификации (school/specs/co.ts, stepTimings). Без THREE и React.
 */

export const CO_STEP_IDS = SCHOOL_STEP_IDS

export type CoStepId = SchoolStepId

/** Хвост после шага «Итог» (1,5 с после последнего шага — проверяет тест). */
export const CO_FINISH: SceneFinish = { from: 31.5, to: 33, wall: 1.5, ease: 'none' }
