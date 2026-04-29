import type { CompoundDef } from '../types/chemistry'
import type { LabParticle } from '../types/chemistry'
import { compoundById } from '../data/compounds'
import { getElementByZ } from '../data/elements'
import { REACTOR_SLOT_COUNT } from './reactorSlots'

/** Состав по символам из выбранных частиц. */
export function aggregateComposition(
  particles: readonly LabParticle[],
  ids: readonly string[],
): Record<string, number> | null {
  const counts: Record<string, number> = {}
  for (const id of ids) {
    const p = particles.find((x) => x.id === id)
    if (!p) return null
    if (p.type === 'atom') {
      counts[p.symbol] = (counts[p.symbol] ?? 0) + 1
    } else {
      const c = compoundById[p.compoundId]
      if (!c) return null
      for (const [sym, n] of Object.entries(c.composition)) {
        counts[sym] = (counts[sym] ?? 0) + n
      }
    }
  }
  return counts
}

function compositionKey(counts: Record<string, number>): string {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => `${k}:${n}`)
    .join('|')
}

export function findCompoundByExactComposition(
  counts: Record<string, number>,
  ordered: readonly CompoundDef[],
): CompoundDef | undefined {
  const key = compositionKey(counts)
  for (const c of ordered) {
    if (compositionKey(c.composition) === key) return c
  }
  return undefined
}

function totalAtomsInComposition(counts: Record<string, number>): number {
  return Object.values(counts).reduce((a, b) => a + b, 0)
}

function sameElementSet(a: Record<string, number>, b: Record<string, number>): boolean {
  const ak = Object.keys(a).filter((k) => (a[k] ?? 0) > 0).sort()
  const bk = Object.keys(b).filter((k) => (b[k] ?? 0) > 0).sort()
  if (ak.length !== bk.length) return false
  for (let i = 0; i < ak.length; i++) {
    if (ak[i] !== bk[i]) return false
  }
  return true
}

function canAutofillToCandidate(
  selected: Record<string, number>,
  candidate: Record<string, number>,
): boolean {
  if (!sameElementSet(selected, candidate)) return false
  for (const [k, nSel] of Object.entries(selected)) {
    if ((candidate[k] ?? 0) < nSel) return false
  }
  return true
}

function findCompoundByAutofillComposition(
  selectedCounts: Record<string, number>,
  ordered: readonly CompoundDef[],
): CompoundDef | undefined {
  // Ограничение по максимальному числу атомов в формуле для снижения «угадываний».
  // Реактор выбирает 2–4 слота; считаем, что итоговая формула должна быть в рамках этого.
  const maxAtoms = REACTOR_SLOT_COUNT
  const candidates: { c: CompoundDef; totalAtoms: number; excess: number }[] = []
  for (const c of ordered) {
    const candCounts = c.composition
    if (!canAutofillToCandidate(selectedCounts, candCounts)) continue
    const totalAtoms = totalAtomsInComposition(candCounts)
    if (totalAtoms > maxAtoms) continue
    let excess = 0
    for (const [k, nSel] of Object.entries(selectedCounts)) {
      excess += (candCounts[k] ?? 0) - nSel
    }
    candidates.push({ c, totalAtoms, excess })
  }
  if (candidates.length === 0) return undefined

  candidates.sort((a, b) => {
    if (a.totalAtoms !== b.totalAtoms) return a.totalAtoms - b.totalAtoms
    if (a.excess !== b.excess) return a.excess - b.excess
    return a.c.id.localeCompare(b.c.id)
  })

  const best = candidates[0]!
  const bestScore = `${best.totalAtoms}|${best.excess}`
  const tied = candidates.filter((x) => `${x.totalAtoms}|${x.excess}` === bestScore)
  if (tied.length !== 1) return undefined
  return best.c
}

/**
 * Состав: по всем **заполненным** ячейкам реактора (Z) считаем, сколько атомов каждого элемента.
 * Например, H, H, O → { H: 2, O: 1 } (вода); Na, Cl → { Na: 1, Cl: 1 }.
 */
export function compositionFromReactorSlotZs(
  filledSlotZs: readonly number[],
): Record<string, number> | null {
  if (filledSlotZs.length === 0) return null
  const counts: Record<string, number> = {}
  for (const z of filledSlotZs) {
    const e = getElementByZ(z)
    if (!e) return null
    const s = e.symbol
    counts[s] = (counts[s] ?? 0) + 1
  }
  return counts
}

/**
 * Подбор вещества в каталоге: состав из слотов должен **точно** совпасть с `composition` записи
 * (после дедупликации в `compounds.ts` каждая формула в каталоге встречается один раз).
 */
export type ReactorSlotMatchKind = 'exact' | 'auto' | 'none'

type LegacyReactorSlot = number | null
type CountedReactorSlot = { z: number; count: number } | null

function compositionFromReactorSlotsAny(
  slots: readonly (LegacyReactorSlot | CountedReactorSlot)[],
): Record<string, number> | null {
  const counts: Record<string, number> = {}
  let any = false
  for (const s of slots) {
    if (s == null) continue
    if (typeof s === 'number') {
      const e = getElementByZ(s)
      if (!e) return null
      counts[e.symbol] = (counts[e.symbol] ?? 0) + 1
      any = true
      continue
    }
    const c = Math.max(0, s.count | 0)
    if (c <= 0) continue
    const e = getElementByZ(s.z)
    if (!e) return null
    counts[e.symbol] = (counts[e.symbol] ?? 0) + c
    any = true
  }
  return any ? counts : null
}

export function findCompoundMatchByReactorSlots(
  slots: readonly (LegacyReactorSlot | CountedReactorSlot)[],
  ordered: readonly CompoundDef[],
): { compound: CompoundDef | undefined; kind: ReactorSlotMatchKind } {
  const counts = compositionFromReactorSlotsAny(slots)
  const totalAtoms = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0
  if (!counts || totalAtoms < 2) return { compound: undefined, kind: 'none' }
  if (!counts) return { compound: undefined, kind: 'none' }
  const exact = findCompoundByExactComposition(counts, ordered)
  if (exact) return { compound: exact, kind: 'exact' }
  const auto = findCompoundByAutofillComposition(counts, ordered)
  if (auto) return { compound: auto, kind: 'auto' }
  return { compound: undefined, kind: 'none' }
}

export function findCompoundByReactorSlots(
  slots: readonly (number | null)[],
  ordered: readonly CompoundDef[],
): CompoundDef | undefined {
  return findCompoundMatchByReactorSlots(slots, ordered).compound
}
