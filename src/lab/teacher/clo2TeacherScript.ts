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
      'Смотрите внимательно. Сейчас получим диоксид хлора. Слева и справа — хлорит натрия. В центре появится хлор. Главное — степени окисления хлора. Именно за ними следите.',
  },
  tension: {
    id: 'tension',
    title: 'Сближение',
    speak:
      'Хлор входит в зону реакции. Связь между атомами хлора натягивается. Энергия копится к разрыву. Хлорит пока ещё не окислился.',
  },
  transfer: {
    id: 'transfer',
    title: 'Перенос электрона',
    speak:
      'Внимание. Электрон уходит из хлорита в молекулу хлора. В хлорите хлор поднимается с плюс трёх до плюс четырёх. В молекуле хлора — с нуля до минус одного. Натрий здесь только наблюдатель. Не приниматель электрона.',
  },
  break: {
    id: 'break',
    title: 'Разрыв связи',
    speak:
      'Связь разорвалась. Появился хлорид. Если бы электрон улетел к натрию — механизм был бы неверным. Запомните это.',
  },
  pairA: {
    id: 'pairA',
    title: 'Хлорид натрия',
    speak:
      'Хлорид и натрий дают хлорид натрия. Это соль. Осадок. Вторая пара соберётся так же.',
  },
  pairB: {
    id: 'pairB',
    title: 'Вторая соль',
    speak: '',
  },
  radicalA: {
    id: 'radicalA',
    title: 'Диоксид хлора',
    speak:
      'Хлорит стал диоксидом хлора. Угол около ста семнадцати градусов. Уголковая молекула. Не прямая линия.',
  },
  radicalB: {
    id: 'radicalB',
    title: 'Второй газ',
    speak: '',
  },
  embryo: {
    id: 'embryo',
    title: 'Газ готов',
    speak:
      'Газообразный диоксид хлора готов. Это сильный окислитель. Держите стехиометрию. И контроль концентрации.',
  },
  precipitate: {
    id: 'precipitate',
    title: 'Осадок',
    speak:
      'Соль уходит вниз, в зону осадка. Газ и твёрдое вещество разделяются в кадре. Смотрите, как слои расходятся.',
  },
  birth: {
    id: 'birth',
    title: 'Продукты',
    speak:
      'Газ поднимается. Соль оседает. Уравнение сошлось. Два хлорита плюс хлор дают два хлорида и два диоксида хлора.',
  },
  complete: {
    id: 'complete',
    title: 'Запомните',
    speak:
      'Итог. Окисляется хлор хлорита. Восстанавливается хлор молекулы. Натрий — противоион. Угол в диоксиде хлора — около ста семнадцати градусов. Повторите раскадровку, если нужно закрепить.',
  },
}

const EN: ScriptPack = {
  intro: {
    id: 'intro',
    title: 'Starting',
    speak:
      'Watch closely. We will form chlorine dioxide. Sodium chlorite on the sides. Chlorine in the center. Focus on chlorine oxidation states. That is the key.',
  },
  tension: {
    id: 'tension',
    title: 'Approach',
    speak:
      'Chlorine enters the reaction zone. The chlorine-chlorine bond stretches. Energy builds toward the break. Chlorite is not oxidized yet.',
  },
  transfer: {
    id: 'transfer',
    title: 'Electron transfer',
    speak:
      'Watch. The electron leaves chlorite toward chlorine. In chlorite, chlorine goes from plus three to plus four. In molecular chlorine, from zero to minus one. Sodium is only a spectator. Not the electron acceptor.',
  },
  break: {
    id: 'break',
    title: 'Bond break',
    speak:
      'The bond broke. Chloride appears. If the electron went to sodium, the mechanism would be wrong. Remember that.',
  },
  pairA: {
    id: 'pairA',
    title: 'Sodium chloride',
    speak: 'Chloride and sodium form sodium chloride. That is the salt. The precipitate. The second pair forms the same way.',
  },
  pairB: { id: 'pairB', title: 'Second salt', speak: '' },
  radicalA: {
    id: 'radicalA',
    title: 'Chlorine dioxide',
    speak:
      'Chlorite becomes chlorine dioxide. The angle is about one hundred seventeen degrees. A bent molecule. Not linear.',
  },
  radicalB: { id: 'radicalB', title: 'Second gas', speak: '' },
  embryo: {
    id: 'embryo',
    title: 'Gas ready',
    speak:
      'Gaseous chlorine dioxide is ready. It is a strong oxidizer. Keep stoichiometry. And concentration control.',
  },
  precipitate: {
    id: 'precipitate',
    title: 'Precipitate',
    speak: 'Salt sinks into the precipitate zone. Gas and solid separate in the frame. Watch the layers diverge.',
  },
  birth: {
    id: 'birth',
    title: 'Products',
    speak:
      'Gas rises. Salt settles. The equation closes. Two chlorite plus chlorine give two chloride and two chlorine dioxide.',
  },
  complete: {
    id: 'complete',
    title: 'Remember',
    speak:
      'Summary. Chlorite chlorine is oxidized. Molecular chlorine is reduced. Sodium is the counter-ion. The angle in chlorine dioxide is about one hundred seventeen degrees.',
  },
}

