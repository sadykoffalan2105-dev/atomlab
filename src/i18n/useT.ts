import { useCallback, useMemo } from 'react'
import { interpolate } from './interpolate'
import { messagesForLocale } from './messagesForLocale'
import { messagesRu, type MessageKey } from './messagesRu'
import { useLocale } from './useLocale'

export type { MessageKey }

export function useT(): {
  locale: import('./types').AppLocale
  t: (key: MessageKey, params?: Readonly<Record<string, string | number>>) => string
} {
  const { locale } = useLocale()

  const table = useMemo(() => messagesForLocale(locale), [locale])

  const t = useCallback(
    (key: MessageKey, params?: Readonly<Record<string, string | number>>) => {
      const raw = table[key] ?? messagesRu[key] ?? key
      return interpolate(raw, params)
    },
    [table],
  )

  return { locale, t }
}
