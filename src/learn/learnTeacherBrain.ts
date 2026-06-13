import type { LearnLocalAssistantContext } from './learnLocalAssistant'
import { buildAssistantKnowledgeBlock } from './learnAssistantKnowledge'
import { buildSectionOutlineBlock } from './learnSectionKnowledge'
import { matchFaqEntry } from './learnChemistryFaq'
import { buildRetrievedKnowledgeBlock, retrieveChemistryKnowledge } from './learnKnowledgeRetrieval'
import { buildConversationHints } from './learnConversationalSynthesis'
import {
  buildG7TextbookContextBlock,
  buildG7TextbookFullTopicBlock,
  findG7TextbookByQuery,
} from './learnG7TextbookKnowledge'

export type TeacherBrainPack = {
  catalogBlock: string
  chemistryKnowledgeBlock: string
  sectionOutlineBlock: string
  topicSceneId: string
  conversationHints: string
  retrievalScore: number
}

const FULL_TOPIC_RE =
  /полност|подроб|по учебник|объясни тем|объясни §|расскажи про|расскажи о|что такое|explain fully|in detail|tell me about|textbook/i

/** Собирает контекст «мозга» учителя: каталог + база + § + история диалога. */
export function buildTeacherBrainPack(
  query: string,
  ctx: LearnLocalAssistantContext,
  messages: { role: string; content: string }[] = [],
): TeacherBrainPack {
  const speechLocale = ctx.locale === 'en' ? 'en' : 'ru'
  const { block, topicSceneId } = buildAssistantKnowledgeBlock(query, ctx)
  const sectionOutlineBlock = buildSectionOutlineBlock(ctx, 1200)
  const wantsFullTopic = FULL_TOPIC_RE.test(query)

  const retrieved = retrieveChemistryKnowledge(query, {
    maxChunks: wantsFullTopic ? 10 : 6,
    minScore: 1,
    gradeId: ctx.gradeId,
    sectionTitle: ctx.sectionTitle,
    chapterId: ctx.chapterId,
    sectionId: ctx.sectionId,
  })

  let chemistryKnowledgeBlock = buildRetrievedKnowledgeBlock(query, speechLocale, {
    maxChars: wantsFullTopic ? 11_000 : 7_500,
    gradeId: ctx.gradeId,
    sectionTitle: ctx.sectionTitle,
    chapterId: ctx.chapterId,
    sectionId: ctx.sectionId,
    preloaded: retrieved,
  })

  if (ctx.gradeId === 'g7' && ctx.chapterId && ctx.sectionId) {
    const bookBlock = buildG7TextbookContextBlock(
      ctx.chapterId,
      ctx.sectionId,
      speechLocale,
      wantsFullTopic ? 12_000 : 6_000,
    )
    if (bookBlock && !chemistryKnowledgeBlock.includes(bookBlock.slice(0, 80))) {
      chemistryKnowledgeBlock = `[Текущий § учебника Kimyo 7 — главный источник]\n${bookBlock}\n\n--- Дополнительно ---\n${chemistryKnowledgeBlock}`
    }
  }

  const directBook = findG7TextbookByQuery(query)
  if (directBook && wantsFullTopic) {
    const full = buildG7TextbookFullTopicBlock(directBook, speechLocale, 14_000)
    if (full && !chemistryKnowledgeBlock.includes(full.slice(0, 80))) {
      chemistryKnowledgeBlock = `[§${directBook.kp} по запросу — полный текст учебника]\n${full}\n\n---\n${chemistryKnowledgeBlock}`
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
