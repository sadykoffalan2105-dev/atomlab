import { compoundById, compoundsListAlphabeticalRu } from '../compounds'
import type { CompoundDef } from '../../types/chemistry'

/** Все вещества каталога для режима «структура молекулы». */
export const MOLECULE_GAME_COMPOUNDS: readonly CompoundDef[] = compoundsListAlphabeticalRu()

export function getMoleculeGameCompound(id: string): CompoundDef | undefined {
  return compoundById[id]
}

export function shuffleArray<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

const SECONDARY_ELEMENTS = new Set(['H', 'O', 'N', 'C', 'S', 'P', 'F', 'Cl', 'Br', 'I'])

function compositionKeys(comp: CompoundDef): string[] {
  return Object.keys(comp.composition).filter((k) => (comp.composition[k] ?? 0) > 0)
}

function primaryElements(comp: CompoundDef): string[] {
  const keys = compositionKeys(comp)
  const heavy = keys.filter((k) => !SECONDARY_ELEMENTS.has(k))
  return heavy.length > 0 ? heavy : keys
}

function sharesPrimaryElement(a: CompoundDef, b: CompoundDef): boolean {
  const aPrim = new Set(primaryElements(a))
  return primaryElements(b).some((el) => aPrim.has(el))
}

function sharedElementCount(a: CompoundDef, b: CompoundDef): number {
  const bKeys = new Set(compositionKeys(b))
  return compositionKeys(a).filter((k) => bKeys.has(k)).length
}

/** Похожие вещества: общий металл/анион + по возможности та же категория. */
export function pickMoleculeQuizDistractors(correctId: string, count = 3): CompoundDef[] {
  const correct = compoundById[correctId]
  if (!correct) return []

  const withPrimary = MOLECULE_GAME_COMPOUNDS.filter(
    (c) => c.id !== correctId && sharesPrimaryElement(c, correct),
  )
  const sameCatAndPrimary = withPrimary.filter((c) => c.category === correct.category)
  const multiShared = withPrimary.filter((c) => sharedElementCount(c, correct) >= 2)

  let pool = sameCatAndPrimary.length >= count ? sameCatAndPrimary : withPrimary
  if (pool.length < count && multiShared.length >= count) pool = multiShared

  if (pool.length < count) {
    const sameCat = MOLECULE_GAME_COMPOUNDS.filter(
      (c) => c.id !== correctId && c.category === correct.category,
    )
    if (sameCat.length >= count) pool = sameCat
  }

  if (pool.length < count) {
    pool = MOLECULE_GAME_COMPOUNDS.filter((c) => c.id !== correctId)
  }

  return shuffleArray(pool).slice(0, count)
}

/** Случайная молекула; excludeId — не повторять предыдущую. */
export function pickRandomMolecule(excludeId?: string): CompoundDef {
  const pool = excludeId
    ? MOLECULE_GAME_COMPOUNDS.filter((c) => c.id !== excludeId)
    : MOLECULE_GAME_COMPOUNDS
  if (pool.length === 0) return MOLECULE_GAME_COMPOUNDS[0]!
  return pool[Math.floor(Math.random() * pool.length)]!
}

export function formatComposition(comp: Record<string, number>): string {
  return Object.entries(comp)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sym, n]) => (n === 1 ? sym : `${sym}${n}`))
    .join(' + ')
}

export function atomCount(compound: CompoundDef): number {
  return compound.atoms.length
}

export function bondCount(compound: CompoundDef): number {
  return compound.bonds.length
}
