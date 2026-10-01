/** Тип основной реакции (школьная классификация; одна группа на реакцию). */
export type MainReactionType =
  | 'combination'
  | 'decomposition'
  | 'substitution'
  | 'exchange'
  | 'neutralization'
  | 'combustion'
  | 'redox'

export const MAIN_REACTION_TYPE_ORDER: readonly MainReactionType[] = [
  'combination',
  'decomposition',
  'substitution',
  'exchange',
  'neutralization',
  'combustion',
  'redox',
]

/** Одна из 200 основных реакций (src/data/catalog/mainReactions200.ts). */
export type MainReaction = {
  /** mr001 … mr200 */
  id: string
  /** Уравнение с целыми коэффициентами (Unicode) — эталон, к которому приходит ученик. */
  equation: string
  type: MainReactionType
  /** Меняются степени окисления (ОВР) — по расчёту степеней окисления всех веществ. */
  redox: boolean
  /** Качественная реакция на ион (осадок / газ — признак иона). */
  qualitative?: string
  /** Условия в реакторе: нагрев, давление, катализатор — для ЭТОЙ реакции. */
  lab: { heat?: true; pressure?: true; catalyst?: string }
  /** Классы, где реакция встречается в учебниках (и банке). */
  grades: readonly number[]
  /** Главный продукт (id каталога) — фокус реактора. */
  main: string
  /** Вещества: id каталога и простые вещества («Na», «Cl₂»). */
  species: readonly string[]
  bankId?: string
  titleRu?: string
  /** Первое место в учебниках. */
  book?: { grade: number; page: number | null; unitId: string; rxId: string }
  /** Условия над стрелкой, как записаны в источнике. */
  conditions?: string
}
