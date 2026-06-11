import type { AppLocale } from './types'

/** Голос/распознавание: uz → uz (uz-UZ), при отсутствии голоса fallback в learnSpeech. */
export type SpeechLocale = 'ru' | 'en' | 'uz'

export function speechLocaleFromApp(locale: AppLocale): SpeechLocale {
  if (locale === 'en') return 'en'
  if (locale === 'uz') return 'uz'
  return 'ru'
}

export function assistantLanguageName(locale: AppLocale): string {
  if (locale === 'en') return 'English'
  if (locale === 'uz') return 'Uzbek (Latin script)'
  return 'Russian'
}
