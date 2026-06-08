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
  contentRu: string
  rememberRu: string
  contentEn: string
  rememberEn: string
}

export type G7TextbookKnowledge = {
  source: string
  totalSections: number
  sections: G7TextbookSection[]
}

export const G7_TEXTBOOK_KNOWLEDGE = g7TextbookRaw as G7TextbookKnowledge

const G7_SECTION_INDEX = new Map<string, G7TextbookSection>(
  G7_TEXTBOOK_KNOWLEDGE.sections.map((s) => [`${s.chapterId}-${s.sectionId}`, s]),
)

function formatChunkBody(section: G7TextbookSection, locale: 'ru' | 'en'): string {
  const topic = locale === 'en' ? section.topicEn : section.topicRu
  const content = locale === 'en' ? section.contentEn : section.contentRu
  const remember = locale === 'en' ? section.rememberEn : section.rememberRu
  const header =
    locale === 'en'
      ? `TEXTBOOK (Kimyo, grade 7, 2022) · page ${section.page}`
      : `УЧЕБНИК (Kimyo, 7 класс, 2022) · стр. ${section.page}`
  return `${header}\n**${topic}**\n\n${content}\n\n--- ${locale === 'en' ? 'REMEMBER' : 'ЗАПОМНИТЬ'} ---\n${remember}`
}

/** Все § учебника как фрагменты базы знаний для RAG. */
export function g7TextbookKnowledgeChunks(): ChemistryKnowledgeChunk[] {
  return G7_TEXTBOOK_KNOWLEDGE.sections.map((s) => ({
    id: s.id,
    topic: `§${s.kp}. ${s.topicRu}`,
    grades: [7],
    keywords: [
      ...s.keywords,
      s.topicRu,
      s.topicEn,
      `§${s.kp}`,
      `параграф ${s.kp}`,
      s.chapterId,
      s.sectionId,
      'учебник',
      'kimyo',
      '7 класс',
    ],
    ru: formatChunkBody(s, 'ru'),
    en: formatChunkBody(s, 'en'),
    textbook: {
      gradeId: 'g7',
      chapterId: s.chapterId,
      sectionId: s.sectionId,
      page: s.page,
      rememberRu: s.rememberRu,
      rememberEn: s.rememberEn,
    },
  }))
}

export function getG7TextbookSection(
  chapterId: string,
  sectionId: string,
): G7TextbookSection | undefined {
  return G7_SECTION_INDEX.get(`${chapterId}-${sectionId}`)
}

export function findG7TextbookByQuery(query: string): G7TextbookSection | null {
  const q = query.toLowerCase().replace(/\s+/g, ' ').trim()
  if (q.length < 3) return null

  let best: { section: G7TextbookSection; score: number } | null = null

  for (const s of G7_TEXTBOOK_KNOWLEDGE.sections) {
    let score = 0
    const title = s.topicRu.toLowerCase()
    const titleEn = s.topicEn.toLowerCase()

    const secMatch = q.match(/§\s*(\d+)|параграф\s*(\d+)/)
    if (secMatch) {
      const n = Number(secMatch[1] ?? secMatch[2])
      if (n === s.kp) score += 12
    }

    if (q.includes(title) || title.includes(q)) score += 20
    if (q.includes(titleEn) || titleEn.includes(q)) score += 14

    for (const kw of s.keywords) {
      if (kw.length >= 4 && q.includes(kw.toLowerCase())) score += 3
    }

    const tokens = q.split(/\s+/).filter((t) => t.length >= 4)
    for (const tok of tokens) {
      if (title.includes(tok)) score += 2
    }

    if (!best || score > best.score) best = { section: s, score }
  }

  return best && best.score >= 8 ? best.section : null
}

export function buildG7TextbookContextBlock(
  chapterId: string,
  sectionId: string,
  locale: 'ru' | 'en',
  maxChars = 9000,
): string {
  const section = getG7TextbookSection(chapterId, sectionId)
  if (!section) return ''
  const body = formatChunkBody(section, locale)
  return body.length > maxChars ? `${body.slice(0, maxChars)}…` : body
}
