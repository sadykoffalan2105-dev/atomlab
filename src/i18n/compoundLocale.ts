import { defaultSynthesisConditionsText, defaultSynthesisConditionsTextForLocale } from '../chemistry/synthesisConditionsDefaults'
import type { CompoundDef } from '../types/chemistry'
import type { AppLocale } from './types'
import { COMPOUND_EN_OVERLAY } from './compoundEnOverlay'
import type { MessageKey } from './messagesRu'

export type CompoundLocaleStrings = {
  name: string
  description: string
  laboratoryRecipe: string
  synthesisConditions: {
    temperature?: string
    pressure?: string
    catalyst?: string
  }
}

type TFn = (key: MessageKey, params?: Readonly<Record<string, string | number>>) => string

function categoryFallbackKey(category: CompoundDef['category']): MessageKey {
  const m: Record<CompoundDef['category'], MessageKey> = {
    oxide: 'catalog.category.oxide',
    acid: 'catalog.category.acid',
    base: 'catalog.category.base',
    salt: 'catalog.category.salt',
    other: 'catalog.category.other',
  }
  return m[category] ?? 'catalog.category.other'
}

export function getCompoundLocaleStrings(c: CompoundDef, locale: AppLocale, t: TFn): CompoundLocaleStrings {
  if (locale === 'ru') {
    return {
      name: c.nameRu,
      description: c.descriptionRu,
      laboratoryRecipe: c.laboratoryRecipeRu,
      synthesisConditions: { ...c.synthesisConditionsRu },
    }
  }

  const ov = COMPOUND_EN_OVERLAY[c.id]
  const catLabel = t(categoryFallbackKey(c.category))
  const name = ov?.nameEn ?? c.formulaUnicode
  const description =
    ov?.descriptionEn ??
    t('catalog.fallbackDescription', { formula: c.formulaUnicode, category: catLabel })

  const ruD = defaultSynthesisConditionsText(c.synthesisLab, c.category)
  const enD = defaultSynthesisConditionsTextForLocale(c.synthesisLab, c.category, 'en')
  const cur = c.synthesisConditionsRu

  const pick = (k: 'temperature' | 'pressure' | 'catalyst'): string | undefined => {
    const v = cur[k]
    const ruV = ruD[k]
    const enV = enD[k]
    if (v === undefined || v === '') return enV
    if (v === ruV) return enV
    return v
  }

  return {
    name,
    description,
    laboratoryRecipe: c.laboratoryRecipeRu,
    synthesisConditions: {
      temperature: pick('temperature'),
      pressure: pick('pressure'),
      catalyst: pick('catalyst'),
    },
  }
}

/** Строка для поиска по каталогу (нижний регистр не нужен — вызывающий сам toLowerCase). */
export function compoundSearchBlob(c: CompoundDef, locale: AppLocale, t: TFn): string {
  const loc = getCompoundLocaleStrings(c, locale, t)
  return `${loc.name} ${loc.description} ${c.formulaUnicode} ${c.id} ${c.nameRu}`
}
