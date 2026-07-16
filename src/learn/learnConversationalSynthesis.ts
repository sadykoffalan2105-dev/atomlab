import type { ChemistryKnowledgeChunk } from './learnChemistryKnowledgeBase'
import type { FaqEntry } from './learnChemistryFaq'
import type { LearnLocalAssistantContext } from './learnLocalAssistant'
import type { AssistantLocale } from './learnAssistantLocale'
import { knowledgeSourceLocale, pickFaqText } from './learnAssistantLocale'
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
  pickOpenerForLocale,
  wantsFullAnswer,
  type QueryIntent,
} from './learnConversationVariety'
import {
  appendLessonFooterIfEducational,
  buildLessonFooterFromSection,
} from './learnLessonFooter'
import { cleanPdfHyphenation } from './learnTextbookTextClean'

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

function bestDefinition(section: G7TextbookSection, locale: AssistantLocale): string | null {
  const src = knowledgeSourceLocale(locale)
  // definitions currently only in Russian corpus
  const defs = section.definitionsRu ?? []
  for (const d of defs) {
    const clean = cleanPdfHyphenation(d.replace(/\s+/g, ' ').trim())
    if (clean.length >= 40 && clean.length <= 280 && !/^\?/.test(clean)) {
      if (src === 'en') {
        // keep short RU definition only when no EN body; prefer content lead
        continue
      }
      return clean
    }
  }
  return null
}

function sectionContent(section: G7TextbookSection, locale: AssistantLocale): string {
  const src = knowledgeSourceLocale(locale)
  const en = section.contentEn?.trim()
  if (src === 'en' && en) return en
  return section.contentRu
}

function buildSectionLesson(
  section: G7TextbookSection,
  ctx: LearnLocalAssistantContext,
  intent: QueryIntent,
  seed: number,
  scope?: 'chapter' | 'book',
): string {
  const locale = ctx.locale
  const src = knowledgeSourceLocale(locale)
  const topic = src === 'en' ? section.topicEn : section.topicRu
  const opener = pickOpenerForLocale(locale, seed, intent === 'book_casual')
  const def = bestDefinition(section, locale)
  const globalNum = globalTopicNumber(section)

  const parts: string[] = []

  if (scope === 'book') {
    parts.push(
      locale === 'uz'
        ? `${opener} **${globalNum}-mavzu** — Kimyo darsligi, ${chapterLabel(section.chapterId, false)}, §${section.kp}, ${section.page}-bet.`
        : locale === 'en'
          ? `${opener} **Topic ${globalNum}** — ${section.chapterId} §${section.kp}, p. ${section.page}.`
          : `${opener} **Тема ${globalNum}** по учебнику Kimyo — ${chapterLabel(section.chapterId, true)}, §${section.kp}, стр. ${section.page}.`,
    )
  } else {
    parts.push(
      locale === 'uz'
        ? `${opener} **§${section.kp}. ${topic}** (${section.page}-bet).`
        : locale === 'en'
          ? `${opener} **§${section.kp}. ${topic}** (p. ${section.page}).`
          : `${opener} **§${section.kp}. ${topic}** (стр. ${section.page}).`,
    )
  }

  parts.push('')

  if (def && locale === 'ru') {
    parts.push('**Суть темы:**')
    parts.push(def)
    parts.push('')
  }

  const mainText = takeCharsAtSentence(
    sectionContent(section, locale),
    intent === 'book_casual' ? 1400 : intent === 'explain' ? 1700 : 1100,
    0,
  )
  parts.push(mainText)

  if (section.conceptsRu?.length && wantsFullAnswer(intent) && locale === 'ru') {
    parts.push('')
    parts.push('**Ключевые понятия:**')
    for (const c of section.conceptsRu.slice(0, 5)) {
      parts.push(`• ${cleanPdfHyphenation(c)}`)
    }
  }

  const lessonBody = parts.join('\n')
  return lessonBody + buildLessonFooterFromSection(section, locale, seed)
}

