import { getG7C1S01SectionEnrichment } from './g7C1S01SectionQuizEnrichments'
import type { TopicQuizItem } from './topicQuizTypes'

/** Подмешивает развёрнутые описания и visualId для § с ручными enrichments. */
export function enrichG7SectionQuizItem(item: TopicQuizItem): TopicQuizItem {
  const key = item.templateKey ?? item.id
  const e = getG7C1S01SectionEnrichment(key)
  if (!e) return item
  return {
    ...item,
    description: e.description,
    explanation: e.explanation,
    visualId: e.visualId,
  }
}
