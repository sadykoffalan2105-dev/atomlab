import { messagesEn } from './messagesEn'
import { messagesRu } from './messagesRu'
import type { AppLocale } from './types'

export function messagesForLocale(locale: AppLocale): Record<string, string> {
  if (locale === 'en') return messagesEn
  return messagesRu
}
