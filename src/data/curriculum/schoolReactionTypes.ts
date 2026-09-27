import type { ReactionPassport } from '../../chemistry/reactionPassport'
import type { ReactionClass } from '../../chemistry/reactionTypeTaxonomy'
import type { BalanceLessonKind } from '../../chemistry/balanceLessonBank'
import type { SynthesisLabConditions } from '../../types/chemistry'

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
  /**
   * Условия реактора (нагрев / давление / катализатор) для ЭТОЙ реакции, если они не такие, как у
   * синтеза продукта в данных вещества: HNO₃ в каталоге — процесс Оствальда (нагрев, давление, Pt–Rh),
   * а N₂O₅ + H₂O → 2HNO₃ идёт без условий. Читает effectiveLabNeeds (lab/reactionLabNeeds.ts).
   */
  labNeeds?: SynthesisLabConditions
}