function buildFaqAnswer(
  faq: FaqEntry,
  locale: AssistantLocale,
  seed: number,
  intent: QueryIntent,
  ctx: LearnLocalAssistantContext,
): string {
  const core = stripBoilerplate(pickFaqText(faq, locale))
  const opener = pickOpenerForLocale(locale, seed)
  const body = takeCharsAtSentence(core, wantsFullAnswer(intent) ? 900 : 420)
  const main = `${opener}\n\n${body}`
  return appendLessonFooterIfEducational(
    main,
    {
      locale,
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
  const locale = ctx.locale
  const section = resolveG7Section(chunk, ctx)
  if (section) return buildSectionLesson(section, ctx, intent, seed)

  const opener = pickOpenerForLocale(locale, seed)
  const src = knowledgeSourceLocale(locale)
  const mainText = stripBoilerplate(src === 'en' ? chunk.en : chunk.ru)
  const lead = takeCharsAtSentence(mainText, wantsFullAnswer(intent) ? 1000 : 380)

  const main = [`${opener}`, '', `**${chunk.topic}**`, '', lead].join('\n')
  return appendLessonFooterIfEducational(
    main,
    {
      locale,
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
  const locale = ctx.locale
  const intent = detectQueryIntent(query)
  const turnIndex = messages.filter((m) => m.role === 'user').length
  const seed = conversationSeed(query, ctx.sectionId, turnIndex)

  if (faq) {
    return buildFaqAnswer(faq, locale, seed, intent, ctx)
  }

  const explicit = resolveSectionFromQuery(query, ctx)
  if (explicit) {
    return buildSectionLesson(explicit.section, ctx, intent, seed, explicit.scope)
  }

  if (chunks.length === 0) {
    const opener = pickOpenerForLocale(locale, seed)
    if (locale === 'uz') {
      return `${opener} Savolni aniqlashtiring — formula, reaksiya yoki §${ctx.kpNumber} «${ctx.sectionTitle}» mavzusi.`
    }
    if (locale === 'en') {
      return `${opener} Narrow it down — formula, reaction, or §${ctx.kpNumber} topic?`
    }
    return `${opener} Уточните вопрос — по формуле, реакции или теме §${ctx.kpNumber} «${ctx.sectionTitle}».`
  }

  const main = chunks[0]!
  const section = resolveG7Section(main, ctx)

  if (section) {
    return buildSectionLesson(section, ctx, intent, seed)
  }

  if (wantsFullAnswer(intent) && chunks.length > 1) {
    const primary = buildChunkFallback(main, ctx, intent, seed)
    const src = knowledgeSourceLocale(locale)
    const extra = chunks.slice(1, 3).map((c) => {
      const snippet = takeCharsAtSentence(stripBoilerplate(src === 'en' ? c.en : c.ru), 320)
      return snippet ? `\n\n**${c.topic}**\n${snippet}` : ''
    })
    return primary + extra.join('')
  }

  return buildChunkFallback(main, ctx, intent, seed)
}

export function buildConversationHints(
  messages: { role: string; content: string }[],
  locale: AssistantLocale | boolean,
): string {
  const lang: AssistantLocale = typeof locale === 'boolean' ? (locale ? 'ru' : 'en') : locale
  const recent = messages.slice(-6)
  if (recent.length < 2) return ''

  const userTurns = recent.filter((m) => m.role === 'user').map((m) => m.content.trim())
  const botTurns = recent.filter((m) => m.role === 'assistant').map((m) => m.content.trim())
  if (userTurns.length === 0) return ''

  const lastBot = botTurns[botTurns.length - 1] ?? ''
  const antiRepeat = lastBot
    ? lang === 'uz'
      ? `\nTAKRORLANMASIN: oldingi javobdek boshlamang («${lastBot.slice(0, 60)}…»). Boshqa tuzilma va ifodalar.`
      : lang === 'en'
        ? `\nANTI-REPEAT: do not start like the previous reply ("${lastBot.slice(0, 60)}…"). Use different structure and wording.`
        : `\nАНТИ-ПОВТОР: не начинай ответ так же, как предыдущий («${lastBot.slice(0, 60)}…»). Другая структура и другие формулировки.`
    : ''

  if (lang === 'uz') {
    return `\nDIALOG: o‘quvchi so‘radi: «${userTurns.join('» → «')}». Oxirgi savolga to‘liq javob bering, tushuntirishlar kamida 120 so‘z, oldingi javobni so‘zma-so‘z takrorlamang.${antiRepeat}

HAR BIR O‘QUV JAVOBINING OXIRI (uch blok):
1) **Eslab qoling:** — darslikdan 2–4 punkt
2) **O‘qituvchi maslahati:** — bitta amaliy maslahat
3) **O‘zingizni tekshiring:** — bitta savol

Javob faqat o‘zbek lotin yozuvida.`
  }

  if (lang === 'en') {
    return `\nDIALOGUE: student asked: "${userTurns.join('" → "')}". Give a full answer to the latest question, at least 120 words for explanations, do not repeat the previous reply verbatim.${antiRepeat}

MANDATORY END OF EVERY EDUCATIONAL REPLY (three blocks):
1) **Must remember:** — 2–4 bullet points from the textbook
2) **Teacher tip:** — one practical study tip
3) **Check yourself — reply in chat:** — one self-check question`
  }

  return `\nДИАЛОГ: ученик спрашивал: «${userTurns.join('» → «')}». Ответь развёрнуто на последний вопрос, минимум 120 слов для объяснений, не повторяй дословно прошлый ответ.${antiRepeat}

ОБЯЗАТЕЛЬНЫЙ ФИНАЛ КАЖДОГО УЧЕБНОГО ОТВЕТА (три блока):
1) **Обязательно запомнить:** — 2–4 пункта из учебника
2) **Совет учителя:** — один практический совет, как лучше запомнить
3) **Проверь себя — ответь в чат:** — один вопрос для самопроверки по теме`
}
