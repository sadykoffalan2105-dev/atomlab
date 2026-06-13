import g7TextbookRaw from '../data/g7TextbookKnowledge.json'
import type { ChemistryKnowledgeChunk } from './learnChemistryKnowledgeBase'

export type G7TextbookSection = {
  id: string
  gradeId: string
  chapterId: string
  sectionId: string
  kp: number
  page: number
  topicRu: string
  topicEn: string
  keywords: string[]
  conceptsRu?: string[]
  definitionsRu?: string[]
  contentRu: string
  ragParts?: string[]
  rememberRu: string
  contentEn: string
  rememberEn: string
}

export type G7TextbookKnowledge = {
  source: string
  totalSections: number
  extractedAt?: string
  sections: G7TextbookSection[]
}

export const G7_TEXTBOOK_KNOWLEDGE = g7TextbookRaw as G7TextbookKnowledge

const G7_SECTION_INDEX = new Map<string, G7TextbookSection>(
  G7_TEXTBOOK_KNOWLEDGE.sections.map((s) => [`${s.chapterId}-${s.sectionId}`, s]),
)

const G7_BY_CHAPTER = new Map<string, G7TextbookSection[]>()
for (const s of G7_TEXTBOOK_KNOWLEDGE.sections) {
  const list = G7_BY_CHAPTER.get(s.chapterId) ?? []
  list.push(s)
  G7_BY_CHAPTER.set(s.chapterId, list)
}

function formatChunkBody(
  section: G7TextbookSection,
  locale: 'ru' | 'en',
  contentOverride?: string,
): string {
  const topic = locale === 'en' ? section.topicEn : section.topicRu
  const content = contentOverride ?? (locale === 'en' ? section.contentEn : section.contentRu)
  const remember = locale === 'en' ? section.rememberEn : section.rememberRu
  const header =
    locale === 'en'
      ? `TEXTBOOK (Kimyo, grade 7, 2022) · page ${section.page}`
      : `УЧЕБНИК (Kimyo, 7 класс, 2022) · стр. ${section.page}`
  return `${header}\n**§${section.kp}. ${topic}**\n\n${content}\n\n--- ${locale === 'en' ? 'REMEMBER' : 'ЗАПОМНИТЬ'} ---\n${remember}`
}

function sectionKeywords(s: G7TextbookSection): string[] {
  return [
    ...s.keywords,
    ...(s.conceptsRu ?? []),
    s.topicRu,
    s.topicEn,
    `§${s.kp}`,
    `параграф ${s.kp}`,
    s.chapterId,
    s.sectionId,
    'учебник',
    'kimyo',
    '7 класс',
    'Kimyo',
  ]
}

/** Все § учебника как фрагменты базы знаний для RAG (с под-чанками для длинных §). */
export function g7TextbookKnowledgeChunks(): ChemistryKnowledgeChunk[] {
  const out: ChemistryKnowledgeChunk[] = []

  for (const s of G7_TEXTBOOK_KNOWLEDGE.sections) {
    const parts = s.ragParts?.length ? s.ragParts : [s.contentRu]
    const kws = sectionKeywords(s)

    parts.forEach((part, idx) => {
      const partId = parts.length > 1 ? `${s.id}-p${idx + 1}` : s.id
      const topic =
        parts.length > 1
          ? `§${s.kp}. ${s.topicRu} (${idx + 1}/${parts.length})`
          : `§${s.kp}. ${s.topicRu}`

      out.push({
        id: partId,
        topic,
        grades: [7],
        keywords: kws,
        ru: formatChunkBody(s, 'ru', part),
        en: formatChunkBody(s, 'en', idx === 0 ? undefined : part),
        textbook: {
          gradeId: 'g7',
          chapterId: s.chapterId,
          sectionId: s.sectionId,
          page: s.page,
          rememberRu: s.rememberRu,
          rememberEn: s.rememberEn,
        },
      })
    })
  }

  return out
}

export function getG7TextbookSection(
  chapterId: string,
  sectionId: string,
): G7TextbookSection | undefined {
  return G7_SECTION_INDEX.get(`${chapterId}-${sectionId}`)
}

/** Номер темы/§ из запроса: «21 тему», «§4», «параграф 4». */
export function parseRequestedTopicNumber(query: string): number | null {
  const q = query.toLowerCase().replace(/\s+/g, ' ').trim()

  const patterns = [
    /§\s*(\d+)/,
    /параграф\s*(\d+)/,
    /(?:об|про|о)\s+(\d+)\s*[-–]?\s*(?:я\s+)?тем[аеуыи]/,
    /(?:^|\s)(\d+)\s*[-–]?\s*(?:я\s+)?тем[аеуыи](?:\s|$|[,.])/,
    /тем[аеуыи]\s*(?:№\s*)?(\d+)/,
    /topic\s*(\d+)/,
  ]

  for (const re of patterns) {
    const m = q.match(re)
    if (m?.[1]) {
      const n = Number(m[1])
      if (n >= 1 && n <= 99) return n
    }
  }
  return null
}

