import type { LearnHubIconName } from './LearnHubIcon'

/** Палитра карточек: пары градиентов классов из learnTheme.css (--lt-g7-a … --lt-g11-b). */
export const LEARN_HUB_TONES = ['g7', 'g8', 'g9', 'g10', 'g11'] as const
export type LearnHubTone = (typeof LEARN_HUB_TONES)[number]

export function learnHubToneStyle(tone: LearnHubTone): Record<string, string> {
  return {
    '--card-a': `var(--lt-${tone}-a)`,
    '--card-b': `var(--lt-${tone}-b)`,
  }
}

const TASK_CATEGORY_ICON: Record<string, LearnHubIconName> = {
  solutions: 'beaker',
  stoichiometry: 'scale',
  limiting_reagent: 'funnel',
  yield_impurities: 'percent',
  metal_plate: 'layers',
  formulas: 'hexagon',
  electron_balance: 'bolt',
  ionic_equations: 'ions',
  transformation_chains: 'chain',
  qualitative_id: 'search',
  oge_prep: 'target',
}

const TASK_CATEGORY_TONE: Record<string, LearnHubTone> = {
  solutions: 'g7',
  stoichiometry: 'g8',
  limiting_reagent: 'g9',
  yield_impurities: 'g10',
  metal_plate: 'g11',
  formulas: 'g10',
  electron_balance: 'g9',
  ionic_equations: 'g7',
  transformation_chains: 'g8',
  qualitative_id: 'g11',
  oge_prep: 'g8',
}

export function taskCategoryIcon(id: string): LearnHubIconName {
  return TASK_CATEGORY_ICON[id] ?? 'flask'
}

export function taskCategoryTone(id: string): LearnHubTone {
  return TASK_CATEGORY_TONE[id] ?? 'g7'
}

export function gradeTone(gradeId: string): LearnHubTone {
  return (LEARN_HUB_TONES as readonly string[]).includes(gradeId) ? (gradeId as LearnHubTone) : 'g7'
}
