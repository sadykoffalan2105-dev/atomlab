import { compositionsEqual } from '../../chemistry/organic/organicGraph'
import {
  ORGANIC_MOLECULES,
  organicMoleculeById,
} from '../../data/organicLab/organicMoleculeRegistry'
import type { OrganicMoleculeDef } from '../../data/organicLab/organicMoleculeTypes'

export type AtomBag = Readonly<Partial<Record<'C' | 'H' | 'O' | 'N' | 'Cl', number>>>

function normalizeBag(bag: AtomBag): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(bag)) {
    if (v && v > 0) out[k] = v
  }
  return out
}

/** Найти органические молекулы по составу атомов (изомеры → несколько). */
export function matchOrganicByComposition(bag: AtomBag): OrganicMoleculeDef[] {
  const target = normalizeBag(bag)
  if (Object.keys(target).length === 0) return []
  return ORGANIC_MOLECULES.filter((m) => {
    const comp: Record<string, number> = {}
    for (const a of m.graph.atoms) {
      comp[a.element] = (comp[a.element] ?? 0) + 1
    }
    return compositionsEqual(comp, target)
  })
}

export function organicMoleculeOrNull(id: string): OrganicMoleculeDef | null {
  return organicMoleculeById[id] ?? null
}

/** Подпись набора атомов: C₃H₈ */
export function bagFormulaUnicode(bag: AtomBag): string {
  const order = ['C', 'H', 'O', 'N', 'Cl'] as const
  const sub = (n: number) =>
    String(n)
      .split('')
      .map((d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)] ?? d)
      .join('')
  let s = ''
  for (const el of order) {
    const n = bag[el]
    if (!n) continue
    s += el + (n > 1 ? sub(n) : '')
  }
  return s || '—'
}
