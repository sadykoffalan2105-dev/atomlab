import type { ChemistryKnowledgeChunk } from './learnChemistryKnowledgeBase'
import type { FaqEntry } from './learnChemistryFaq'
import type { LearnLocalAssistantContext } from './learnLocalAssistant'
import type { AssistantLocale } from './learnAssistantLocale'
import { pickFaqText } from './learnAssistantLocale'
import {
  isSafeBodyForLocale,
  normalizeTeacherReplyText,
  pageLabel,
  paragraphLabel,
} from './learnTeacherTextNormalize'
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

function bestDefinitionRu(section: G7TextbookSection): string | null {
  const defs = section.definitionsRu ?? []
  for (const d of defs) {
    const clean = cleanPdfHyphenation(d.replace(/\s+/g, ' ').trim())
    if (clean.length >= 40 && clean.length <= 280 && !/^\?/.test(clean)) return clean
  }
  return null
}

function stubSection(ctx: LearnLocalAssistantContext): G7TextbookSection {
  return {
    id: `${ctx.chapterId}-${ctx.sectionId}`,
    gradeId: ctx.gradeId,
    chapterId: ctx.chapterId,
    sectionId: ctx.sectionId,
    kp: ctx.kpNumber,
    page: 1,
    topicRu: ctx.sectionTitle,
    topicEn: ctx.sectionTitle,
    keywords: [],
    contentRu: '',
    contentEn: '',
    rememberRu: '',
    rememberEn: '',
  }
}

/** Тело урока только на языке UI — без склейки RU/EN/UZ. */
function sectionBodyForLocale(
  section: G7TextbookSection,
  locale: AssistantLocale,
  ctx: LearnLocalAssistantContext,
  intent: QueryIntent,
): string {
  if (locale === 'ru') {
    return takeCharsAtSentence(
      section.contentRu,
      intent === 'book_casual' ? 1400 : intent === 'explain' ? 1700 : 1100,
      0,
    )
  }

  if (locale === 'en') {
    const en = section.contentEn?.trim()
    if (en && isSafeBodyForLocale(en, 'en')) {
      return takeCharsAtSentence(
        en,
        intent === 'book_casual' ? 1400 : intent === 'explain' ? 1700 : 1100,
        0,
      )
    }
    const slide = ctx.slideBody?.trim()
    if (slide && isSafeBodyForLocale(slide, 'en')) {
      return takeCharsAtSentence(slide, 900, 0)
    }
    return [
      `This is ${paragraphLabel('en', section.kp)}: «${ctx.sectionTitle || section.topicEn}» (${pageLabel('en', section.page)}).`,
      `Open the Theory slides and the 3D model, then restate the main idea in your own words.`,
      `Key focus: what the topic is about, one everyday example, and what to remember for the test.`,
    ].join('\n\n')
  }

  const slide = ctx.slideBody?.trim()
  if (slide && isSafeBodyForLocale(slide, 'uz')) {
    return takeCharsAtSentence(slide, 900, 0)
  }
  const topic = ctx.sectionTitle || section.topicEn || section.topicRu
  return [
    `Bu ${paragraphLabel('uz', section.kp)}: «${topic}» (${pageLabel('uz', section.page)}).`,
    `Mavzuda kimyo bo‘yicha asosiy g‘oyalar, hayotdan misollar va eslab qolish kerak bo‘lgan qoidalar ko‘riladi.`,
    `«Nazariya» slaydlarini oching, 3D modelni ko‘ring va ta’rifni o‘z so‘zlaringiz bilan ayting — shunda yaxshi esda qoladi.`,
    `Batafsilroq kerak bo‘lsa — Ollama yoqilganida savolni yana yozing: model javobni to‘liq o‘zbekcha beradi.`,
  ].join('\n\n')
}

