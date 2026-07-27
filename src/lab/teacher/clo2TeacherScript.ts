/**
 * Сценарий преподавателя для синтеза ClO₂.
 * Живая речь у стола: короткие фразы, явные паузы, химия на слух.
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
export const CLO2_SPEECH_SILENT: ReadonlySet<Clo2CueId> = new Set(['pairB', 'radicalB'])

const RU: ScriptPack = {
  intro: {
    id: 'intro',
    title: 'Начинаем',
    speak:
      'Смотрите. Получаем диоксид хлора. Хлорит натрия по краям. В центре появится хлор. Следите за степенями окисления.',
  },
  tension: {
    id: 'tension',
    title: 'Сближение',
    speak: 'Хлор входит в зону реакции. Связь натягивается. Энергия копится.',
  },
  transfer: {
    id: 'transfer',
    title: 'Перенос электрона',
    speak:
      'Электрон уходит из хлорита в молекулу хлора. Хлор в хлорите: плюс три → плюс четыре. В молекуле хлора: ноль → минус один. Натрий — только наблюдатель.',
  },
  break: {
    id: 'break',
    title: 'Разрыв связи',
    speak: 'Связь разорвалась. Появился хлорид. Электрон ушёл к хлору, не к натрию.',
  },
  pairA: {
    id: 'pairA',
    title: 'Хлорид натрия',
    speak: 'Хлорид и натрий — хлорид натрия. Соль. Осадок.',
  },
  pairB: {
    id: 'pairB',
    title: 'Вторая соль',
    speak: '',
  },
  radicalA: {
    id: 'radicalA',
    title: 'Диоксид хлора',
    speak: 'Хлорит стал диоксидом хлора. Угол — сто семнадцать градусов. Уголковая молекула.',
  },
  radicalB: {
    id: 'radicalB',
    title: 'Второй газ',
    speak: '',
  },
  embryo: {
    id: 'embryo',
    title: 'Газ готов',
    speak: 'Диоксид хлора готов. Сильный окислитель. Контролируйте концентрацию.',
  },
  precipitate: {
    id: 'precipitate',
    title: 'Осадок',
    speak: 'Соль идёт вниз. Газ поднимается. Слои расходятся.',
  },
  birth: {
    id: 'birth',
    title: 'Продукты',
    speak: 'Реакция завершена. Два хлорита плюс хлор — два хлорида и два диоксида хлора.',
  },
  complete: {
    id: 'complete',
    title: 'Итог',
    speak:
      'Запомните. Окисляется хлор хлорита. Восстанавливается хлор молекулы. Натрий — противоион. Угол диоксида хлора — сто семнадцать градусов.',
  },
}

const EN: ScriptPack = {
  intro: {
    id: 'intro',
    title: 'Starting',
    speak:
      'Watch. We form chlorine dioxide. Sodium chlorite on the sides. Chlorine in the center. Focus on oxidation states.',
  },
  tension: {
    id: 'tension',
    title: 'Approach',
    speak: 'Chlorine enters the reaction zone. The bond stretches. Energy builds.',
  },
  transfer: {
    id: 'transfer',
    title: 'Electron transfer',
    speak:
      'The electron leaves chlorite toward chlorine. In chlorite: plus three to plus four. In chlorine molecule: zero to minus one. Sodium is only a spectator.',
  },
  break: {
    id: 'break',
    title: 'Bond break',
    speak: 'The bond broke. Chloride appears. The electron went to chlorine, not sodium.',
  },
  pairA: {
    id: 'pairA',
    title: 'Sodium chloride',
    speak: 'Chloride and sodium — sodium chloride. The salt. The precipitate.',
  },
  pairB: { id: 'pairB', title: 'Second salt', speak: '' },
  radicalA: {
    id: 'radicalA',
    title: 'Chlorine dioxide',
    speak: 'Chlorite becomes chlorine dioxide. The angle is one hundred seventeen degrees. A bent molecule.',
  },
  radicalB: { id: 'radicalB', title: 'Second gas', speak: '' },
  embryo: {
    id: 'embryo',
    title: 'Gas ready',
    speak: 'Chlorine dioxide is ready. A strong oxidizer. Control the concentration.',
  },
  precipitate: {
    id: 'precipitate',
    title: 'Precipitate',
    speak: 'Salt sinks. Gas rises. The layers separate.',
  },
  birth: {
    id: 'birth',
    title: 'Products',
    speak: 'Reaction complete. Two chlorite plus chlorine give two chloride and two chlorine dioxide.',
  },
  complete: {
    id: 'complete',
    title: 'Summary',
    speak:
      'Remember. Chlorite chlorine is oxidized. Molecular chlorine is reduced. Sodium is the counter-ion. Bend angle: one hundred seventeen degrees.',
  },
}

const UZ: ScriptPack = {
  intro: {
    id: 'intro',
    title: 'Boshlaymiz',
    speak:
      'Qarang. Xlor dioksid olamiz. Yonlarda natriy xlorit. Markazda xlor. Oksidlanish darajasini kuzating.',
  },
  tension: {
    id: 'tension',
    title: 'Yaqinlashish',
    speak:
      'Xlor reaksiya zonasiga kiradi. Energiya yigiladi. Uzilish yaqin.',
  },
  transfer: {
    id: 'transfer',
    title: 'Elektron o‘tishi',
    speak:
      'Elektron xloritdan xlorga otadi. Xloritda: uch dan tortga. Molekulada: noldan minus birga. Natriy faqat kuzatuvchi.',
  },
  break: {
    id: 'break',
    title: 'Uzilish',
    speak: 'Bog uzildi. Xlorid paydo boldi. Elektron xlorga ketdi, natriyga emas.',
  },
  pairA: {
    id: 'pairA',
    title: 'Natriy xlorid',
    speak: 'Xlorid va natriy - natriy xlorid. Tuz. Chokma.',
  },
  pairB: { id: 'pairB', title: 'Ikkinchi tuz', speak: '' },
  radicalA: {
    id: 'radicalA',
    title: 'Xlor dioksid',
    speak: 'Xlorit xlor dioksidga aylandi. Burchak - 117 daraja. Burchakli molekula.',
  },
  radicalB: { id: 'radicalB', title: 'Ikkinchi gaz', speak: '' },
  embryo: {
    id: 'embryo',
    title: 'Gaz tayyor',
    speak: 'Xlor dioksid tayyor. Kuchli oksidlovchi. Konsentratsiyani nazorat qiling.',
  },
  precipitate: {
    id: 'precipitate',
    title: 'Cho‘kma',
    speak: 'Tuz pastga ketadi. Gaz kotrariladi. Qatlamlar ajraladi.',
  },
  birth: {
    id: 'birth',
    title: 'Mahsulotlar',
    speak: 'Reaksiya tugadi. Ikki xlorit plus xlor - ikki xlorid va ikki dioksid.',
  },
  complete: {
    id: 'complete',
    title: 'Eslab qoling',
    speak:
      'Eslab qoling. Xloritdagi xlor oksidlanadi. Molekuladagi xlor tiklanadi. Natriy qarshi-ion. Burchak - 117 daraja.',
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
