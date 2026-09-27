import { SCHOOL_STEP_IDS, type SchoolStepId } from '../school/schoolSpec'
import type { SceneFinish } from '../kit/sceneKit'

/**
 * 2H₂ + O₂ → 2H₂O — школьная сцена (движок scenes/school). Шесть шагов урока общие для всех школьных
 * сцен образования молекулы (SCHOOL_STEP_IDS); разметка времени — в h2oSpec.steps.
 * Без THREE и React: файл читают панель урока и watchdog лаборатории.
 */

export const H2O_STEP_IDS = SCHOOL_STEP_IDS

export type H2oStepId = SchoolStepId

/** Хвост после шага «Итог» (совпадает с buildSchoolModel: 1,5 с после последнего шага — проверяет тест). */
export const H2O_FINISH: SceneFinish = { from: 32.5, to: 34, wall: 1.5, ease: 'none' }