function buildSectionLesson(
  section: G7TextbookSection,
  ctx: LearnLocalAssistantContext,
  intent: QueryIntent,
  seed: number,
  scope?: 'chapter' | 'book',
): string {
  const locale = ctx.locale
  const topic = ctx.sectionTitle || (locale === 'ru' ? section.topicRu : section.topicEn)
  const opener = pickOpenerForLocale(locale, seed, intent === 'book_casual')
  const globalNum = globalTopicNumber(section)
  const para = paragraphLabel(locale, section.kp)
  const page = pageLabel(locale, section.page)

  const parts: string[] = []

  if (scope === 'book') {
    parts.push(
      locale === 'uz'
        ? `${opener} **${globalNum}-mavzu** — Kimyo darsligi, ${chapterLabel(section.chapterId, false)}, ${para}, ${page}.`
        : locale === 'en'
          ? `${opener} **Topic ${globalNum}** — ${chapterLabel(section.chapterId, false)}, ${para}, ${page}.`
          : `${opener} **Тема ${globalNum}** по учебнику Kimyo — ${chapterLabel(section.chapterId, true)}, ${para}, ${page}.`,
    )
  } else {
    parts.push(`${opener} **${para}. ${topic}** (${page}).`)
  }

  parts.push('')

  if (locale === 'ru') {
    const def = bestDefinitionRu(section)
    if (def) {
      parts.push('**Суть темы:**')
      parts.push(def)
      parts.push('')
    }
  }

  parts.push(sectionBodyForLocale(section, locale, ctx, intent))

  if (section.conceptsRu?.length && wantsFullAnswer(intent) && locale === 'ru') {
    parts.push('')
    parts.push('**Ключевые понятия:**')
    for (const c of section.conceptsRu.slice(0, 5)) {
      parts.push(`• ${cleanPdfHyphenation(c)}`)
    }
  }

  const lessonBody = parts.join('\n')
  return normalizeTeacherReplyText(
    lessonBody + buildLessonFooterFromSection(section, locale, seed, ctx.sectionTitle),
    locale,
  )
}

function buildFaqAnswer(
  faq: FaqEntry,
  locale: AssistantLocale,
  seed: number,
  intent: QueryIntent,
  ctx: LearnLocalAssistantContext,
): string {
  const raw = pickFaqText(faq, locale)
  if (locale === 'uz' && !isSafeBodyForLocale(raw, 'uz')) {
    const opener = pickOpenerForLocale(locale, seed)
    return normalizeTeacherReplyText(
      appendLessonFooterIfEducational(
        `${opener}\n\n«${ctx.sectionTitle}» mavzusiga oid savol. Qisqa javob uchun savolni aniqlashtiring yoki Ollama orqali so‘rang.`,
        { locale, seed, topic: ctx.sectionTitle, kp: ctx.kpNumber },
        false,
      ),
      locale,
    )
  }
  if (locale === 'en' && !isSafeBodyForLocale(raw, 'en')) {
    const opener = pickOpenerForLocale(locale, seed)
    return normalizeTeacherReplyText(
      `${opener}\n\nPlease rephrase the question about «${ctx.sectionTitle}», or enable Ollama for a full English explanation.`,
      locale,
    )
  }

  const core = stripBoilerplate(raw)
  const opener = pickOpenerForLocale(locale, seed)
  const body = takeCharsAtSentence(core, wantsFullAnswer(intent) ? 900 : 420)
  return normalizeTeacherReplyText(
    appendLessonFooterIfEducational(
      `${opener}\n\n${body}`,
      { locale, seed, topic: ctx.sectionTitle, kp: ctx.kpNumber },
      false,
    ),
    locale,
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
  const candidate = locale === 'ru' ? chunk.ru : chunk.en
  if (!isSafeBodyForLocale(candidate, locale)) {
    const g7 = getG7TextbookSection(ctx.chapterId, ctx.sectionId)
    return buildSectionLesson(g7 ?? stubSection(ctx), ctx, intent, seed)
  }

  const lead = takeCharsAtSentence(stripBoilerplate(candidate), wantsFullAnswer(intent) ? 1000 : 380)
  const topic = chunk.topic.replace(/^§\d+\.\s*/, '').replace(/^параграф\s*\d+\.?\s*/i, '')
  return normalizeTeacherReplyText(
    appendLessonFooterIfEducational(
      [`${opener}`, '', `**${topic}**`, '', lead].join('\n'),
      { locale, seed, topic, kp: ctx.kpNumber },
      false,
    ),
    locale,
  )
}

/** Прямые справочные чанки (элемент / вещество / органика / учёный / формула). */
const DIRECT_ENTITY_PREFIXES = ['el-', 'cmp-', 'org-', 'sci-', 'formula-']

function normalizeForMatch(q: string): string {
  return q
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\u2080-\u2089]/g, (ch) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(ch)))
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Если вопрос напрямую про конкретную сущность (что такое водород, кто такой
 * Менделеев, формула массовой доли), выбираем самый релевантный справочный чанк
 * — его имя должно реально встречаться в вопросе, чтобы не отвечать «мимо».
 */
