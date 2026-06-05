/** Категории «режима задач» (школьная неорганика): только данные для UI, без генераторов. */

export type LearnTaskCategoryGroup = 'quant' | 'qual'

export type LearnTaskCategoryDef = {
  id: string
  group: LearnTaskCategoryGroup
  titleKey: string
  whatKey: string
  exampleKey: string
  /** Привязка к классам UZ curriculum (g7, g8, g9). */
  gradeIds?: readonly ('g7' | 'g8' | 'g9')[]
}

export const LEARN_TASK_CATEGORIES: readonly LearnTaskCategoryDef[] = [
  {
    id: 'solutions',
    group: 'quant',
    titleKey: 'learn.tasks.solutions.title',
    whatKey: 'learn.tasks.solutions.what',
    exampleKey: 'learn.tasks.solutions.example',
    gradeIds: ['g7', 'g8', 'g9'],
  },
  {
    id: 'stoichiometry',
    group: 'quant',
    titleKey: 'learn.tasks.stoichiometry.title',
    whatKey: 'learn.tasks.stoichiometry.what',
    exampleKey: 'learn.tasks.stoichiometry.example',
    gradeIds: ['g8', 'g9'],
  },
  {
    id: 'limiting_reagent',
    group: 'quant',
    titleKey: 'learn.tasks.limiting_reagent.title',
    whatKey: 'learn.tasks.limiting_reagent.what',
    exampleKey: 'learn.tasks.limiting_reagent.example',
  },
  {
    id: 'yield_impurities',
    group: 'quant',
    titleKey: 'learn.tasks.yield_impurities.title',
    whatKey: 'learn.tasks.yield_impurities.what',
    exampleKey: 'learn.tasks.yield_impurities.example',
  },
  {
    id: 'metal_plate',
    group: 'quant',
    titleKey: 'learn.tasks.metal_plate.title',
    whatKey: 'learn.tasks.metal_plate.what',
    exampleKey: 'learn.tasks.metal_plate.example',
  },
  {
    id: 'electron_balance',
    group: 'qual',
    titleKey: 'learn.tasks.electron_balance.title',
    whatKey: 'learn.tasks.electron_balance.what',
    exampleKey: 'learn.tasks.electron_balance.example',
  },
  {
    id: 'ionic_equations',
    group: 'qual',
    titleKey: 'learn.tasks.ionic_equations.title',
    whatKey: 'learn.tasks.ionic_equations.what',
    exampleKey: 'learn.tasks.ionic_equations.example',
  },
  {
    id: 'transformation_chains',
    group: 'qual',
    titleKey: 'learn.tasks.transformation_chains.title',
    whatKey: 'learn.tasks.transformation_chains.what',
    exampleKey: 'learn.tasks.transformation_chains.example',
  },
  {
    id: 'qualitative_id',
    group: 'qual',
    titleKey: 'learn.tasks.qualitative_id.title',
    whatKey: 'learn.tasks.qualitative_id.what',
    exampleKey: 'learn.tasks.qualitative_id.example',
  },
  {
    id: 'oge_prep',
    group: 'quant',
    titleKey: 'learn.tasks.oge.title',
    whatKey: 'learn.tasks.oge.what',
    exampleKey: 'learn.tasks.oge.example',
    gradeIds: ['g8', 'g9'],
  },
] as const

export const LEARN_TASK_CATEGORY_IDS = new Set(LEARN_TASK_CATEGORIES.map((c) => c.id))
