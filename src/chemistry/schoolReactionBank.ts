import type { ReactionClass } from './reactionTypeTaxonomy'
import { defaultPassportForClass, type ReactionPassport } from './reactionPassport'
import { SCHOOL_REACTIONS_DATA } from '../data/curriculum/schoolReactionsData'
import type { ReactionReactant, SchoolReactionDef } from '../data/curriculum/schoolReactionTypes'
import { preferredSchoolReactionId } from './substanceSynthesisRoute'

export type { ReactionReactant, SchoolReactionDef }

export type SchoolReactionEntry = SchoolReactionDef & {
  /** @deprecated используйте passport.heatEffect */
  heatEffect?: 'exo' | 'endo'
  /** @deprecated используйте passport.reversibility */
  reversible?: boolean
}

export function passportForReaction(r: SchoolReactionEntry): ReactionPassport {
  const legacy = {
    heatEffect: r.heatEffect,
    reversibility: r.reversible ? ('reversible' as const) : undefined,
    catalytic: Boolean(r.catalystId) || r.reactionClass === 'catalytic',
    catalystId: r.catalystId,
  }
  return defaultPassportForClass(r.reactionClass, { ...legacy, ...r.passport })
}

/** Банк школьных реакций 7–9 кл. (Kimyo / ФГОС). */
export const SCHOOL_REACTION_BANK: readonly SchoolReactionEntry[] = SCHOOL_REACTIONS_DATA

export function reactionsByClass(reactionClass: ReactionClass): readonly SchoolReactionEntry[] {
  return SCHOOL_REACTION_BANK.filter((r) => r.reactionClass === reactionClass)
}

export function getSchoolReaction(id: string): SchoolReactionEntry | undefined {
  return SCHOOL_REACTION_BANK.find((r) => r.id === id)
}

export function reactionsByGrade(grade: 7 | 8 | 9): readonly SchoolReactionEntry[] {
  return SCHOOL_REACTION_BANK.filter((r) => r.grades.includes(grade))
}

export function synthesisReactions(): readonly SchoolReactionEntry[] {
  return SCHOOL_REACTION_BANK.filter((r) => r.kind === 'synthesis')
}

export function practiceReactions(): readonly SchoolReactionEntry[] {
  return SCHOOL_REACTION_BANK.filter((r) => r.kind === 'practice_only')
}

/** Предпочтительная школьная реакция для карточки вещества (VIP → productId банка). */
export function primaryReactionForCompound(compoundId: string): SchoolReactionEntry | undefined {
  const id = preferredSchoolReactionId(compoundId)
  return id ? getSchoolReaction(id) : undefined
}

/** Все реакции банка, где вещество — продукт или участник. */
export function reactionsForCompound(compoundId: string): readonly SchoolReactionEntry[] {
  return SCHOOL_REACTION_BANK.filter(
    (r) => r.productId === compoundId || r.compoundIds.includes(compoundId),
  )
}
