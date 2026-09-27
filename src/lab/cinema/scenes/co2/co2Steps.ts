import { SCHOOL_STEP_IDS, type SchoolStepId } from '../school/schoolSpec'
import type { SceneFinish } from '../kit/sceneKit'

/**
 * C + O₂ → CO₂ — школьная сцена (движок scenes/school). Шесть шагов урока общие для всех школьных
 * сцен образования молекулы (SCHOOL_STEP_IDS); разметка времени — в научной спецификации
 * (school/specs/co2.ts, stepTimings). Без THREE и React: файл читают панель урока и watchdog.
 */

export const CO2_STEP_IDS = SCHOOL_STEP_IDS

export type Co2StepId = SchoolStepId

/** Хвост после шага «Итог» (совпадает с buildSchoolModel: 1,5 с после последнего шага — проверяет тест). */
export const CO2_FINISH: SceneFinish = { from: 31, to: 32.5, wall: 1.5, ease: 'none' }
