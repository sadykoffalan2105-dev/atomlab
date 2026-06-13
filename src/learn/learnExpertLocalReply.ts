import { matchFaqEntry } from './learnChemistryFaq'
import { retrieveChemistryKnowledge } from './learnKnowledgeRetrieval'
import type { LearnLocalAssistantContext } from './learnLocalAssistant'
import { synthesizeKnowledgeAnswer } from './learnConversationalSynthesis'

/** Человечный офлайн-ответ: синтез из FAQ + базы, без «простыни» справочника. */
export function composeExpertLocalReply(
  query: string,
  ctx: LearnLocalAssistantContext,
  messages: { role: string; content: string }[] = [],
): string | null {
  const faq = matchFaqEntry(query)
  const retrieved = retrieveChemistryKnowledge(query, {
    maxChunks: 6,
    minScore: 1,
    gradeId: ctx.gradeId,
    sectionTitle: ctx.sectionTitle,
    chapterId: ctx.chapterId,
    sectionId: ctx.sectionId,
  })

  if (!faq && retrieved.chunks.length === 0) {
    return null
  }

  return synthesizeKnowledgeAnswer(query, retrieved.chunks, faq, ctx, messages)
}
