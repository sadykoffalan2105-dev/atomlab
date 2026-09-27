import { SCHOOL_STEP_IDS, type SchoolStepId } from '../school/schoolSpec'
import type { SceneFinish } from '../kit/sceneKit'

/**
 * S + O₂ → SO₂ — школьная сцена (движок scenes/school). Шаги — SCHOOL_STEP_IDS, разметка времени —
 * в научной спецификации (school/specs/so2.ts, stepTimings). Без THREE и React.
 */

export const SO2_STEP_IDS = SCHOOL_STEP_IDS

export type So2StepId = SchoolStepId

/** Хвост после шага «Итог» (1,5 с после последнего шага — проверяет тест). */
export const SO2_FINISH: SceneFinish = { from: 30.5, to: 32, wall: 1.5, ease: 'none' }
