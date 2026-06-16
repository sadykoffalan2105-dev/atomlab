import { getG7QuizVisualEntry } from './g7QuizVisualCatalog'
import type { QuizEnrichment } from './g7C1S01QuizEnrichments'

export type { QuizEnrichment } from './g7C1S01QuizEnrichments'

export function getG7QuizEnrichment(templateKey: string): QuizEnrichment | null {
  const entry = getG7QuizVisualEntry(templateKey)
  if (!entry) return null
  return {
    visualId: templateKey,
    description: entry.description,
    explanation: entry.explanation,
  }
}

/** @deprecated — используйте getG7QuizEnrichment */
export { G7_C1_S01_QUIZ_ENRICHMENTS, enrichG7C1S01Question } from './g7C1S01QuizEnrichments'
