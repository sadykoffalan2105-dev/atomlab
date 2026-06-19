import type { VrLabShelfFlask } from './types'
import { findCuratedReaction } from './reactions/curatedReactions'
import { mixVrLabSubstances } from './mixEngine'
import { VAT_POSITION } from './vrLabShelfLayout'

export type AutoMixPlan =
  | { kind: 'pourSecond'; flaskId: string; compoundA: string; compoundB: string }
  | { kind: 'pourBoth'; flaskAId: string; flaskBId: string; compoundA: string; compoundB: string }
  | { kind: 'pourFirst'; flaskId: string; compoundA: string; compoundB: string; waitFlaskId: string }
  | null

/** Находит план автоматического смешивания для двух реагентов. */
export function resolveAutoMixPlan(
  flasks: VrLabShelfFlask[],
  vatReagentA: { compoundId: string } | null,
  selectedFlaskId: string | null,
): AutoMixPlan {
  if (vatReagentA) {
    const selected = selectedFlaskId ? flasks.find((f) => f.id === selectedFlaskId) : null
    const candidates = selected?.content
      ? [selected]
      : flasks.filter((f) => f.content && f.content.compoundId !== vatReagentA.compoundId)

    for (const flask of candidates) {
      if (!flask.content) continue
      const mix = mixVrLabSubstances(vatReagentA.compoundId, flask.content.compoundId)
      if (mix.kind === 'reaction') {
        return {
          kind: 'pourSecond',
          flaskId: flask.id,
          compoundA: vatReagentA.compoundId,
          compoundB: flask.content.compoundId,
        }
      }
    }
    return null
  }

  const filled = flasks.filter((f) => f.content)
  for (let i = 0; i < filled.length; i++) {
    for (let j = i + 1; j < filled.length; j++) {
      const fa = filled[i]!
      const fb = filled[j]!
      const idA = fa.content!.compoundId
      const idB = fb.content!.compoundId
      if (findCuratedReaction(idA, idB) || mixVrLabSubstances(idA, idB).kind === 'reaction') {
        return {
          kind: 'pourBoth',
          flaskAId: fa.id,
          flaskBId: fb.id,
          compoundA: idA,
          compoundB: idB,
        }
      }
    }
  }

  if (selectedFlaskId) {
    const sel = flasks.find((f) => f.id === selectedFlaskId)
    if (sel?.content) {
      for (const other of filled) {
        if (other.id === sel.id || !other.content) continue
        const mix = mixVrLabSubstances(sel.content.compoundId, other.content.compoundId)
        if (mix.kind === 'reaction') {
          return {
            kind: 'pourBoth',
            flaskAId: sel.id,
            flaskBId: other.id,
            compoundA: sel.content.compoundId,
            compoundB: other.content.compoundId,
          }
        }
      }
    }
  }

  return null
}

export function canAutoMix(
  flasks: VrLabShelfFlask[],
  vatReagentA: { compoundId: string } | null,
  selectedFlaskId: string | null,
  busy: boolean,
): boolean {
  if (busy) return false
  return resolveAutoMixPlan(flasks, vatReagentA, selectedFlaskId) != null
}

/** Позиция колбы над чаном для кинематографичного налива. */
export function autoMixPourPosition(): [number, number, number] {
  return [VAT_POSITION[0] + 0.06, VAT_POSITION[1] + 0.14, VAT_POSITION[2] + 0.04]
}
