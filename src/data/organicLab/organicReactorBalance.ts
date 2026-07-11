import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { compositionFromLeftTerms, compositionKey } from '../../chemistry/reactorEquationBalance'
import { compositionOf } from '../../chemistry/organic/organicGraph'
import type { OrganicMoleculeDef } from './organicMoleculeTypes'
import { ORGANIC_MOLECULES, organicMoleculeById } from './organicMoleculeRegistry'

const ORGANIC_Z = new Set([1, 6, 7, 8, 17])

export function isOrganicElementZ(z: number): boolean {
  return ORGANIC_Z.has(z)
}

export const ORGANIC_PALETTE: readonly { z: number; symbol: string; nameRu: string }[] = [
  { z: 6, symbol: 'C', nameRu: 'Углерод' },
  { z: 1, symbol: 'H', nameRu: 'Водород' },
  { z: 8, symbol: 'O', nameRu: 'Кислород' },
  { z: 7, symbol: 'N', nameRu: 'Азот' },
  { z: 17, symbol: 'Cl', nameRu: 'Хлор' },
]

function scaleComposition(comp: Record<string, number>, k: number): Record<string, number> {
  const out: Record<string, number> = {}
  const n = Math.max(0, Math.floor(k))
  if (n <= 0) return out
  for (const [sym, v] of Object.entries(comp)) {
    const t = Math.max(0, Math.floor(Number(v))) * n
    if (t > 0) out[sym] = t
  }
  return out
}

export function compositionFromOrganicProduct(
  mol: OrganicMoleculeDef,
  productCoeff: number,
): Record<string, number> {
  return scaleComposition(compositionOf(mol.graph), productCoeff)
}

export function isOrganicEquationBalanced(
  leftTerms: readonly ReactorEquationTerm[],
  mol: OrganicMoleculeDef | null | undefined,
  productCoeff: number,
): boolean {
  if (!mol || leftTerms.length < 1) return false
  const left = compositionFromLeftTerms(leftTerms)
  if (!left) return false
  const right = compositionFromOrganicProduct(mol, productCoeff)
  return compositionKey(left) === compositionKey(right)
}

/** Подобрать продукты по левой стороне × коэффициента продукта. */
export function matchOrganicProductsForEquation(
  leftTerms: readonly ReactorEquationTerm[],
  productCoeff: number,
): OrganicMoleculeDef[] {
  const left = compositionFromLeftTerms(leftTerms)
  if (!left) return []
  const k = Math.max(1, Math.floor(productCoeff))
  return ORGANIC_MOLECULES.filter((m) => {
    const one = compositionOf(m.graph)
    const scaled = scaleComposition(one, k)
    return compositionKey(left) === compositionKey(scaled)
  })
}

/** Сколько атомов каждого элемента нужно слева при данном коэффициенте продукта. */
export function targetLeftComposition(
  mol: OrganicMoleculeDef,
  productCoeff: number,
): Record<string, number> {
  return compositionFromOrganicProduct(mol, productCoeff)
}

/** Целевой коэффициент реагента-элемента (атомы слева = coeff × 1). */
export function targetCoeffForElement(
  mol: OrganicMoleculeDef,
  productCoeff: number,
  symbol: string,
): number {
  return targetLeftComposition(mol, productCoeff)[symbol] ?? 0
}

/**
 * Слева — все элементы из состава продукта с coeff=1.
 * Ученик поднимает коэффициенты до целевых (как в учебнике: □C + □H + □O = C₆H₁₂O₆).
 */
export function leftTermsFromOrganicMolecule(mol: OrganicMoleculeDef): ReactorEquationTerm[] {
  const comp = compositionOf(mol.graph)
  const terms: ReactorEquationTerm[] = []
  for (const row of ORGANIC_PALETTE) {
    const n = comp[row.symbol]
    if (!n || n <= 0) continue
    terms.push({
      id: crypto.randomUUID(),
      z: row.z,
      coeff: 1,
      diatomic: false,
    })
  }
  return terms
}

/** Добавить недостающие элементы продукта слева (не затирая уже введённые коэффициенты). */
export function mergeLeftTermsForOrganicProduct(
  prev: readonly ReactorEquationTerm[],
  mol: OrganicMoleculeDef,
): ReactorEquationTerm[] {
  const comp = compositionOf(mol.graph)
  const next = [...prev]
  for (const row of ORGANIC_PALETTE) {
    const n = comp[row.symbol]
    if (!n || n <= 0) continue
    const exists = next.some((t) => t.z === row.z && !t.diatomic)
    if (!exists) {
      next.push({ id: crypto.randomUUID(), z: row.z, coeff: 1, diatomic: false })
    }
  }
  return next
}

export function organicProductById(id: string | null): OrganicMoleculeDef | null {
  if (!id) return null
  return organicMoleculeById[id] ?? null
}