/** Обобщённые слова — не считаются точным попаданием в конкретную сущность. */
const GENERIC_ENTITY_WORDS = new Set([
  'кислота',
  'кислоты',
  'оксид',
  'оксиды',
  'основание',
  'основания',
  'гидроксид',
  'соль',
  'соли',
  'вещество',
  'вещества',
  'углевод',
  'спирт',
  'кислота (гидроксид)',
  'основание (гидроксид)',
  'элемент',
  'газ',
  'металл',
  'неметалл',
])

function pickDirectEntityChunk(
  query: string,
  chunks: ChemistryKnowledgeChunk[],
): ChemistryKnowledgeChunk | null {
  const q = normalizeForMatch(query)
  for (const c of chunks) {
    if (!DIRECT_ENTITY_PREFIXES.some((p) => c.id.startsWith(p))) continue
    const nameHit = c.keywords.some(
      (k) => k.length >= 4 && !GENERIC_ENTITY_WORDS.has(k.toLowerCase()) && q.includes(k.toLowerCase()),
    )
    if (nameHit) return c
  }
  return null
}

/** Профессиональный прямой ответ по справочному чанку (без чужого §-контекста). */
function buildDirectEntityAnswer(
  chunk: ChemistryKnowledgeChunk,
  ctx: LearnLocalAssistantContext,
  intent: QueryIntent,
  seed: number,
): string {
  const locale = ctx.locale
  const opener = pickOpenerForLocale(locale, seed)

  let body = locale === 'ru' ? chunk.ru : chunk.en
  if (!isSafeBodyForLocale(body, locale)) body = chunk.ru
  body = stripBoilerplate(body)
  if (!wantsFullAnswer(intent)) {
    const short = takeCharsAtSentence(body, 480)
    if (short.length >= 60) body = short
  }

  const parts = [opener, '', body]

  if (ctx.mode !== 'helper') {
    const label = chunk.topic.replace(/\s*\([^)]*\)\s*$/, '').replace(/^Учёный:\s*/i, '')
    if (locale === 'ru') {
      parts.push('', `**Проверь себя:** объясните своими словами, что важно знать про «${label}».`)
    } else if (locale === 'en') {
      parts.push('', `**Check yourself:** explain in your own words the key facts about "${label}".`)
    } else {
      parts.push('', `**O‘zingizni tekshiring:** «${label}» haqida asosiy narsani o‘z so‘zingiz bilan ayting.`)
    }
  }

  return normalizeTeacherReplyText(parts.join('\n'), locale)
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

  // 1) Явный запрос конкретного параграфа по номеру — это урок по учебнику.
  const explicit = resolveSectionFromQuery(query, ctx)
  if (explicit && parseRequestedTopicNumber(query) !== null) {
    return buildSectionLesson(explicit.section, ctx, intent, seed, explicit.scope)
  }

  // 2) Прямой вопрос о сущности (элемент/вещество/учёный/формула) — точный ответ.
  const direct = pickDirectEntityChunk(query, chunks)
  if (direct) {
    return buildDirectEntityAnswer(direct, ctx, intent, seed)
  }

  // 3) Типовой вопрос из FAQ.
  if (faq) {
    return buildFaqAnswer(faq, locale, seed, intent, ctx)
  }

  // 4) Совпадение по названию темы учебника.
  if (explicit) {
    return buildSectionLesson(explicit.section, ctx, intent, seed, explicit.scope)
  }

  if (chunks.length === 0) {
    const opener = pickOpenerForLocale(locale, seed)
    const para = paragraphLabel(locale, ctx.kpNumber)
    if (locale === 'uz') {
      return normalizeTeacherReplyText(
        `${opener} Savolni aniqlashtiring — formula, reaksiya yoki ${para} «${ctx.sectionTitle}» mavzusi.`,
        locale,
      )
    }
    if (locale === 'en') {
      return normalizeTeacherReplyText(
        `${opener} Narrow it down — formula, reaction, or ${para} topic?`,
        locale,
      )
    }
    return normalizeTeacherReplyText(
      `${opener} Уточните вопрос — по формуле, реакции или теме ${para} «${ctx.sectionTitle}».`,
      locale,
    )
  }

  const main = chunks[0]!
  const section = resolveG7Section(main, ctx)

  if (section) {
    return buildSectionLesson(section, ctx, intent, seed)
  }

  if (wantsFullAnswer(intent) && chunks.length > 1 && locale === 'ru') {
    const primary = buildChunkFallback(main, ctx, intent, seed)
    const extra = chunks.slice(1, 3).map((c) => {
      const snippet = takeCharsAtSentence(stripBoilerplate(c.ru), 320)
      return snippet ? `\n\n**${c.topic}**\n${snippet}` : ''
    })
    return normalizeTeacherReplyText(primary + extra.join(''), locale)
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

TIL (MUHIM): faqat o‘zbek lotin. Ruscha yoki inglizcha matn qo‘ymang — tarjima qiling.
Yozuv: «paragraf 1», «sahifa 7» — §, стр, bet ishlatmang.

HAR BIR O‘QUV JAVOBINING OXIRI (uch blok):
1) **Eslab qoling:** — darslikdan 2–4 punkt
2) **O‘qituvchi maslahati:** — bitta amaliy maslahat
3) **O‘zingizni tekshiring:** — bitta savol`
  }

  if (lang === 'en') {
    return `\nDIALOGUE: student asked: "${userTurns.join('" → "')}". Give a full answer to the latest question, at least 120 words for explanations, do not repeat the previous reply verbatim.${antiRepeat}

LANGUAGE: English only — never paste Russian or Uzbek. Write "paragraph 1", "page 7" — never § or стр.

MANDATORY END OF EVERY EDUCATIONAL REPLY (three blocks):
1) **Must remember:** — 2–4 bullet points from the textbook
2) **Teacher tip:** — one practical study tip
3) **Check yourself — reply in chat:** — one self-check question`
  }

  return `\nДИАЛОГ: ученик спрашивал: «${userTurns.join('» → «')}». Ответь развёрнуто на последний вопрос, минимум 120 слов для объяснений, не повторяй дословно прошлый ответ.${antiRepeat}

Пиши «параграф 1», «страница 7» — без символа § и сокращения «стр.».

ОБЯЗАТЕЛЬНЫЙ ФИНАЛ КАЖДОГО УЧЕБНОГО ОТВЕТА (три блока):
1) **Обязательно запомнить:** — 2–4 пункта из учебника
2) **Совет учителя:** — один практический совет, как лучше запомнить
3) **Проверь себя — ответь в чат:** — один вопрос для самопроверки по теме`
}
