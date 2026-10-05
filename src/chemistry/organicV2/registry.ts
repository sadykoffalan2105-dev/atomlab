/**
 * Сопоставление собранного скелета с молекулой реестра по канонической строке:
 * совпало → UI берёт точные координаты RDKit (src/data/organicV2/molecules.json), иначе — embed3D.
 */
import type { OV2Molecule } from '../../data/organicV2/types'
import { canonicalizeMol } from './canonical'
import { perceiveCisTrans, toMol, type BondOrder, type SkeletonGraph } from './graph'
import { parseSmiles } from './smiles'

/**
 * Молекула контракта (все H нарисованы явно) → SkeletonGraph: у тяжёлых атомов h: 0, заряды из `ch`,
 * цис/транс — из `ez` связи (E/Z по CIP приближённо = транс/цис главных заместителей) или по 3D-координатам.
 */
export function skeletonFromOV2(m: Pick<OV2Molecule, 'atoms' | 'bonds'>): SkeletonGraph {
  const g: SkeletonGraph = {
    atoms: m.atoms.map((a) => (a.el === 'H' ? { el: 'H' } : { el: a.el, h: 0, ...(a.ch ? { charge: a.ch } : {}) })),
    bonds: m.bonds.map((b) => ({ a: b.a, b: b.b, o: b.o as BondOrder })),
  }
  return perceiveCisTrans(g, m.atoms.map((a) => a.p))
}

export interface RegistryIndex {
  /** канонический код с цис/транс → id */
  readonly exact: ReadonlyMap<string, string>
  /** код без цис/транс → id (первый по порядку) */
  readonly constitution: ReadonlyMap<string, string>
}

/** Ключи сопоставления: код со стереохимией и без. */
export function matchKeys(g: SkeletonGraph): { exact: string; constitution: string } {
  const m = toMol(g)
  return { exact: canonicalizeMol(m).smiles, constitution: canonicalizeMol({ ...m, stereo: new Map() }).smiles }
}

/**
 * Индекс реестра. Источник — молекулы контракта (`atoms`/`bonds` с явными H) или пары id + SMILES.
 * Строится один раз (≈ 329 молекул — несколько десятков мс).
 */
export function buildRegistryIndex(items: Iterable<{ readonly id: string } & ({ readonly smiles: string } | Pick<OV2Molecule, 'atoms' | 'bonds'>)>): RegistryIndex {
  const exact = new Map<string, string>(), constitution = new Map<string, string>()
  for (const it of items) {
    let g: SkeletonGraph
    try { g = 'atoms' in it ? skeletonFromOV2(it) : parseSmiles(it.smiles) } catch { continue }
    const k = matchKeys(g)
    if (!exact.has(k.exact)) exact.set(k.exact, it.id)
    if (!constitution.has(k.constitution)) constitution.set(k.constitution, it.id)
  }
  return { exact, constitution }
}

/**
 * id молекулы реестра для собранного скелета или null.
 * `exact: false` — совпал только структурный граф (например, цис/транс не задан или другой).
 */
export function matchRegistry(g: SkeletonGraph, index: RegistryIndex): { id: string; exact: boolean } | null {
  const k = matchKeys(g)
  const e = index.exact.get(k.exact)
  if (e) return { id: e, exact: true }
  const c = index.constitution.get(k.constitution)
  return c ? { id: c, exact: false } : null
}
