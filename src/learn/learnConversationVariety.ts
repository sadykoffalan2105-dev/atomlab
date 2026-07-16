/** Разнообразие формулировок — учитель не повторяет одни и те же фразы. */

import type { AssistantLocale } from './learnAssistantLocale'

function hashSeed(...parts: string[]): number {
  let h = 2166136261
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) {
      h ^= p.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
  }
  return Math.abs(h)
}

export function pickVariedItem<T>(list: readonly T[], seed: number, avoid?: T): T {
  if (list.length === 0) throw new Error('empty list')
  const filtered = avoid !== undefined ? list.filter((x) => x !== avoid) : list
  const pool = filtered.length > 0 ? filtered : list
  return pool[seed % pool.length]!
}

export function conversationSeed(query: string, sectionId: string, turnIndex: number): number {
  return hashSeed(query.toLowerCase(), sectionId, String(turnIndex))
}

const OPENERS_RU = [
  'Давайте разберёмся.',
  'Хороший вопрос.',
  'Сейчас объясню по учебнику.',
  'Вот что важно понять.',
  'Начнём с главного.',
  'Обратите внимание на следующее.',
  'Представьте, что мы на уроке.',
  'Из параграфа можно выделить такое.',
  'Если говорить простым языком,',
  'В учебнике это описано так.',
] as const

const OPENERS_EN = [
  'Good question.',
  'Let me explain from the textbook.',
  'Here is what matters.',
  'Think of it this way.',
  'From the lesson section:',
] as const

const OPENERS_UZ = [
  'Keling, tushunib olaylik.',
  'Yaxshi savol.',
  'Hozir darslik bo‘yicha tushuntiraman.',
  'Eng muhimi shu.',
  'Asosiydan boshlaymiz.',
  'Darsdagi kabi qaraylik.',
] as const

const CLOSERS_RU = [
  'Спросите, если нужен пример или задача по этой теме.',
  'Могу привести ещё один пример — просто напишите.',
  'Хотите проверить понимание — задайте вопрос своими словами.',
  'Если что-то осталось неясным — уточните, разберём точечно.',
  'Попробуйте пересказать это своими словами — так лучше запоминается.',
] as const

const CLOSERS_EN = [
  'Ask if you want another example or a practice problem.',
  'Try explaining it in your own words — that helps memory.',
  'Tell me what part is unclear and we will focus on it.',
] as const

const CLOSERS_UZ = [
  'Yana misol yoki masala kerak bo‘lsa — yozing.',
  'O‘z so‘zlaringiz bilan qayta aytib ko‘ring — shunda yaxshi esda qoladi.',
  'Nima noaniq qolganini yozing — shu joyini ochamiz.',
] as const

const BOOK_CASUAL_RU = [
  'Вот интересный фрагмент из учебника.',
  'Из книги возьму историю, которая цепляет.',
  'По учебнику есть любопытный рассказ — слушайте.',
  'Сейчас расскажу кусочек из параграфа, который часто нравится ученикам.',
] as const

const BOOK_CASUAL_UZ = [
  'Darslikdan qiziq parcha.',
  'Kitobdan o‘quvchilarga yoqadigan qismni aytaman.',
  'Paragrafdan qisqa hikoya — tinglang.',
] as const

/** @deprecated use pickOpenerForLocale */
export function pickOpener(ru: boolean, seed: number, bookCasual = false): string {
  return pickOpenerForLocale(ru ? 'ru' : 'en', seed, bookCasual)
}

export function pickOpenerForLocale(
  locale: AssistantLocale,
  seed: number,
  bookCasual = false,
): string {
  if (bookCasual && locale === 'ru') return pickVariedItem(BOOK_CASUAL_RU, seed)
  if (bookCasual && locale === 'uz') return pickVariedItem(BOOK_CASUAL_UZ, seed)
  const list = locale === 'uz' ? OPENERS_UZ : locale === 'en' ? OPENERS_EN : OPENERS_RU
  return pickVariedItem(list, seed)
}

/** @deprecated use pickCloserForLocale */
export function pickCloser(ru: boolean, seed: number, skipCloser: boolean): string | null {
  return pickCloserForLocale(ru ? 'ru' : 'en', seed, skipCloser)
}

export function pickCloserForLocale(
  locale: AssistantLocale,
  seed: number,
  skipCloser: boolean,
): string | null {
  if (skipCloser) return null
  const list = locale === 'uz' ? CLOSERS_UZ : locale === 'en' ? CLOSERS_EN : CLOSERS_RU
  return pickVariedItem(list, seed + 17)
}

export type QueryIntent = 'explain' | 'book_casual' | 'example' | 'definition' | 'recall' | 'quick'

export function detectQueryIntent(query: string): QueryIntent {
  const q = query.toLowerCase()

  if (/пример|из жизни|real[- ]?life|daily|example|hayotdan|misol/.test(q)) return 'example'
  if (
    /запомн|главн|итог|summary|key takeaway|что запомнить|eslab|nimani eslab|esda qol/.test(q)
  ) {
    return 'recall'
  }
  if (/что такое|what is|определени|define|nima (bu|ekan)/.test(q)) return 'definition'
  if (
    /расскаж|по книг|из книг|что[- ]?нибудь|что нибудь|интересн|tell me about|story|textbook|gapir|aytib ber/i.test(
      q,
    )
  ) {
    return 'book_casual'
  }
  if (
    /полност|подроб|объясни|explain|разъясн|раскрой|опиши|describe|по учебник|tushuntir|oddiyroq|bog'liqlik|bog‘liqlik|dars bilan/i.test(
      q,
    )
  ) {
    return 'explain'
  }
  return 'quick'
}

export function wantsFullAnswer(intent: QueryIntent): boolean {
  return intent === 'explain' || intent === 'book_casual' || intent === 'definition'
}
