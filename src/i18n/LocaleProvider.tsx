import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LocaleContext } from './localeContext'
import type { AppLocale } from './types'
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY } from './types'

function readStoredLocale(): AppLocale {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (raw === 'en' || raw === 'ru' || raw === 'uz') return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE
}

const LOCALE_CYCLE: AppLocale[] = ['ru', 'en', 'uz']

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() =>
    typeof window !== 'undefined' ? readStoredLocale() : DEFAULT_LOCALE,
  )

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  const toggleLocale = useCallback(() => {
    const idx = LOCALE_CYCLE.indexOf(locale)
    const next = LOCALE_CYCLE[(idx + 1) % LOCALE_CYCLE.length] ?? 'ru'
    setLocale(next)
  }, [locale, setLocale])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      toggleLocale,
    }),
    [locale, setLocale, toggleLocale],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}
