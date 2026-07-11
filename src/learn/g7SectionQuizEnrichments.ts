import type { SectionQuizEnrichment } from './g7C1S01SectionQuizEnrichments'
import { getG7C1S01SectionEnrichment } from './g7C1S01SectionQuizEnrichments'
import bankEnrichments from '../data/g7SectionQuizEnrichments.json'
import type { TopicQuizItem } from './topicQuizTypes'

type EnrichmentMap = Record<string, SectionQuizEnrichment>

const JSON_ENRICHMENTS = bankEnrichments as EnrichmentMap

/** Ручной §1 перекрывает JSON; остальные § — из g7SectionQuizEnrichments.json. */
export function getG7SectionQuizEnrichment(key: string): SectionQuizEnrichment | null {
  return getG7C1S01SectionEnrichment(key) ?? JSON_ENRICHMENTS[key] ?? null
}

/** Подмешивает развёрнутые описания и visualId для § с enrichments. */
export function enrichG7SectionQuizItem(item: TopicQuizItem): TopicQuizItem {
  const key = item.templateKey ?? item.id
  const e = getG7SectionQuizEnrichment(key)
  if (!e) return item
  return {
    ...item,
    description: e.description,
    explanation: e.explanation,
    visualId: e.visualId,
  }
}

export function allG7SectionQuizEnrichmentIds(): string[] {
  const ids = new Set<string>([
    ...Object.keys(JSON_ENRICHMENTS),
    // §1 ids always available via C1S01 module — listed in JSON after build too
  ])
  return [...ids]
}