const UZ: ScriptPack = {
  intro: {
    id: 'intro',
    title: 'Boshlaymiz',
    speak:
      'Diqqat bilan qarang. Endi xlor dioksidini olamiz. Yonlarda natriy xlorit. Markazda xlor. Asosiy kalit — xlorning oksidlanish darajasi. Shu belgilarga qarang.',
  },
  tension: {
    id: 'tension',
    title: 'Yaqinlashish',
    speak:
      'Xlor reaksiya zonasiga kiradi. Xlor–xlor bog‘i cho‘ziladi. Energiya uzilishga yig‘iladi. Xlorit hali oksidlanmagan.',
  },
  transfer: {
    id: 'transfer',
    title: 'Elektron o‘tishi',
    speak:
      'Diqqat. Elektron xloritdan xlorga o‘tadi. Xloritda xlor +3 dan +4 gacha. Molekuladagi xlorda 0 dan −1 gacha. Natriy faqat kuzatuvchi. Elektron qabul qiluvchi emas.',
  },
  break: {
    id: 'break',
    title: 'Uzilish',
    speak: 'Bog‘ uzildi. Xlorid paydo bo‘ldi. Elektroni natriyga yuborsangiz — mexanizm noto‘g‘ri. Buni eslab qoling.',
  },
  pairA: {
    id: 'pairA',
    title: 'Natriy xlorid',
    speak: 'Xlorid va natriy natriy xlorid hosil qiladi. Bu tuz. Cho‘kma. Ikkinchi juftlik ham shunday.',
  },
  pairB: { id: 'pairB', title: 'Ikkinchi tuz', speak: '' },
  radicalA: {
    id: 'radicalA',
    title: 'Xlor dioksid',
    speak: 'Xlorit xlor dioksidga aylandi. Burchak taxminan 117° — burchakli molekula, chiziqli emas.',
  },
  radicalB: { id: 'radicalB', title: 'Ikkinchi gaz', speak: '' },
  embryo: {
    id: 'embryo',
    title: 'Gaz tayyor',
    speak: 'Gazsimon xlor dioksid tayyor. Bu kuchli oksidlovchi. Stexiometriyani saqlang. Konsentratsiyani nazorat qiling.',
  },
  precipitate: {
    id: 'precipitate',
    title: 'Cho‘kma',
    speak: 'Tuz pastga, cho‘kma zonasiga ketadi. Gaz va qattiq modda ajraladi. Qatlamlarning ajralishini kuzating.',
  },
  birth: {
    id: 'birth',
    title: 'Mahsulotlar',
    speak: 'Gaz ko‘tariladi. Tuz cho‘kadi. Tenglama yopildi. Ikki xlorit plus xlor — ikki xlorid va ikki dioksid.',
  },
  complete: {
    id: 'complete',
    title: 'Eslab qoling',
    speak:
      'Xulosa. Xloritdagi xlor oksidlanadi. Molekuladagi xlor tiklanadi. Natriy qarshi-ion. Xlor dioksid burchagi taxminan 117°.',
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
