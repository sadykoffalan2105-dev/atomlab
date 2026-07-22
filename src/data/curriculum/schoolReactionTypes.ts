import type { ReactionPassport } from '../../chemistry/reactionPassport'
import type { ReactionClass } from '../../chemistry/reactionTypeTaxonomy'
import type { BalanceLessonKind } from '../../chemistry/balanceLessonBank'

/** Реагент в 3D: атом (элемент) или готовая молекула из каталога. */
export type ReactionReactant =
  | { kind: 'element'; z: number; coeff: number; diatomic?: boolean }
  | { kind: 'compound'; compoundId: string; coeff: number }

export type SchoolReactionDef = {
  id: string
  /** Краткое название реакции для каталога и реактора */
  titleRu: string
  titleEn: string
  reactionClass: ReactionClass
  grades: readonly (7 | 8 | 9)[]
  equationRu: string
  equationEn: string
  productId: string | null
  kind: BalanceLessonKind
  /** Все вещества каталога, участвующие в реакции */
  compoundIds: readonly string[]
  /** Левая часть для 3D: атом + молекула, молекула + молекула */
  reactants: readonly ReactionReactant[]
  howToRu: string
  howToEn: string
  passport?: Partial<ReactionPassport>
  catalystId?: string
}
