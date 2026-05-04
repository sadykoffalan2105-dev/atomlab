import type { CompoundCategory, CompoundDef } from '../types/chemistry'

/** Поиск и фильтр для панели каталога в реакторе (и при желании — общий список). */
export function filterCompoundsForCatalog(
  compounds: readonly CompoundDef[],
  query: string,
  category: CompoundCategory | 'all',
): readonly CompoundDef[] {
  const s = query.trim().toLowerCase()
  let list = compounds
  if (category !== 'all') {
    list = list.filter((c) => c.category === category)
  }
  if (!s) return list
  return list.filter(
    (c) =>
      c.nameRu.toLowerCase().includes(s) ||
      c.formulaUnicode.toLowerCase().includes(s) ||
      c.id.toLowerCase().includes(s),
  )
}
