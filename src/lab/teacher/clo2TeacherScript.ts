/**
 * Профессиональный сценарий преподавателя для синтеза ClO₂ в лаборатории.
 * Реплики привязаны к cue раскадровки (+ intro на старте run).
 */

import type { Clo2CueId } from '../cinema/scenes/clo2/storyboard'

export type LabTeacherLocale = 'ru' | 'en' | 'uz'

export type Clo2TeacherLineId = 'intro' | Clo2CueId

export type Clo2TeacherLine = {
  id: Clo2TeacherLineId
  /** Короткий титр в HUD */
  title: string
  /** Полный текст для TTS */
  speak: string
}

type ScriptPack = Record<Clo2TeacherLineId, Clo2TeacherLine>

const RU: ScriptPack = {
  intro: {
    id: 'intro',
    title: 'Старт · уравнение',
    speak:
      'Смотрим получение диоксида хлора. Стехиометрия: два хлорита натрия плюс молекула хлора дают два хлорида натрия и две молекулы ClO₂. В микромире слева и справа — хлорит-ионы с ионами натрия, в центре появится Cl₂. Следите за степенями окисления хлора.',
  },
  tension: {
    id: 'tension',
    title: 'Сближение · натяжение Cl–Cl',
    speak:
      'Молекула хлора входит в зону реакции. Связь Cl–Cl натягивается и накапливает энергию к разрыву. Это ещё не окисление хлорита — пока идёт подготовка к переносу электрона.',
  },
  transfer: {
    id: 'transfer',
    title: 'Перенос электрона',
    speak:
      'Внимание: электрон уходит из хлорит-иона в молекулу хлора. Хлор в хлорите окисляется с плюс трёх до плюс четырёх. Атом хлора в Cl₂ восстанавливается с нуля до минус одного. Натрий здесь только наблюдатель — импульс не к нему.',
  },
  break: {
    id: 'break',
    title: 'Разрыв связи Cl–Cl',
    speak:
      'Связь Cl–Cl рвётся. Появляется хлорид-ион. Если перепутать направление переноса и «отправить» электрон к натрию, картина реакции будет химически неверной.',
  },
  pairA: {
    id: 'pairA',
    title: 'Ионная пара NaCl',
    speak:
      'Хлорид захватывается катионом натрия: образуется ионная пара хлорида натрия. Это продукт-осадок, не газ.',
  },
  pairB: {
    id: 'pairB',
    title: 'Вторая пара NaCl',
    speak: 'Симметрично формируется вторая пара NaCl — стехиометрия требует двух хлоридов.',
  },
  radicalA: {
    id: 'radicalA',
    title: 'Радикал ClO₂ · 117.4°',
    speak:
      'Хлорит перестраивается в радикал диоксида хлора. Угол O–Cl–O около ста семнадцати целых четырёх десятых градуса — уголковая форма, не линейная сто восемьдесят.',
  },
  radicalB: {
    id: 'radicalB',
    title: 'Вторая молекула ClO₂',
    speak: 'Вторая молекула ClO₂ собирается тем же путём — два газообразных продукта.',
  },
  embryo: {
    id: 'embryo',
    title: 'Продукт готов',
    speak:
      'Газообразный ClO₂ сформирован. В лаборатории это сильный окислитель: работайте с пониманием стехиометрии и контроля концентрации.',
  },
  precipitate: {
    id: 'precipitate',
    title: 'Осадок NaCl',
    speak: 'Хлорид натрия уходит вниз, в зону осадка. Газ и соль пространственно разделяются — так читается фазовый состав продуктов.',
  },
  birth: {
    id: 'birth',
    title: 'Разлёт продуктов',
    speak:
      'ClO₂ поднимается как газ с янтарно-красным характером свечения, соль оседает. Уравнение замыкается: два NaClO₂ плюс Cl₂ дают два NaCl и два ClO₂.',
  },
  complete: {
    id: 'complete',
    title: 'Итог · запомните',
    speak:
      'Итог. Окисляется хлор хлорита, восстанавливается хлор молекулы Cl₂, натрий — противоион. Угол в ClO₂ — около ста семнадцати градусов. Если перепутать окислитель и восстановитель, вы не объясните ни степени окисления, ни состав продуктов. Повторите раскадровку ещё раз при необходимости.',
  },
}

