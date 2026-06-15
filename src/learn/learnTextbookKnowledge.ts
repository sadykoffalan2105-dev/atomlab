import g7TextbookRaw from '../data/g7TextbookKnowledge.json'
import g8TextbookRaw from '../data/g8TextbookKnowledge.json'
import g9TextbookRaw from '../data/g9TextbookKnowledge.json'
import type { ChemistryKnowledgeChunk } from './learnChemistryKnowledgeBase'

export type TextbookSection = {
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

export type TextbookKnowledge = {
  source: string
  totalSections: number
  extractedAt?: string
  sections: TextbookSection[]
}

const BY_GRADE: Record<string, TextbookKnowledge> = {
  g7: g7TextbookRaw as TextbookKnowledge,
  g8: g8TextbookRaw as TextbookKnowledge,
  g9: g9TextbookRaw as TextbookKnowledge,
}

const ALL_SECTIONS: TextbookSection[] = Object.values(BY_GRADE).flatMap((k) => k.sections)

const SECTION_INDEX = new Map<string, TextbookSection>(
  ALL_SECTIONS.map((s) => [`${s.gradeId}-${s.chapterId}-${s.sectionId}`, s]),
)

const BY_CHAPTER = new Map<string, TextbookSection[]>()
for (const s of ALL_SECTIONS) {
  const key = `${s.gradeId}-${s.chapterId}`
  const list = BY_CHAPTER.get(key) ?? []
  list.push(s)
  BY_CHAPTER.set(key, list)
}

function gradeNum(gradeId: string): number {
  const m = gradeId.match(/g(\d+)/)
  return m ? Number(m[1]) : 7
}

function formatChunkBody(
  section: TextbookSection,
  locale: 'ru' | 'en',
  contentOverride?: string,
): string {
  const topic = locale === 'en' ? section.topicEn : section.topicRu
  const content = contentOverride ?? (locale === 'en' ? section.contentEn : section.contentRu)
  const remember = locale === 'en' ? section.rememberEn : section.rememberRu
  const g = gradeNum(section.gradeId)
  const header =
    locale === 'en'
      ? `TEXTBOOK (Kimyo, grade ${g}) · page ${section.page}`
      : `УЧЕБНИК (Kimyo, ${g} класс) · стр. ${section.page}`
  return `${header}\n**§${section.kp}. ${topic}**\n\n${content}\n\n--- ${locale === 'en' ? 'REMEMBER' : 'ЗАПОМНИТЬ'} ---\n${remember}`
}

function sectionKeywords(s: TextbookSection): string[] {
  const g = gradeNum(s.gradeId)
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
    `${g} класс`,
    'Kimyo',
    s.gradeId,
  ]
}

export function textbookKnowledgeChunks(): ChemistryKnowledgeChunk[] {
  const out: ChemistryKnowledgeChunk[] = []

  for (const s of ALL_SECTIONS) {
    const parts = s.ragParts?.length ? s.ragParts : [s.contentRu]
    const kws = sectionKeywords(s)
    const g = gradeNum(s.gradeId)

    parts.forEach((part, idx) => {
      const partId = parts.length > 1 ? `${s.id}-p${idx + 1}` : s.id
      const topic =
        parts.length > 1
          ? `§${s.kp}. ${s.topicRu} (${idx + 1}/${parts.length})`
          : `§${s.kp}. ${s.topicRu}`

      out.push({
        id: partId,
        topic,
        grades: [g],
        keywords: kws,
        ru: formatChunkBody(s, 'ru', part),
        en: formatChunkBody(s, 'en', idx === 0 ? undefined : part),
        textbook: {
          gradeId: s.gradeId as 'g7' | 'g8' | 'g9',
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

export function getTextbookSection(
  gradeId: string,
  chapterId: string,
  sectionId: string,
): TextbookSection | undefined {
  return SECTION_INDEX.get(`${gradeId}-${chapterId}-${sectionId}`)
}

export { parseRequestedTopicNumber } from './learnG7TextbookKnowledge'

export function getTextbookByTopicNumber(
  gradeId: string,
  topicNum: number,
  chapterId?: string,
): { section: TextbookSection; scope: 'chapter' | 'book' } | undefined {
  const gradeSections = ALL_SECTIONS.filter((s) => s.gradeId === gradeId)
  if (chapterId) {
    const inChapter = BY_CHAPTER.get(`${gradeId}-${chapterId}`) ?? []
    const byKp = inChapter.find((s) => s.kp === topicNum)
    if (byKp) return { section: byKp, scope: 'chapter' }
    if (topicNum >= 1 && topicNum <= inChapter.length) {
      return { section: inChapter[topicNum - 1]!, scope: 'chapter' }
    }
  }
  if (topicNum >= 1 && topicNum <= gradeSections.length) {
    return { section: gradeSections[topicNum - 1]!, scope: 'book' }
  }
  return undefined
}

export function findTextbookByQuery(
  query: string,
  opts?: { gradeId?: string; chapterId?: string },
): TextbookSection | null {
  const q = query.toLowerCase()
  for (const s of ALL_SECTIONS) {
    if (opts?.gradeId && s.gradeId !== opts.gradeId) continue
    if (opts?.chapterId && s.chapterId !== opts.chapterId) continue
    const title = s.topicRu.toLowerCase()
    if (q.includes(title.slice(0, 12)) || title.includes(q.slice(0, 12))) return s
    for (const kw of s.keywords) {
      if (kw.length >= 5 && q.includes(kw.toLowerCase())) return s
    }
  }
  return null
}

/** @deprecated — используйте textbookKnowledgeChunks() */
export function g7TextbookKnowledgeChunks(): ChemistryKnowledgeChunk[] {
  return textbookKnowledgeChunks().filter((c) => c.grades?.includes(7))
}
