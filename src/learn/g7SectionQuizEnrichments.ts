import type { SectionQuizEnrichment } from './g7C1S01SectionQuizEnrichments'
import {
  G7_C1_S01_SECTION_ENRICHMENTS,
  getG7C1S01SectionEnrichment,
} from './g7C1S01SectionQuizEnrichments'
import bankEnrichments from '../data/g7SectionQuizEnrichments.json'
import type { TopicQuizItem } from './topicQuizTypes'

type EnrichmentMap = Record<string, SectionQuizEnrichment>

const JSON_ENRICHMENTS = bankEnrichments as EnrichmentMap

/** Ручной §1 перекрывает JSON; остальные § — из g7SectionQuizEnrichments.json. */
export function getG7SectionQuizEnrichment(key: string): SectionQuizEnrichment | null {
  return getG7C1S01SectionEnrichment(key) ?? JSON_ENRICHMENTS[key] ?? null
}

/** Подмешивает развёрнутые описания и visualId для § с enrichments (+ EN/UZ если есть). */
export function enrichG7SectionQuizItem(item: TopicQuizItem): TopicQuizItem {
  const key = item.templateKey ?? item.id
  const e = getG7SectionQuizEnrichment(key)
  if (!e) return item
  return {
    ...item,
    description: e.description,
    explanation: e.explanation,
    visualId: e.visualId,
    descriptionEn: e.descriptionEn ?? item.descriptionEn,
    descriptionUz: e.descriptionUz ?? item.descriptionUz,
    explanationEn: e.explanationEn ?? item.explanationEn,
    explanationUz: e.explanationUz ?? item.explanationUz,
  }
}

export function allG7SectionQuizEnrichmentIds(): string[] {
  return [...new Set([...Object.keys(JSON_ENRICHMENTS), ...Object.keys(G7_C1_S01_SECTION_ENRICHMENTS)])]
}
