/**
 * Адаптация ответа к ученику: инструкции для промпта LLM и правила для запасного ответа.
 *   level ≤ 2 — короче, бытовые аналогии, одно новое понятие; level ≥ 4 — строгие формулировки, механизмы, числа;
 *   confused — проще и спросить, что непонятно; tired/bored — короче, одна яркая деталь, предложить опыт;
 *   stressed — успокоить и разбить на шаги; повторяющаяся ошибка — назвать её и дать проверочный вопрос.
 */
import type { Lang } from '../pipeline/normalize.ts'
import type { StudentSnapshot } from './model.ts'

const T = (lang: Lang, ru: string, uz: string, en: string) => (lang === 'ru' ? ru : lang === 'uz' ? uz : en)

export const ERROR_INFO: Record<string, { ru: [string, string]; uz: [string, string]; en: [string, string] }> = {
  mass_mole: {
    ru: ['путаница массы и количества вещества (граммы ↔ моли)', 'Проверка: сколько моль в 18 г воды, если M(H₂O) = 18 г/моль?'],
    uz: ['massa va modda miqdorini (gramm ↔ mol) adashtirish', 'Tekshiruv: M(H₂O) = 18 g/mol boʻlsa, 18 g suvda necha mol bor?'],
    en: ['mixing up mass and amount of substance (grams ↔ moles)', 'Check: how many moles are in 18 g of water if M(H₂O) = 18 g/mol?'],
  },
  atom_molecule: {
    ru: ['путаница атома и молекулы', 'Проверка: из скольких атомов состоит одна молекула воды?'],
    uz: ['atom va molekulani adashtirish', 'Tekshiruv: bitta suv molekulasi nechta atomdan iborat?'],
    en: ['mixing up atoms and molecules', 'Check: how many atoms make up one water molecule?'],
  },
  valence_oxidation: {
    ru: ['путаница валентности и степени окисления', 'Проверка: какая валентность и какая степень окисления у кислорода в H₂O?'],
    uz: ['valentlik va oksidlanish darajasini adashtirish', 'Tekshiruv: H₂O da kislorodning valentligi va oksidlanish darajasi qanday?'],
    en: ['mixing up valence and oxidation state', 'Check: what are the valence and the oxidation state of oxygen in H₂O?'],
  },
  unbalanced_equation: {
    ru: ['неуравненное уравнение', 'Проверка: сколько атомов кислорода слева и справа в 2H₂ + O₂ → 2H₂O?'],
    uz: ['tenglashtirilmagan tenglama', 'Tekshiruv: 2H₂ + O₂ → 2H₂O da chapda va oʻngda nechtadan kislorod atomi bor?'],
    en: ['an unbalanced equation', 'Check: how many oxygen atoms are on each side of 2H₂ + O₂ → 2H₂O?'],
  },
  units: {
    ru: ['ошибка в единицах измерения', 'Проверка: в каких единицах измеряют молярную массу — г или г/моль?'],
    uz: ['oʻlchov birliklaridagi xato', 'Tekshiruv: molyar massa qaysi birlikda oʻlchanadi — g yoki g/mol?'],
    en: ['a units mistake', 'Check: is molar mass measured in g or in g/mol?'],
  },
  nomenclature: {
    ru: ['ошибка в названии или формуле вещества', 'Проверка: какая формула у оксида натрия — NaO или Na₂O, и почему?'],
    uz: ['modda nomi yoki formulasidagi xato', 'Tekshiruv: natriy oksidining formulasi qanday — NaO yoki Na₂O, nega?'],
    en: ['a naming or formula mistake', 'Check: is sodium oxide NaO or Na₂O, and why?'],
  },
  calc_mismatch: {
    ru: ['арифметическая ошибка в расчёте', 'Проверка: пересчитайте молярную массу по таблице Менделеева и сравните.'],
    uz: ['hisob-kitobdagi xato', 'Tekshiruv: molyar massani davriy jadval boʻyicha qayta hisoblang va solishtiring.'],
    en: ['a calculation slip', 'Check: recompute the molar mass from the periodic table and compare.'],
  },
}

export function errorName(tag: string, lang: Lang): string {
  return ERROR_INFO[tag]?.[lang][0] ?? tag
}

