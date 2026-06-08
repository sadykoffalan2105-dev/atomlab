import type { LearnLocalAssistantContext } from './learnLocalAssistant'
import { buildAssistantKnowledgeBlock } from './learnAssistantKnowledge'
import { buildSectionOutlineBlock } from './learnSectionKnowledge'
import { matchFaqEntry } from './learnChemistryFaq'
import { buildRetrievedKnowledgeBlock, retrieveChemistryKnowledge } from './learnKnowledgeRetrieval'
import { buildConversationHints } from './learnConversationalSynthesis'
import { buildG7TextbookContextBlock } from './learnG7TextbookKnowledge'

export type TeacherBrainPack = {
  catalogBlock: string
  chemistryKnowledgeBlock: string
  sectionOutlineBlock: string
  topicSceneId: string
  conversationHints: string
  retrievalScore: number
}

/** Собирает контекст «мозга» учителя: каталог + база + § + история диалога. */
export function buildTeacherBrainPack(
  query: string,
  ctx: LearnLocalAssistantContext,
  messages: { role: string; content: string }[] = [],
): TeacherBrainPack {
  const speechLocale = ctx.locale === 'en' ? 'en' : 'ru'
  const { block, topicSceneId } = buildAssistantKnowledgeBlock(query, ctx)
  const sectionOutlineBlock = buildSectionOutlineBlock(ctx, 2200)
  const retrieved = retrieveChemistryKnowledge(query, {
    maxChunks: 8,
    minScore: 1,
    gradeId: ctx.gradeId,
    sectionTitle: ctx.sectionTitle,
    chapterId: ctx.chapterId,
    sectionId: ctx.sectionId,
  })
  let chemistryKnowledgeBlock = buildRetrievedKnowledgeBlock(query, speechLocale, {
    maxChars: 9000,
    gradeId: ctx.gradeId,
    sectionTitle: ctx.sectionTitle,
    preloaded: retrieved,
  })

  if (ctx.gradeId === 'g7' && ctx.chapterId && ctx.sectionId) {
    const bookBlock = buildG7TextbookContextBlock(ctx.chapterId, ctx.sectionId, speechLocale, 8500)
    if (bookBlock && !chemistryKnowledgeBlock.includes(bookBlock.slice(0, 80))) {
      chemistryKnowledgeBlock = `[Текущий § учебника — главный источник]\n${bookBlock}\n\n--- Дополнительно ---\n${chemistryKnowledgeBlock}`
    }
  }
  const conversationHints = buildConversationHints(messages, speechLocale === 'ru')

  return {
    catalogBlock: block,
    chemistryKnowledgeBlock,
    sectionOutlineBlock,
    topicSceneId,
    conversationHints,
    retrievalScore: retrieved.score,
  }
}

export function brainHasStrongMatch(pack: TeacherBrainPack): boolean {
  return pack.retrievalScore >= 3 || pack.chemistryKnowledgeBlock.length > 120
}

export function faqHitForQuery(query: string): boolean {
  return !!matchFaqEntry(query)
}
