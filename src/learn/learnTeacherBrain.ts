import type { LearnLocalAssistantContext } from './learnLocalAssistant'
import { knowledgeSourceLocale } from './learnAssistantLocale'
import { buildAssistantKnowledgeBlock } from './learnAssistantKnowledge'
import { buildSectionOutlineBlock } from './learnSectionKnowledge'
import { matchFaqEntry } from './learnChemistryFaq'
import { buildRetrievedKnowledgeBlock, retrieveChemistryKnowledge } from './learnKnowledgeRetrieval'
import { buildConversationHints } from './learnConversationalSynthesis'
import {
  buildG7TextbookContextBlock,
  buildG7TextbookFullTopicBlock,
  findG7TextbookByQuery,
  parseRequestedTopicNumber,
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
  /полност|подроб|по учебник|по книг|из книг|объясни тем|объясни §|расскаж|что такое|что нибудь|\d+\s*[-–]?\s*тем|тем[ае]\s*\d|explain fully|in detail|tell me about|textbook|tushuntir|gapirib ber|mavzu haqida|to'liq|to‘liq/i

export type TeacherBrainPackProfile = 'full' | 'live' | 'fast'

export type TeacherBrainPackOptions = {
  /** full = чат/урок; live/fast = голос и быстрый TTFT (меньше RAG). */
  profile?: TeacherBrainPackProfile
}

/** Собирает контекст «мозга» учителя: каталог + база + § + история диалога. */
export function buildTeacherBrainPack(
  query: string,
  ctx: LearnLocalAssistantContext,
  messages: { role: string; content: string }[] = [],
  options?: TeacherBrainPackOptions,
): TeacherBrainPack {
  const profile = options?.profile ?? 'full'
  const live = profile === 'live' || profile === 'fast'
  const sourceLocale = knowledgeSourceLocale(ctx.locale)
  const { block, topicSceneId } = buildAssistantKnowledgeBlock(query, ctx)
  const sectionOutlineBlock = buildSectionOutlineBlock(ctx, live ? 600 : 1200)
  const wantsFullTopic = !live && FULL_TOPIC_RE.test(query)

  const retrieved = retrieveChemistryKnowledge(query, {
    maxChunks: live ? 5 : wantsFullTopic ? 14 : 10,
    minScore: live ? 3 : 3,
    gradeId: ctx.gradeId,
    sectionTitle: ctx.sectionTitle,
    chapterId: ctx.chapterId,
    sectionId: ctx.sectionId,
  })

  let chemistryKnowledgeBlock = buildRetrievedKnowledgeBlock(query, sourceLocale, {
    maxChars: live ? 4_200 : wantsFullTopic ? 16_000 : 12_000,
    gradeId: ctx.gradeId,
    sectionTitle: ctx.sectionTitle,
    chapterId: ctx.chapterId,
    sectionId: ctx.sectionId,
    preloaded: retrieved,
  })

  const requestedKp = parseRequestedTopicNumber(query)
  const directBook = findG7TextbookByQuery(query, { chapterId: ctx.chapterId })

  if (!live && directBook && (wantsFullTopic || requestedKp !== null)) {
    const full = buildG7TextbookFullTopicBlock(directBook, sourceLocale, 14_000)
    if (full) {
      chemistryKnowledgeBlock = `[§${directBook.kp} «${directBook.topicRu}» — текст по запросу ученика]\n${full}\n\n--- Дополнительно ---\n${chemistryKnowledgeBlock}`
    }
  } else if (ctx.gradeId === 'g7' && ctx.chapterId && ctx.sectionId) {
    const bookBlock = buildG7TextbookContextBlock(
      ctx.chapterId,
      ctx.sectionId,
      sourceLocale,
      live ? 2_400 : wantsFullTopic ? 12_000 : 6_000,
    )
    if (bookBlock && !chemistryKnowledgeBlock.includes(bookBlock.slice(0, 80))) {
      chemistryKnowledgeBlock = `[Текущий § учебника Kimyo 7 — главный источник]\n${bookBlock}\n\n--- Дополнительно ---\n${chemistryKnowledgeBlock}`
    }
  }

  if (live && chemistryKnowledgeBlock.length > 3_800) {
    chemistryKnowledgeBlock = `${chemistryKnowledgeBlock.slice(0, 3_800)}…`
  }

  const conversationHints = buildConversationHints(messages, ctx.locale)

  return {
    catalogBlock: live && block.length > 1_200 ? `${block.slice(0, 1_200)}…` : block,
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
