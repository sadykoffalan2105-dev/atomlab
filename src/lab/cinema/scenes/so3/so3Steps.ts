import { SCHOOL_STEP_IDS, type SchoolStepId } from '../school/schoolSpec'
import type { SceneFinish } from '../kit/sceneKit'

/**
 * 2SO₂ + O₂ ⇄ 2SO₃ — школьная сцена (движок scenes/school). Шаги — SCHOOL_STEP_IDS, разметка времени —
 * в научной спецификации (school/specs/so3.ts, stepTimings). Без THREE и React.
 */

export const SO3_STEP_IDS = SCHOOL_STEP_IDS

export type So3StepId = SchoolStepId

/** Хвост после шага «Итог» (1,5 с после последнего шага — проверяет тест). */
export const SO3_FINISH: SceneFinish = { from: 30.5, to: 32, wall: 1.5, ease: 'none' }