/** § по kp внутри главы (legacy). */
export function getG7TextbookByKp(kp: number, chapterId?: string): G7TextbookSection | undefined {
  const matches = G7_TEXTBOOK_KNOWLEDGE.sections.filter((s) => s.kp === kp)
  if (matches.length === 0) return undefined
  if (chapterId) {
    const inChapter = matches.find((s) => s.chapterId === chapterId)
    if (inChapter) return inChapter
  }
  return matches[0]
}

/**
 * «N тема» — сначала § N в текущей главе, иначе N-я тема по всей книге (1…65).
 */
export function getG7TextbookByTopicNumber(
  topicNum: number,
  chapterId?: string,
): { section: G7TextbookSection; scope: 'chapter' | 'book' } | undefined {
  if (chapterId) {
    const inChapter = G7_BY_CHAPTER.get(chapterId) ?? []
    const byKp = inChapter.find((s) => s.kp === topicNum)
    if (byKp) return { section: byKp, scope: 'chapter' }
    if (topicNum >= 1 && topicNum <= inChapter.length) {
      return { section: inChapter[topicNum - 1]!, scope: 'chapter' }
    }
  }

  const all = G7_TEXTBOOK_KNOWLEDGE.sections
  if (topicNum >= 1 && topicNum <= all.length) {
    return { section: all[topicNum - 1]!, scope: 'book' }
  }

  return undefined
}

export function globalTopicNumber(section: G7TextbookSection): number {
  return G7_TEXTBOOK_KNOWLEDGE.sections.findIndex((s) => s.id === section.id) + 1
}

export function chapterLabel(chapterId: string, ru = true): string {
  const n = chapterId.replace(/^c/i, '')
  return ru ? `главе ${n}` : `chapter ${n}`
}

export function findG7TextbookByQuery(
  query: string,
  opts?: { chapterId?: string },
): G7TextbookSection | null {
  const q = query.toLowerCase().replace(/\s+/g, ' ').trim()
  if (q.length < 2) return null

  const requested = parseRequestedTopicNumber(query)
  if (requested !== null) {
    const hit = getG7TextbookByTopicNumber(requested, opts?.chapterId)
    if (hit) return hit.section
  }

  let best: { section: G7TextbookSection; score: number } | null = null

  for (const s of G7_TEXTBOOK_KNOWLEDGE.sections) {
    let score = 0
    const title = s.topicRu.toLowerCase()
    const titleEn = s.topicEn.toLowerCase()

    if (opts?.chapterId && s.chapterId === opts.chapterId) score += 8

    const secMatch = q.match(/§\s*(\d+)|параграф\s*(\d+)/)
    if (secMatch) {
      const n = Number(secMatch[1] ?? secMatch[2])
      if (n === s.kp) score += 14
    }

    if (q.includes(title) || title.includes(q)) score += 22
    if (q.includes(titleEn) || titleEn.includes(q)) score += 16

    for (const kw of s.keywords) {
      if (kw.length >= 4 && q.includes(kw.toLowerCase())) score += 3
    }
    for (const c of s.conceptsRu ?? []) {
      if (c.length >= 4 && q.includes(c.toLowerCase())) score += 4
    }

    const tokens = q.split(/\s+/).filter((t) => t.length >= 4)
    for (const tok of tokens) {
      if (title.includes(tok)) score += 2
      if (s.contentRu.toLowerCase().includes(tok)) score += 1
    }

    if (!best || score > best.score) best = { section: s, score }
  }

  return best && best.score >= 8 ? best.section : null
}

export function buildG7TextbookContextBlock(
  chapterId: string,
  sectionId: string,
  locale: 'ru' | 'en',
  maxChars = 12_000,
): string {
  const section = getG7TextbookSection(chapterId, sectionId)
  if (!section) return ''
  const body = formatChunkBody(section, locale)
  return body.length > maxChars ? `${body.slice(0, maxChars)}…` : body
}

export function buildG7TextbookFullTopicBlock(
  section: G7TextbookSection,
  locale: 'ru' | 'en',
  maxChars = 14_000,
): string {
  const body = formatChunkBody(section, locale)
  return body.length > maxChars ? `${body.slice(0, maxChars)}…` : body
}

export function g7TextbookStats(): { sections: number; ragChunks: number; totalChars: number } {
  const sections = G7_TEXTBOOK_KNOWLEDGE.sections.length
  const ragChunks = g7TextbookKnowledgeChunks().length
  const totalChars = G7_TEXTBOOK_KNOWLEDGE.sections.reduce((a, s) => a + s.contentRu.length, 0)
  return { sections, ragChunks, totalChars }
}
