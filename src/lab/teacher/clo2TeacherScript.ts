/**
 * Сценарий преподавателя для синтеза ClO₂.
 *
 * Правило: каждая реплика ≤ wall-gap до следующего cue (~1–3 с речи).
 * Плотные кадры (transfer→break ~0.7–1.5 s) — одна короткая фраза.
 * Детали redox — в HUD captions, не в TTS.
 */

import type { Clo2CueId } from '../cinema/scenes/clo2/storyboard'

export type LabTeacherLocale = 'ru' | 'en' | 'uz'

export type Clo2TeacherLineId = 'intro' | Clo2CueId

export type Clo2TeacherLine = {
  id: Clo2TeacherLineId
  /** Короткий титр в HUD */
  title: string
  /** Полный текст для TTS — одна-две фразы */
  speak: string
}

type ScriptPack = Record<Clo2TeacherLineId, Clo2TeacherLine>

/** Cue без отдельной озвучки (визуал остаётся; речь уже покрыта соседним cue). */
export const CLO2_SPEECH_SILENT: ReadonlySet<Clo2CueId> = new Set([
  'pairB',
  'radicalB',
  /** embryo близко к radicalA — не дублируем */
  'embryo',
])

const RU: ScriptPack = {
  intro: {
    id: 'intro',
    title: 'Начинаем',
    speak: 'Смотрите. Получаем диоксид хлора. Следите за степенями окисления.',
  },
  tension: {
    id: 'tension',
    title: 'Сближение',
    speak: 'Хлор входит. Связь натягивается.',
  },
  transfer: {
    id: 'transfer',
    title: 'Перенос',
    speak: 'Электрон уходит из хлорита. Плюс три — плюс четыре.',
  },
  break: {
    id: 'break',
    title: 'Разрыв',
    speak: 'Связь разорвалась. Хлор стал минус один.',
  },
  pairA: {
    id: 'pairA',
    title: 'Хлорид натрия',
    speak: 'Хлорид и натрий — соль. Осадок.',
  },
  pairB: { id: 'pairB', title: 'Вторая соль', speak: '' },
  radicalA: {
    id: 'radicalA',
    title: 'Диоксид хлора',
    speak: 'Это диоксид хлора. Угол — сто семнадцать градусов.',
  },
  radicalB: { id: 'radicalB', title: 'Второй газ', speak: '' },
  embryo: { id: 'embryo', title: 'Газ готов', speak: '' },
  precipitate: {
    id: 'precipitate',
    title: 'Осадок',
    speak: 'Соль вниз. Газ вверх.',
  },
  birth: {
    id: 'birth',
    title: 'Продукты',
    speak: 'Уравнение сошлось. Два хлорита плюс хлор.',
  },
  complete: {
    id: 'complete',
    title: 'Итог',
    speak: 'Окисляется хлорит. Восстанавливается хлор. Натрий — противоион.',
  },
}

const EN: ScriptPack = {
  intro: {
    id: 'intro',
    title: 'Starting',
    speak: 'Watch. We form chlorine dioxide. Focus on oxidation states.',
  },
  tension: {
    id: 'tension',
    title: 'Approach',
    speak: 'Chlorine enters. The bond stretches.',
  },
  transfer: {
    id: 'transfer',
    title: 'Transfer',
    speak: 'Electron leaves chlorite. Plus three to plus four.',
  },
  break: {
    id: 'break',
    title: 'Break',
    speak: 'Bond broke. Chlorine is now minus one.',
  },
  pairA: {
    id: 'pairA',
    title: 'Sodium chloride',
    speak: 'Chloride and sodium — the salt.',
  },
  pairB: { id: 'pairB', title: 'Second salt', speak: '' },
  radicalA: {
    id: 'radicalA',
    title: 'Chlorine dioxide',
    speak: 'Chlorine dioxide. Bend angle — one hundred seventeen degrees.',
  },
  radicalB: { id: 'radicalB', title: 'Second gas', speak: '' },
  embryo: { id: 'embryo', title: 'Gas ready', speak: '' },
  precipitate: {
    id: 'precipitate',
    title: 'Precipitate',
    speak: 'Salt down. Gas up.',
  },
  birth: {
    id: 'birth',
    title: 'Products',
    speak: 'Equation closes. Two chlorite plus chlorine.',
  },
  complete: {
    id: 'complete',
    title: 'Summary',
    speak: 'Chlorite is oxidized. Chlorine is reduced. Sodium is the counter-ion.',
  },
}

const UZ: ScriptPack = {
  intro: {
    id: 'intro',
    title: 'Boshlaymiz',
    speak: 'Qarang. Xlor dioksid olamiz. Oksidlanish darajasini kuzating.',
  },
  tension: {
    id: 'tension',
    title: 'Yaqinlashish',
    speak: 'Xlor kiradi. Bog choziladi.',
  },
  transfer: {
    id: 'transfer',
    title: 'Otish',
    speak: 'Elektron xloritdan ketadi. Uchdan tortga.',
  },
  break: {
    id: 'break',
    title: 'Uzilish',
    speak: 'Bog uzildi. Xlor endi minus bir.',
  },
  pairA: {
    id: 'pairA',
    title: 'Natriy xlorid',
    speak: 'Xlorid va natriy — tuz.',
  },
  pairB: { id: 'pairB', title: 'Ikkinchi tuz', speak: '' },
  radicalA: {
    id: 'radicalA',
    title: 'Xlor dioksid',
    speak: 'Bu xlor dioksid. Burchak — 117 daraja.',
  },
  radicalB: { id: 'radicalB', title: 'Ikkinchi gaz', speak: '' },
  embryo: { id: 'embryo', title: 'Gaz tayyor', speak: '' },
  precipitate: {
    id: 'precipitate',
    title: "Cho'kma",
    speak: 'Tuz pastga. Gaz tepaga.',
  },
  birth: {
    id: 'birth',
    title: 'Mahsulotlar',
    speak: 'Tenglama yopildi. Ikki xlorit plus xlor.',
  },
  complete: {
    id: 'complete',
    title: 'Xulosa',
    speak: 'Xlorit oksidlanadi. Xlor tiklanadi. Natriy qarshi-ion.',
  },
}

const PACKS: Record<LabTeacherLocale, ScriptPack> = { ru: RU, en: EN, uz: UZ }

/** Cue, на которых играет SFX (не все реплики). */
export const CLO2_TEACHER_SFX: Partial<Record<Clo2CueId, 'spark' | 'snap' | 'dust'>> = {
  tension: 'spark',
  break: 'spark',
  pairA: 'snap',
  precipitate: 'dust',
}

export function getClo2TeacherLine(
  locale: LabTeacherLocale,
  id: Clo2TeacherLineId,
): Clo2TeacherLine {
  return PACKS[locale][id] ?? PACKS.ru[id]
}

export function getLabTeacherScriptProductIds(): readonly string[] {
  return ['clo2']
}

export function hasLabTeacherScript(productId: string | null | undefined): boolean {
  return productId === 'clo2'
}
