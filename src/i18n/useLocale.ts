import { useContext } from 'react'
import { LocaleContext, type LocaleContextValue } from './localeContext'

export function useLocale(): LocaleContextValue {
  const v = useContext(LocaleContext)
  if (!v) throw new Error('useLocale must be used within LocaleProvider')
  return v
}
