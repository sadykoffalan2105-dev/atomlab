import type { ChemistryKnowledgeChunk } from './learnChemistryKnowledgeBase'
import type { FaqEntry } from './learnChemistryFaq'
import type { LearnLocalAssistantContext } from './learnLocalAssistant'
import {
  chapterLabel,
  findG7TextbookByQuery,
  getG7TextbookByTopicNumber,
  getG7TextbookSection,
  globalTopicNumber,
  parseRequestedTopicNumber,
  type G7TextbookSection,
} from './learnG7TextbookKnowledge'
import {
  conversationSeed,
  detectQueryIntent,
  pickOpener,
  wantsFullAnswer,
  type QueryIntent,
} from './learnConversationVariety'
import {
  appendLessonFooterIfEducational,
  buildLessonFooterFromSection,
} from './learnLessonFooter'
import { cleanPdfHyphenation } from './learnTextbookTextClean'

function isRu(ctx: LearnLocalAssistantContext): boolean {
  return ctx.locale !== 'en'
}

function stripBoilerplate(text: string): string {
  return cleanPdfHyphenation(
    text
      .replace(/^УЧЕБНИК[^\n]*\n?/i, '')
      .replace(/^TEXTBOOK[^\n]*\n?/i, '')
      .replace(/\*\*§\d+[^*]*\*\*\s*/g, '')
      .replace(/---\s*ЗАПОМНИТЬ\s*---[\s\S]*/i, '')
      .replace(/---\s*REMEMBER\s*---[\s\S]*/i, '')
      .replace(/\*\*/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim(),
  )
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)
}

function takeCharsAtSentence(text: string, maxLen: number, offset = 0): string {
  const sentences = splitSentences(stripBoilerplate(text))
  const slice = sentences.slice(offset)
  let out = ''
  for (const s of slice) {
    if (out.length + s.length + 1 > maxLen && out.length > 80) break
    out = out ? `${out} ${s}` : s
  }
  return out || stripBoilerplate(text).slice(0, maxLen)
}

function resolveSectionFromQuery(
  query: string,
  ctx: LearnLocalAssistantContext,
): { section: G7TextbookSection; scope: 'chapter' | 'book' } | undefined {
  if (ctx.gradeId !== 'g7') return undefined

  const requested = parseRequestedTopicNumber(query)
  if (requested !== null) {
    const hit = getG7TextbookByTopicNumber(requested, ctx.chapterId)
    if (hit) return hit
  }

  const byQuery = findG7TextbookByQuery(query, { chapterId: ctx.chapterId })
  if (byQuery) return { section: byQuery, scope: 'chapter' }

  return undefined
}

function resolveG7Section(
  chunk: ChemistryKnowledgeChunk,
  ctx: LearnLocalAssistantContext,
): G7TextbookSection | undefined {
  if (chunk.textbook) {
    return getG7TextbookSection(chunk.textbook.chapterId, chunk.textbook.sectionId)
  }
  if (ctx.chapterId && ctx.sectionId) {
    return getG7TextbookSection(ctx.chapterId, ctx.sectionId)
  }
  return undefined
}

function bestDefinition(section: G7TextbookSection): string | null {
  const defs = section.definitionsRu ?? []
  for (const d of defs) {
    const clean = cleanPdfHyphenation(d.replace(/\s+/g, ' ').trim())
    if (clean.length >= 40 && clean.length <= 280 && !/^\?/.test(clean)) return clean
  }
  return null
}

function buildSectionLesson(
  section: G7TextbookSection,
  ctx: LearnLocalAssistantContext,
  intent: QueryIntent,
  seed: number,
  scope?: 'chapter' | 'book',
): string {
  const ru = isRu(ctx)
  const topic = ru ? section.topicRu : section.topicEn
  const opener = pickOpener(ru, seed, intent === 'book_casual')
  const def = bestDefinition(section)
  const globalNum = globalTopicNumber(section)

  const parts: string[] = []

  if (scope === 'book') {
    parts.push(
      ru
        ? `${opener} **Тема ${globalNum}** по учебнику Kimyo — ${chapterLabel(section.chapterId)}, §${section.kp}, стр. ${section.page}.`
        : `${opener} **Topic ${globalNum}** — ${section.chapterId} §${section.kp}, p. ${section.page}.`,
    )
  } else {
    parts.push(
      ru
        ? `${opener} **§${section.kp}. ${topic}** (стр. ${section.page}).`
        : `${opener} **§${section.kp}. ${topic}** (p. ${section.page}).`,
    )
  }

  parts.push('')

  if (def) {
    parts.push(ru ? '**Суть темы:**' : '**Core idea:**')
    parts.push(def)
    parts.push('')
  }

  const mainText = takeCharsAtSentence(
    section.contentRu,
    intent === 'book_casual' ? 1400 : intent === 'explain' ? 1700 : 1100,
    0,
  )
  parts.push(mainText)

  if (section.conceptsRu?.length && wantsFullAnswer(intent)) {
    parts.push('')
    parts.push(ru ? '**Ключевые понятия:**' : '**Key concepts:**')
    for (const c of section.conceptsRu.slice(0, 5)) {
      parts.push(`• ${cleanPdfHyphenation(c)}`)
    }
  }

  const lessonBody = parts.join('\n')
  return lessonBody + buildLessonFooterFromSection(section, ru, seed)
}

