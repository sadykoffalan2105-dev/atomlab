import type { CompoundCategory } from '../../types/chemistry'

/** Лёгкий индекс каталога для VR picker (без atoms/bonds). */
export type VrLabCatalogEntry = {
  id: string
  nameRu: string
  formulaUnicode: string
  category: CompoundCategory
  accentColor: string
}

let indexPromise: Promise<VrLabCatalogEntry[]> | null = null
let indexCache: VrLabCatalogEntry[] | null = null

/** Асинхронная загрузка индекса — отдельный chunk от тяжёлой геометрии. */
export async function loadVrLabCatalogIndex(): Promise<VrLabCatalogEntry[]> {
  if (indexCache) return indexCache
  if (!indexPromise) {
    indexPromise = import('../../data/compounds').then(({ compoundsListAlphabeticalRu }) => {
      indexCache = compoundsListAlphabeticalRu().map((c) => ({
        id: c.id,
        nameRu: c.nameRu,
        formulaUnicode: c.formulaUnicode,
        category: c.category,
        accentColor: c.accentColor,
      }))
      return indexCache
    })
  }
  return indexPromise
}

export function getVrLabCatalogIndexSync(): VrLabCatalogEntry[] | null {
  return indexCache
}

export function filterCatalogIndex(
  entries: VrLabCatalogEntry[],
  query: string,
  starterOnly: boolean,
  starterSet: Set<string>,
): VrLabCatalogEntry[] {
  let list = starterOnly ? entries.filter((c) => starterSet.has(c.id)) : entries
  const q = query.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (c) =>
        c.id.includes(q) ||
        c.formulaUnicode.toLowerCase().includes(q) ||
        c.nameRu.toLowerCase().includes(q),
    )
  }
  return list
}