const EN: ScriptPack = {
  intro: {
    id: 'intro',
    title: 'Start · equation',
    speak:
      'We are forming chlorine dioxide. Stoichiometry: two sodium chlorite plus one chlorine molecule yield two sodium chloride and two ClO₂. Watch chlorite with sodium ions and Cl₂ entering the center. Track chlorine oxidation states.',
  },
  tension: {
    id: 'tension',
    title: 'Approach · Cl–Cl stretch',
    speak:
      'Chlorine enters the reaction zone. The Cl–Cl bond stretches and stores energy for cleavage. Chlorite is not oxidized yet — this is preparation for electron transfer.',
  },
  transfer: {
    id: 'transfer',
    title: 'Electron transfer',
    speak:
      'The electron leaves the chlorite ion toward Cl₂. Chlorine in chlorite is oxidized from plus three to plus four. Chlorine in Cl₂ is reduced from zero to minus one. Sodium is only a spectator — the impulse is not toward Na⁺.',
  },
  break: {
    id: 'break',
    title: 'Cl–Cl bond break',
    speak:
      'The Cl–Cl bond breaks and chloride appears. Sending the electron to sodium would make the mechanism chemically wrong.',
  },
  pairA: {
    id: 'pairA',
    title: 'NaCl ion pair',
    speak: 'Chloride is captured by sodium cation, forming an NaCl ion pair — the salt product, not the gas.',
  },
  pairB: {
    id: 'pairB',
    title: 'Second NaCl pair',
    speak: 'A second NaCl pair forms symmetrically — stoichiometry requires two chlorides.',
  },
  radicalA: {
    id: 'radicalA',
    title: 'ClO₂ radical · 117.4°',
    speak:
      'Chlorite reconfigures into the ClO₂ radical. The O–Cl–O angle is about one hundred seventeen point four degrees — bent, not linear one hundred eighty.',
  },
  radicalB: {
    id: 'radicalB',
    title: 'Second ClO₂',
    speak: 'The second ClO₂ molecule forms the same way — two gaseous products.',
  },
  embryo: {
    id: 'embryo',
    title: 'Product ready',
    speak:
      'Gaseous ClO₂ is formed. It is a strong oxidizer — respect stoichiometry and concentration control in the lab.',
  },
  precipitate: {
    id: 'precipitate',
    title: 'NaCl precipitate',
    speak: 'Sodium chloride sinks into the precipitate zone. Gas and salt separate spatially — that is how product phases read.',
  },
  birth: {
    id: 'birth',
    title: 'Product release',
    speak:
      'ClO₂ rises as gas with amber-red character; salt settles. The equation closes: two NaClO₂ plus Cl₂ give two NaCl and two ClO₂.',
  },
  complete: {
    id: 'complete',
    title: 'Summary',
    speak:
      'Summary. Chlorite chlorine is oxidized; molecular chlorine is reduced; sodium is the counter-ion. ClO₂ angle is about one hundred seventeen degrees. Swap oxidizer and reducer and you cannot explain oxidation states or products. Replay the storyboard if needed.',
  },
}

const UZ: ScriptPack = {
  intro: {
    id: 'intro',
    title: 'Boshlash · tenglama',
    speak:
      'Xlor dioksidini olishni ko‘ramiz. Stexiometriya: ikki natriy xlorit va bir Cl₂ dan ikki NaCl va ikki ClO₂ hosil bo‘ladi. Markazga Cl₂ kiradi — xlorning oksidlanish darajasiga e’tibor bering.',
  },
  tension: {
    id: 'tension',
    title: 'Yaqinlashish · Cl–Cl',
    speak:
      'Xlor zona ichiga kiradi. Cl–Cl bog‘i cho‘ziladi va uzilishga energiya to‘playdi. Hali xlorit oksidlanmayapti — elektron o‘tishiga tayyorgarlik.',
  },
  transfer: {
    id: 'transfer',
    title: 'Elektron o‘tishi',
    speak:
      'Elektron xloritdan Cl₂ ga o‘tadi. Xloritdagi xlor +3 dan +4 gacha oksidlanadi, Cl₂ dagi xlor 0 dan −1 gacha tiklanadi. Natriy faqat kuzatuvchi — impuls Na⁺ ga emas.',
  },
  break: {
    id: 'break',
    title: 'Cl–Cl uzilishi',
    speak:
      'Cl–Cl bog‘i uziladi, xlorid-ion paydo bo‘ladi. Elektroni natriyga yuborsangiz, mexanizm noto‘g‘ri bo‘ladi.',
  },
  pairA: {
    id: 'pairA',
    title: 'NaCl juftligi',
    speak: 'Xlorid natriy kationi bilan NaCl ion juftligini hosil qiladi — tuz, gaz emas.',
  },
  pairB: {
    id: 'pairB',
    title: 'Ikkinchi NaCl',
    speak: 'Ikkinchi NaCl juftligi ham hosil bo‘ladi — stexiometriya ikkita xloridni talab qiladi.',
  },
  radicalA: {
    id: 'radicalA',
    title: 'ClO₂ · 117.4°',
    speak:
      'Xlorit ClO₂ radikaliga qayta tuziladi. O–Cl–O burchagi taxminan 117.4° — burchakli shakl, 180° chiziqli emas.',
  },
  radicalB: {
    id: 'radicalB',
    title: 'Ikkinchi ClO₂',
    speak: 'Ikkinchi ClO₂ xuddi shu yo‘l bilan yig‘iladi — ikkita gazsimon mahsulot.',
  },
  embryo: {
    id: 'embryo',
    title: 'Mahsulot tayyor',
    speak:
      'Gazsimon ClO₂ hosil bo‘ldi. Bu kuchli oksidlovchi — stexiometriya va konsentratsiyani nazorat qiling.',
  },
  precipitate: {
    id: 'precipitate',
    title: 'NaCl cho‘kma',
    speak: 'Natriy xlorid pastga, cho‘kma zonasiga ketadi. Gaz va tuz fazaviy ajraladi.',
  },
  birth: {
    id: 'birth',
    title: 'Mahsulotlar',
    speak:
      'ClO₂ gaz sifatida ko‘tariladi, tuz cho‘kadi. Tenglama yopiladi: 2 NaClO₂ + Cl₂ → 2 NaCl + 2 ClO₂.',
  },
  complete: {
    id: 'complete',
    title: 'Xulosa',
    speak:
      'Xulosa. Xloritdagi xlor oksidlanadi, Cl₂ dagi xlor tiklanadi, natriy qarshi-ion. ClO₂ burchagi ~117°. Oksidlovchi va tiklovchini almashtirsangiz, oksidlanish darajasi va mahsulotlarni tushuntira olmaysiz.',
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
