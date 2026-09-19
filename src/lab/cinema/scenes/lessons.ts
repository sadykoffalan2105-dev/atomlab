import { CLO2_STEP_IDS } from './clo2/clo2Steps'
import { getClo2MechanismText, type Clo2Locale, type Clo2StepText } from './clo2/clo2MechanismText'
import type { CinemaLessonId } from './clo2/clo2StepStore'
import { CAO_STEP_IDS } from './cao/caoSteps'
import { getCaoMechanismText } from './cao/caoMechanismText'
import { CO2_STEP_IDS } from './co2/co2Steps'
import { getCo2MechanismText } from './co2/co2MechanismText'
import { FES_STEP_IDS } from './fes/fesSteps'
import { getFesMechanismText } from './fes/fesMechanismText'
import { H2O_STEP_IDS } from './h2o/h2oSteps'
import { getH2oMechanismText } from './h2o/h2oMechanismText'
import { HCL_STEP_IDS } from './hcl/hclSteps'
import { getHclMechanismText } from './hcl/hclMechanismText'
import { MGO_STEP_IDS } from './mgo/mgoSteps'
import { getMgoMechanismText } from './mgo/mgoMechanismText'
import { NACL_STEP_IDS } from './nacl/naclSteps'
import { getNaclMechanismText } from './nacl/naclMechanismText'
import { NH3_STEP_IDS } from './nh3/nh3Steps'
import { getNh3MechanismText } from './nh3/nh3MechanismText'
import { SO2_STEP_IDS } from './so2/so2Steps'
import { getSo2MechanismText } from './so2/so2MechanismText'
import { ZNCL2_STEP_IDS } from './zncl2/zncl2Steps'
import { getZncl2MechanismText } from './zncl2/zncl2MechanismText'

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

const LESSONS: Record<string, CinemaLesson> = {
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
  co2: {
    id: 'co2',
    stepIds: CO2_STEP_IDS,
    safetyStepId: 'energy',
    narrated: false,
    getText: (locale) => getCo2MechanismText(locale),
  },
  cao: {
    id: 'cao',
    stepIds: CAO_STEP_IDS,
    safetyStepId: 'classroom',
    narrated: false,
    getText: (locale) => getCaoMechanismText(locale),
  },
  h2o: {
    id: 'h2o',
    stepIds: H2O_STEP_IDS,
    safetyStepId: 'spark',
    narrated: false,
    getText: (locale) => getH2oMechanismText(locale),
  },
  nh3: {
    id: 'nh3',
    stepIds: NH3_STEP_IDS,
    safetyStepId: 'energy',
    narrated: false,
    getText: (locale) => getNh3MechanismText(locale),
  },
  so2: {
    id: 'so2',
    stepIds: SO2_STEP_IDS,
    safetyStepId: 'properties',
    narrated: false,
    getText: (locale) => getSo2MechanismText(locale),
  },
  mgo: {
    id: 'mgo',
    stepIds: MGO_STEP_IDS,
    safetyStepId: 'ignition',
    narrated: false,
    getText: (locale) => getMgoMechanismText(locale),
  },
  fes: {
    id: 'fes',
    stepIds: FES_STEP_IDS,
    safetyStepId: 'heating',
    narrated: false,
    getText: (locale) => getFesMechanismText(locale),
  },
  hcl: {
    id: 'hcl',
    stepIds: HCL_STEP_IDS,
    safetyStepId: 'energy',
    narrated: false,
    getText: (locale) => getHclMechanismText(locale),
  },
  zncl2: {
    id: 'zncl2',
    stepIds: ZNCL2_STEP_IDS,
    safetyStepId: 'energy',
    narrated: false,
    getText: (locale) => getZncl2MechanismText(locale),
  },
}

/**
 * Урок по id. Новая сцена добавляет сюда ОДНУ запись; пока её нет, панель
 * показывает урок ClO₂ и не падает (id урока — обычная строка, см. CinemaLessonId).
 */
export function getCinemaLesson(id: CinemaLessonId): CinemaLesson {
  return LESSONS[id] ?? LESSONS.clo2!
}

/** id шага урока по индексу (с зажимом в границы). */
export function lessonStepIdAt(lesson: CinemaLesson, index: number): string {
  const i = Math.min(Math.max(index, 0), lesson.stepIds.length - 1)
  return lesson.stepIds[i]!
}
