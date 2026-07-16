/** Язык ответов ИИ-учителя (совпадает с UI locale). */
export type AssistantLocale = 'ru' | 'en' | 'uz'

export function isAssistantRu(locale: AssistantLocale): boolean {
  return locale === 'ru'
}

/**
 * Язык фрагментов учебника/FAQ в базе (узбекского корпуса пока нет).
 * Для EN/UZ отдаём английский текст — модель переводит в язык UI.
 */
export function knowledgeSourceLocale(locale: AssistantLocale): 'ru' | 'en' {
  return locale === 'ru' ? 'ru' : 'en'
}

export function pickFaqText(faq: { ru: string; en: string }, locale: AssistantLocale): string {
  return knowledgeSourceLocale(locale) === 'en' ? faq.en : faq.ru
}
