import type { AppLocale } from '../i18n/types'
import type { ElementViewModel } from '../types/chemistry'
import { ELEMENT_NAMES_EN } from './elementNamesEn'

export function elementDisplayName(el: ElementViewModel, locale: AppLocale): string {
  if (locale === 'en') {
    return ELEMENT_NAMES_EN[el.z - 1] ?? el.symbol
  }
  return el.nameRu
}
