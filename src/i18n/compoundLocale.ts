import { defaultSynthesisConditionsText, defaultSynthesisConditionsTextForLocale } from '../chemistry/synthesisConditionsDefaults'
import type { CompoundDef } from '../types/chemistry'
import type { AppLocale } from './types'
import { resolveCompoundDescription } from './compoundDescriptionResolver'
import { resolveCompoundName } from './compoundNameResolver'
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

function localizedSynthesisConditions(
  c: CompoundDef,
  locale: AppLocale,
): CompoundLocaleStrings['synthesisConditions'] {
  const ruD = defaultSynthesisConditionsText(c.synthesisLab, c.category)
  const locD = defaultSynthesisConditionsTextForLocale(c.synthesisLab, c.category, locale)
  const cur = c.synthesisConditionsRu

  const pick = (k: 'temperature' | 'pressure' | 'catalyst'): string | undefined => {
    const v = cur[k]
    const ruV = ruD[k]
    const locV = locD[k]
    if (v === undefined || v === '') return locV
    if (locale !== 'ru' && v === ruV) return locV
    if (locale === 'ru') return v
    return locV
  }

  return {
    temperature: pick('temperature'),
    pressure: pick('pressure'),
    catalyst: pick('catalyst'),
  }
}

export function getCompoundLocaleStrings(c: CompoundDef, locale: AppLocale, t: TFn): CompoundLocaleStrings {
  if (locale === 'ru') {
    return {
      name: c.nameRu,
      description: c.descriptionRu,
      laboratoryRecipe: c.laboratoryRecipeRu,
      synthesisConditions: localizedSynthesisConditions(c, locale),
    }
  }

  const catLabel = t(categoryFallbackKey(c.category))
  const resolvedName = resolveCompoundName(c.id, locale)
  const name = resolvedName ?? c.formulaUnicode
  const description = resolveCompoundDescription(
    c.id,
    c.category,
    locale,
    (formula, category) => t('catalog.fallbackDescription', { formula, category }),
    c.formulaUnicode,
    catLabel,
  )

  return {
    name,
    description,
    laboratoryRecipe: c.laboratoryRecipeRu,
    synthesisConditions: localizedSynthesisConditions(c, locale),
  }
}

/** Строка для поиска по каталогу (нижний регистр не нужен — вызывающий сам toLowerCase). */
export function compoundSearchBlob(c: CompoundDef, locale: AppLocale, t: TFn): string {
  const loc = getCompoundLocaleStrings(c, locale, t)
  return `${loc.name} ${loc.description} ${c.formulaUnicode} ${c.id} ${c.nameRu}`
}
