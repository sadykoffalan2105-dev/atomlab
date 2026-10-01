/**
 * Поиск по 200 основным реакциям: формула («NaCl», «na2so4», «H₂SO₄») или название вещества на языке интерфейса
 * и по-русски. Общий для каталога «Реакции» и выбора реакции в реакторе.
 */
import { useMemo } from 'react'
import { MAIN_REACTIONS_200, mainReactionSearchText, type MainReaction } from '../../data/catalog/mainReactions'
import { compoundById } from '../../data/compounds'
import { getCompoundLocaleStrings } from '../../i18n/compoundLocale'
import type { AppLocale } from '../../i18n/types'
import type { useT } from '../../i18n/useT'

type T = ReturnType<typeof useT>['t']

const SUB = '₀₁₂₃₄₅₆₇₈₉'
/** «H₂SO₄» → «h2so4», пробелы убраны: «na cl» не ищется, но «nacl» — да. */
export function normalizeReactionQuery(q: string): string {
  return q
    .trim()
    .toLowerCase()
    .replace(/[₀-₉]/g, (d) => String(SUB.indexOf(d)))
    .replace(/\s+/g, ' ')
}

/** Предикат поиска (пустой запрос — всё). */
export function useMainReactionSearch(query: string, locale: AppLocale, t: T): (r: MainReaction) => boolean {
  const blobs = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of MAIN_REACTIONS_200) {
      const names: string[] = []
      for (const id of r.species) {
        const c = compoundById[id]
        if (!c) continue
        names.push(c.nameRu, getCompoundLocaleStrings(c, locale, t).name)
      }
      const formulas = mainReactionSearchText(r)
      m.set(r.id, `${formulas} ${formulas.replace(/\s+/g, '')} ${names.join(' ')}`.toLowerCase())
    }
    return m
  }, [locale, t])
  const q = normalizeReactionQuery(query)
  return useMemo(() => {
    if (q.length === 0) return () => true
    const compact = q.replace(/\s+/g, '')
    return (r: MainReaction) => {
      const b = blobs.get(r.id) ?? ''
      return b.includes(q) || b.includes(compact)
    }
  }, [q, blobs])
}
