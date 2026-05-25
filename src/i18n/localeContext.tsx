import { createContext } from 'react'
import type { AppLocale } from './types'

export type LocaleContextValue = {
  locale: AppLocale
  setLocale: (next: AppLocale) => void
  toggleLocale: () => void
}

export const LocaleContext = createContext<LocaleContextValue | null>(null)