/** Блок «УЧЕНИК» для системного промпта. */
export function adaptationForPrompt(s: StudentSnapshot, lang: Lang): string {
  const lines: string[] = []
  lines.push(T(lang, `Уровень ${s.levelInt}/5, темп ${s.pace}, настроение ${s.mood}.`, `Daraja ${s.levelInt}/5, surʼat ${s.pace}, kayfiyat ${s.mood}.`, `Level ${s.levelInt}/5, pace ${s.pace}, mood ${s.mood}.`))
  if (s.recentErrors.length) lines.push(T(lang, `Типичные ошибки: ${s.recentErrors.map((e) => errorName(e, 'ru')).join('; ')}.`, `Tipik xatolar: ${s.recentErrors.map((e) => errorName(e, 'uz')).join('; ')}.`, `Typical mistakes: ${s.recentErrors.map((e) => errorName(e, 'en')).join('; ')}.`))
  if (s.levelInt <= 2) lines.push(T(lang, 'Пиши короче, с бытовой аналогией, вводи только одно новое понятие.', 'Qisqaroq yoz, kundalik hayotdan oʻxshatish keltir, faqat bitta yangi tushuncha kirit.', 'Keep it shorter, use an everyday analogy, introduce only one new idea.'))
  if (s.levelInt >= 4) lines.push(T(lang, 'Можно строгие формулировки, механизмы и числа.', 'Qatʼiy taʼriflar, mexanizmlar va sonlar mumkin.', 'Use rigorous wording, mechanisms and numbers.'))
  if (s.mood === 'confused') lines.push(T(lang, 'Ученик запутался: переформулируй проще и в конце спроси, что именно непонятно.', 'Oʻquvchi chalkashdi: soddaroq qayta tushuntir va oxirida aynan nima tushunarsizligini soʻra.', 'The student is confused: rephrase more simply and ask what exactly is unclear.'))
  if (s.mood === 'tired' || s.mood === 'bored') lines.push(T(lang, 'Ученик устал или скучает: короче, одна яркая деталь, предложи опыт в лаборатории ATOMLAB.', 'Oʻquvchi charchagan yoki zerikkan: qisqaroq, bitta yorqin tafsilot, ATOMLAB laboratoriyasida tajriba taklif qil.', 'The student is tired or bored: keep it short, one vivid detail, suggest an ATOMLAB lab experiment.'))
  if (s.mood === 'stressed') lines.push(T(lang, 'Ученик волнуется: успокой одной фразой и разбей ответ на шаги.', 'Oʻquvchi xavotirda: bir jumla bilan tinchlantir va javobni bosqichlarga ajrat.', 'The student is anxious: reassure in one sentence and split the answer into steps.'))
  if (s.repeatedError) {
    const info = ERROR_INFO[s.repeatedError]
    if (info) lines.push(T(lang, `Ошибка повторяется (${info.ru[0]}): назови её прямо и задай проверочный вопрос: «${info.ru[1]}»`, `Xato takrorlanmoqda (${info.uz[0]}): uni ochiq ayt va tekshiruv savolini ber: «${info.uz[1]}»`, `The mistake repeats (${info.en[0]}): name it and ask: “${info.en[1]}”`))
  }
  return lines.join('\n')
}

export type FallbackStyle = { maxSentences: number; prefix: string; suffix: string; offerLab: boolean }

/** Правила оформления запасного ответа под ученика. */
export function fallbackStyle(s: StudentSnapshot, lang: Lang, detail: 'brief' | 'more', mode: 'chat' | 'live'): FallbackStyle {
  let maxSentences = detail === 'more' ? 7 : 4
  if (mode === 'live') maxSentences = 3
  if (s.levelInt <= 2 || s.mood === 'tired' || s.mood === 'bored') maxSentences = Math.min(maxSentences, 3)
  let prefix = ''
  let suffix = ''
  if (s.mood === 'stressed') prefix = T(lang, 'Не волнуйтесь — разберём по шагам. ', 'Xavotir olmang — bosqichma-bosqich koʻrib chiqamiz. ', 'No need to worry — let us go step by step. ')
  if (s.mood === 'confused') prefix = T(lang, 'Скажу проще. ', 'Soddaroq aytaman. ', 'Let me put it more simply. ')
  if (s.mood === 'confused') suffix = T(lang, 'Что именно осталось непонятным?', 'Aynan nima tushunarsiz qoldi?', 'What exactly is still unclear?')
  if (s.repeatedError) {
    const info = ERROR_INFO[s.repeatedError]
    if (info) suffix = T(lang, `Обратите внимание: повторяется ${info.ru[0]}. ${info.ru[1]}`, `Eʼtibor bering: ${info.uz[0]} takrorlanmoqda. ${info.uz[1]}`, `Note: ${info.en[0]} keeps coming up. ${info.en[1]}`)
  }
  return { maxSentences, prefix, suffix, offerLab: s.mood === 'tired' || s.mood === 'bored' }
}
