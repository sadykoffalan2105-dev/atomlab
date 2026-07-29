/**
 * Сценарий преподавателя для синтеза ClO₂.
 *
 * Правило: каждая реплика ≤ wall-gap до следующего cue (~1–3 с речи).
 * Живой разговорный тон — как у преподавателя у стола, не диктор.
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
  'embryo',
  /** После реакции: только SFX/картинка — длинный хвост давал задержку settle. */
  'precipitate',
  'birth',
])

const RU: ScriptPack = {
  intro: {
    id: 'intro',
    title: 'Начинаем',
    speak: 'Сейчас получим диоксид хлора. Смотрите на степени окисления хлора.',
  },
  tension: {
    id: 'tension',
    title: 'Сближение',
    speak: 'Хлор подходит. Связь в молекуле натягивается.',
  },
  transfer: {
    id: 'transfer',
    title: 'Перенос',
    speak: 'Перенос электрона из хлорита. Плюс три стало плюс четыре.',
  },
  break: {
    id: 'break',
    title: 'Разрыв',
    speak: 'Связь порвалась. Хлор принял электрон — минус один.',
  },
  pairA: {
    id: 'pairA',
    title: 'Хлорид натрия',
    speak: 'Ион хлора с натрием. Образуется соль.',
  },
  pairB: { id: 'pairB', title: 'Вторая соль', speak: '' },
  radicalA: {
    id: 'radicalA',
    title: 'Диоксид хлора',
    speak: 'Это диоксид хлора. Угол связей — сто семнадцать градусов.',
  },
  radicalB: { id: 'radicalB', title: 'Второй газ', speak: '' },
  embryo: { id: 'embryo', title: 'Газ готов', speak: '' },
  precipitate: { id: 'precipitate', title: 'Осадок', speak: '' },
  birth: { id: 'birth', title: 'Продукты', speak: '' },
  complete: {
    id: 'complete',
    title: 'Итог',
    speak: 'Итог: хлорит окислился, хлор восстановился.',
  },
}

const EN: ScriptPack = {
  intro: {
    id: 'intro',
    title: 'Starting',
    speak: 'Now we make chlorine dioxide. Watch the oxidation states of chlorine.',
  },
  tension: {
    id: 'tension',
    title: 'Approach',
    speak: 'Chlorine moves in. The bond stretches.',
  },
  transfer: {
    id: 'transfer',
    title: 'Transfer',
    speak: 'Electron transfer from chlorite. Plus three becomes plus four.',
  },
  break: {
    id: 'break',
    title: 'Break',
    speak: 'The bond snaps. Chlorine took the electron — minus one.',
  },
  pairA: {
    id: 'pairA',
    title: 'Sodium chloride',
    speak: 'Chloride meets sodium. Salt forms.',
  },
  pairB: { id: 'pairB', title: 'Second salt', speak: '' },
  radicalA: {
    id: 'radicalA',
    title: 'Chlorine dioxide',
    speak: 'This is chlorine dioxide. Bond angle — one hundred seventeen degrees.',
  },
  radicalB: { id: 'radicalB', title: 'Second gas', speak: '' },
  embryo: { id: 'embryo', title: 'Gas ready', speak: '' },
  precipitate: { id: 'precipitate', title: 'Precipitate', speak: '' },
  birth: { id: 'birth', title: 'Products', speak: '' },
  complete: {
    id: 'complete',
    title: 'Summary',
    speak: 'Summary: chlorite oxidized, chlorine reduced.',
  },
}

const UZ: ScriptPack = {
  intro: {
    id: 'intro',
    title: 'Boshlaymiz',
    speak: 'Hozir xlor dioksid olamiz. Xlorning oksidlanish darajasiga qarang.',
  },
  tension: {
    id: 'tension',
    title: 'Yaqinlashish',
    speak: 'Xlor yaqinlashadi. Molekuladagi bog choziladi.',
  },
  transfer: {
    id: 'transfer',
    title: 'Otish',
    speak: 'Elektron xloritdan o\'tadi. Uchdan tortga aylandi.',
  },
  break: {
    id: 'break',
    title: 'Uzilish',
    speak: 'Bog uzildi. Xlor elektronni oldi — minus bir.',
  },
  pairA: {
    id: 'pairA',
    title: 'Natriy xlorid',
    speak: 'Xlorid natriy bilan uchrashdi. Tuz hosil bo\'ldi.',
  },
  pairB: { id: 'pairB', title: 'Ikkinchi tuz', speak: '' },
  radicalA: {
    id: 'radicalA',
    title: 'Xlor dioksid',
    speak: 'Bu xlor dioksid. Bog\'lar burchagi — 117 daraja.',
  },
  radicalB: { id: 'radicalB', title: 'Ikkinchi gaz', speak: '' },
  embryo: { id: 'embryo', title: 'Gaz tayyor', speak: '' },
  precipitate: { id: 'precipitate', title: "Cho'kma", speak: '' },
  birth: { id: 'birth', title: 'Mahsulotlar', speak: '' },
  complete: {
    id: 'complete',
    title: 'Xulosa',
    speak: 'Xulosa: xlorit oksidlandi, xlor tiklandi.',
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
