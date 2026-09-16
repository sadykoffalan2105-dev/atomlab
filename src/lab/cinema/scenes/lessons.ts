import { CLO2_STEP_IDS } from './clo2/clo2Steps'
import { getClo2MechanismText, type Clo2Locale, type Clo2StepText } from './clo2/clo2MechanismText'
import type { CinemaLessonId } from './clo2/clo2StepStore'
import { NACL_STEP_IDS } from './nacl/naclSteps'
import { getNaclMechanismText } from './nacl/naclMechanismText'

/**
 * Уроки по шагам, известные панели механизма (Clo2MechanismPanel).
 *
 * Панель одна на все уроки: она читает clo2StepStore и по `lesson` снимка берёт
 * отсюда список шагов и тексты. Что у уроков различается (энергетика ClO₂ —
 * профиль по Эйрингу, у NaCl — лестница Борна — Габера), панель ветвит по id.
 */

export type LessonLocale = Clo2Locale

/** Общий для уроков вид текста, который читает панель. */
export type LessonMechanismText = {
  intro: { title: string; speak: string }
  steps: Readonly<Record<string, Clo2StepText>>
  legend: {
    electron: string
    pairArrow?: string
    singleArrow?: string
    water?: string
    orbitalPhase?: string
    vibration?: string
  }
  safety: string
  energy: { title: string; axisG?: string }
}

export type CinemaLesson = {
  id: CinemaLessonId
  stepIds: readonly string[]
  /** шаг, на котором показывать предупреждение о безопасности */
  safetyStepId: string
  /** есть ли у урока сценарий озвучки преподавателя (LabTeacherNarrator) */
  narrated: boolean
  getText: (locale: LessonLocale) => LessonMechanismText
}

const LESSONS: Record<CinemaLessonId, CinemaLesson> = {
  clo2: {
    id: 'clo2',
    stepIds: CLO2_STEP_IDS,
    safetyStepId: 'products',
    narrated: true,
    getText: (locale) => getClo2MechanismText(locale),
  },
  nacl: {
    id: 'nacl',
    stepIds: NACL_STEP_IDS,
    safetyStepId: 'energy',
    narrated: false,
    getText: (locale) => getNaclMechanismText(locale),
  },
}

export function getCinemaLesson(id: CinemaLessonId): CinemaLesson {
  return LESSONS[id]
}

/** id шага урока по индексу (с зажимом в границы). */
export function lessonStepIdAt(lesson: CinemaLesson, index: number): string {
  const i = Math.min(Math.max(index, 0), lesson.stepIds.length - 1)
  return lesson.stepIds[i]!
}
