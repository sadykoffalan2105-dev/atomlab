import { messagesEn } from './messagesEn'
import { messagesRu } from './messagesRu'
import { messagesUz } from './messagesUz'
import type { AppLocale } from './types'

export function messagesForLocale(locale: AppLocale): Record<string, string> {
  if (locale === 'en') return messagesEn
  if (locale === 'uz') return messagesUz
  return messagesRu
}
