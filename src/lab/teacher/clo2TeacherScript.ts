/**
 * Сценарий преподавателя для синтеза ClO₂ — одна реплика на шаг механизма.
 *
 * Тексты не дублируем: title/speak берутся из пакета урока (clo2MechanismText),
 * чтобы панель шагов и голос никогда не расходились.
 */

import { CLO2_STEP_IDS, type Clo2CueId, type Clo2StepId } from '../cinema/scenes/clo2/clo2Steps'
import {
  getClo2MechanismText,
  type Clo2Locale,
  type Clo2MechanismText,
} from '../cinema/scenes/clo2/clo2MechanismText'
import type { playLabReactionSfx } from './labReactionSfx'

export type LabTeacherLocale = Clo2Locale

export type Clo2TeacherLineId = 'intro' | Clo2StepId

export type Clo2TeacherLine = {
  id: Clo2TeacherLineId
  /** Короткий титр в HUD */
  title: string
  /** Текст для TTS — одна-три короткие фразы */
  speak: string
}

/** Порядок реплик урока: вступление, затем шаги. */
export const CLO2_TEACHER_LINE_IDS: readonly Clo2TeacherLineId[] = ['intro', ...CLO2_STEP_IDS]

type LabReactionSfxKind = Parameters<typeof playLabReactionSfx>[0]

/** SFX на событиях сцены (речь к cue больше не привязана). */
export const CLO2_TEACHER_SFX: Partial<Record<Clo2CueId, LabReactionSfxKind>> = {
  /** пузырёк Cl₂ растворился — мягкий шорох */
  bubble: 'dust',
  /** новая связь O–Cl и разрыв Cl–Cl */
  clTransfer: 'spark',
  /** второй хлорит «защёлкнулся» на центральном Cl */
  adduct: 'snap',
  /** комплекс распался на два радикала */
  split: 'spark',
}

type LinePack = Record<Clo2TeacherLineId, Clo2TeacherLine>

const packCache = new WeakMap<Clo2MechanismText, LinePack>()

function buildPack(text: Clo2MechanismText): LinePack {
  const pack = {
    intro: { id: 'intro', title: text.intro.title, speak: text.intro.speak },
  } as LinePack
  for (const id of CLO2_STEP_IDS) {
    const step = text.steps[id]
    pack[id] = { id, title: step.title, speak: step.speak }
  }
  return pack
}

export function getClo2TeacherLine(
  locale: LabTeacherLocale,
  id: Clo2TeacherLineId,
): Clo2TeacherLine {
  const text = getClo2MechanismText(locale)
  let pack = packCache.get(text)
  if (!pack) {
    pack = buildPack(text)
    packCache.set(text, pack)
  }
  return pack[id]
}

export function getLabTeacherScriptProductIds(): readonly string[] {
  return ['clo2']
}

export function hasLabTeacherScript(productId: string | null | undefined): boolean {
  return productId === 'clo2'
}
