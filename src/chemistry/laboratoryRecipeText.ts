import type { RawCompoundDef } from '../types/chemistry'

function sortedComposition(comp: Record<string, number>): [string, number][] {
  return Object.entries(comp)
    .filter(([, v]) => v > 0)
    .sort(([a], [b]) => a.localeCompare(b))
}

/**
 * Один короткий учебный пример: слева реагенты (по атомам из формулы), справа вещество из каталога.
 * Не уравнение стадии горения, а схема «какой набор атомов соответствует формуле».
 */
export function buildDefaultLaboratoryRecipeRu(
  p: Pick<RawCompoundDef, 'composition' | 'formulaUnicode'>,
): string {
  const parts = sortedComposition(p.composition)
  const left = parts
    .map(([sym, n]) => (n === 1 ? sym : `${n}${sym}`))
    .join(' + ')
  return `${left} = ${p.formulaUnicode}`
}