function buildFaqAnswer(
  faq: FaqEntry,
  ru: boolean,
  seed: number,
  intent: QueryIntent,
  ctx: LearnLocalAssistantContext,
): string {
  const core = stripBoilerplate(ru ? faq.ru : faq.en)
  const opener = pickOpener(ru, seed)
  const body = takeCharsAtSentence(core, wantsFullAnswer(intent) ? 900 : 420)
  const main = `${opener}\n\n${body}`
  return appendLessonFooterIfEducational(
    main,
    {
      ru,
      seed,
      topic: ctx.sectionTitle,
      kp: ctx.kpNumber,
    },
    false,
  )
}

function buildChunkFallback(
  chunk: ChemistryKnowledgeChunk,
  ctx: LearnLocalAssistantContext,
  intent: QueryIntent,
  seed: number,
): string {
  const ru = isRu(ctx)
  const section = resolveG7Section(chunk, ctx)
  if (section) return buildSectionLesson(section, ctx, intent, seed)

  const opener = pickOpener(ru, seed)
  const mainText = stripBoilerplate(ru ? chunk.ru : chunk.en)
  const lead = takeCharsAtSentence(mainText, wantsFullAnswer(intent) ? 1000 : 380)

  const main = [`${opener}`, '', `**${chunk.topic}**`, '', lead].join('\n')
  return appendLessonFooterIfEducational(
    main,
    {
      ru,
      seed,
      topic: chunk.topic.replace(/^§\d+\.\s*/, ''),
      kp: ctx.kpNumber,
    },
    false,
  )
}

/** Живой развёрнутый ответ — разный стиль для разных вопросов. */
export function synthesizeKnowledgeAnswer(
  query: string,
  chunks: ChemistryKnowledgeChunk[],
  faq: FaqEntry | null,
  ctx: LearnLocalAssistantContext,
  messages: { role: string; content: string }[] = [],
): string {
  const ru = isRu(ctx)
  const intent = detectQueryIntent(query)
  const turnIndex = messages.filter((m) => m.role === 'user').length
  const seed = conversationSeed(query, ctx.sectionId, turnIndex)

  if (faq) {
    return buildFaqAnswer(faq, ru, seed, intent, ctx)
  }

  const explicit = resolveSectionFromQuery(query, ctx)
  if (explicit) {
    return buildSectionLesson(explicit.section, ctx, intent, seed, explicit.scope)
  }

  if (chunks.length === 0) {
    const opener = pickOpener(ru, seed)
    return ru
      ? `${opener} Уточните вопрос — по формуле, реакции или теме §${ctx.kpNumber} «${ctx.sectionTitle}».`
      : `${opener} Narrow it down — formula, reaction, or §${ctx.kpNumber} topic?`
  }

  const main = chunks[0]!
  const section = resolveG7Section(main, ctx)

  if (section) {
    return buildSectionLesson(section, ctx, intent, seed)
  }

  if (wantsFullAnswer(intent) && chunks.length > 1) {
    const primary = buildChunkFallback(main, ctx, intent, seed)
    const extra = chunks.slice(1, 3).map((c) => {
      const snippet = takeCharsAtSentence(stripBoilerplate(ru ? c.ru : c.en), 320)
      return snippet ? `\n\n**${c.topic}**\n${snippet}` : ''
    })
    return primary + extra.join('')
  }

  return buildChunkFallback(main, ctx, intent, seed)
}

export function buildConversationHints(
  messages: { role: string; content: string }[],
  ru: boolean,
): string {
  const recent = messages.slice(-6)
  if (recent.length < 2) return ''

  const userTurns = recent.filter((m) => m.role === 'user').map((m) => m.content.trim())
  const botTurns = recent.filter((m) => m.role === 'assistant').map((m) => m.content.trim())
  if (userTurns.length === 0) return ''

  const lastBot = botTurns[botTurns.length - 1] ?? ''
  const antiRepeat = lastBot
    ? ru
      ? `\nАНТИ-ПОВТОР: не начинай ответ так же, как предыдущий («${lastBot.slice(0, 60)}…»). Другая структура и другие формулировки.`
      : `\nANTI-REPEAT: do not start like the previous reply ("${lastBot.slice(0, 60)}…"). Use different structure and wording.`
    : ''

  return ru
    ? `\nДИАЛОГ: ученик спрашивал: «${userTurns.join('» → «')}». Ответь развёрнуто на последний вопрос, минимум 120 слов для объяснений, не повторяй дословно прошлый ответ.${antiRepeat}

ОБЯЗАТЕЛЬНЫЙ ФИНАЛ КАЖДОГО УЧЕБНОГО ОТВЕТА (три блока):
1) **Обязательно запомнить:** — 2–4 пункта из учебника
2) **Совет учителя:** — один практический совет, как лучше запомнить
3) **Проверь себя — ответь в чат:** — один вопрос для самопроверки по теме`
    : `\nDIALOGUE: student asked: "${userTurns.join('" → "')}". Give a full answer to the latest question, at least 120 words for explanations, do not repeat the previous reply verbatim.${antiRepeat}

MANDATORY END OF EVERY EDUCATIONAL REPLY (three blocks):
1) **Must remember:** — 2–4 bullet points from the textbook
2) **Teacher tip:** — one practical study tip
3) **Check yourself — reply in chat:** — one self-check question`
}
