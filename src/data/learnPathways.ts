import type { LearnPathwayDef } from '../types/learnPathway'

export const LEARN_PATHWAY_STEPS_ORDER = [
  'context',
  'predictions',
  'materials',
  'protocol',
  'results',
  'reflection',
  'summary',
] as const

/** Первый полный pathway: синтез воды. */
export const PATHWAY_H2O_SYNTHESIS: LearnPathwayDef = {
  id: 'h2o-synthesis',
  titleKey: 'learn.pathway.h2o.title',
  leadKey: 'learn.pathway.h2o.lead',
  accentColor: '#5ad8ff',
  gradeId: 'g7',
  chapterId: 'c1',
  sectionId: 's01',
  productCompoundId: 'h2o',
  equationUnicode: '2H₂ + O₂ → 2H₂O',
  estimatedMin: 18,
  steps: [
    { id: 'context', taskCount: 1, titleKey: 'learn.pathway.step.context' },
    { id: 'predictions', taskCount: 2, titleKey: 'learn.pathway.step.predictions' },
    { id: 'materials', taskCount: 1, titleKey: 'learn.pathway.step.materials' },
    { id: 'protocol', taskCount: 3, titleKey: 'learn.pathway.step.protocol' },
    { id: 'results', taskCount: 1, titleKey: 'learn.pathway.step.results' },
    { id: 'reflection', taskCount: 2, titleKey: 'learn.pathway.step.reflection' },
    { id: 'summary', taskCount: 1, titleKey: 'learn.pathway.step.summary' },
  ],
}

export const LEARN_PATHWAYS: readonly LearnPathwayDef[] = [PATHWAY_H2O_SYNTHESIS]

export function learnPathwayById(id: string): LearnPathwayDef | undefined {
  return LEARN_PATHWAYS.find((p) => p.id === id)
}

export function buildPathwayLabUrl(pathway: LearnPathwayDef): string {
  const params = new URLSearchParams()
  params.set('reactor', '1')
  params.set('genEq', '1')
  params.set('learnG', pathway.gradeId)
  params.set('learnC', pathway.chapterId)
  params.set('learnS', pathway.sectionId)
  params.set('product', pathway.productCompoundId)
  params.set('pathway', pathway.id)
  return `/#/?${params.toString()}`
}

export function pathwayTotalTasks(pathway: LearnPathwayDef): number {
  return pathway.steps.reduce((s, st) => s + st.taskCount, 0)
}
