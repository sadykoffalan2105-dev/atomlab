import g8BookToc from './g8BookToc.json'
import g9BookToc from './g9BookToc.json'
import {
  G7_TEXTBOOK_CHAPTER_START,
  G7_TEXTBOOK_SECTION_PAGES,
  g7BookChapterStart,
  g7BookSectionPage,
} from './g7BookCurriculum'

type TocEntry = { ch: number; sec: number; page: number }

function tocSectionPages(toc: TocEntry[]): Record<string, number> {
  return Object.fromEntries(
    toc.map((e) => [`c${e.ch}-s${String(e.sec).padStart(2, '0')}`, e.page]),
  )
}

function tocChapterStart(toc: TocEntry[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of toc) {
    const key = `c${e.ch}`
    if (!(key in out)) out[key] = e.page
  }
  return out
}

const G8_SECTION_PAGES = tocSectionPages(g8BookToc as TocEntry[])
const G9_SECTION_PAGES = tocSectionPages(g9BookToc as TocEntry[])
const G8_CHAPTER_START = tocChapterStart(g8BookToc as TocEntry[])
const G9_CHAPTER_START = tocChapterStart(g9BookToc as TocEntry[])

export type LearnTextbookGradeId = 'g7' | 'g8' | 'g9'

export type TextbookConfig = {
  gradeId: LearnTextbookGradeId
  pdfFile: string
  totalPages: number
  frameTitleKey: string
  sectionPages: Record<string, number>
  chapterStart: Record<string, number>
  sectionPage: (chapterId: string, sectionId: string) => number | undefined
  chapterStartPage: (chapterNum: number) => number
}

const BASE = import.meta.env.BASE_URL

function pdfUrl(file: string, page: number, total: number): string {
  const p = Math.min(Math.max(1, Math.round(page)), total)
  return `${BASE}textbooks/${file}#page=${p}&toolbar=0&navpanes=0&scrollbar=1`
}

export const TEXTBOOK_BY_GRADE: Record<LearnTextbookGradeId, TextbookConfig> = {
  g7: {
    gradeId: 'g7',
    pdfFile: 'kimyo-7-ru-2022.pdf',
    totalPages: 176,
    frameTitleKey: 'learn.textbook.frameTitle',
    sectionPages: G7_TEXTBOOK_SECTION_PAGES,
    chapterStart: G7_TEXTBOOK_CHAPTER_START,
    sectionPage: g7BookSectionPage,
    chapterStartPage: g7BookChapterStart,
  },
  g8: {
    gradeId: 'g8',
    pdfFile: 'kimyo-8-ru.pdf',
    totalPages: 208,
    frameTitleKey: 'learn.textbook.frameTitleG8',
    sectionPages: G8_SECTION_PAGES,
    chapterStart: G8_CHAPTER_START,
    sectionPage: (chapterId, sectionId) => G8_SECTION_PAGES[`${chapterId}-${sectionId}`],
    chapterStartPage: (n) => G8_CHAPTER_START[`c${n}`] ?? 8,
  },
  g9: {
    gradeId: 'g9',
    pdfFile: 'kimyo-9-ru.pdf',
    totalPages: 209,
    frameTitleKey: 'learn.textbook.frameTitleG9',
    sectionPages: G9_SECTION_PAGES,
    chapterStart: G9_CHAPTER_START,
    sectionPage: (chapterId, sectionId) => G9_SECTION_PAGES[`${chapterId}-${sectionId}`],
    chapterStartPage: (n) => G9_CHAPTER_START[`c${n}`] ?? 8,
  },
}

export function gradeHasTextbook(gradeId: string): gradeId is LearnTextbookGradeId {
  return gradeId === 'g7' || gradeId === 'g8' || gradeId === 'g9'
}

export function getTextbookConfig(gradeId: string): TextbookConfig | null {
  if (!gradeHasTextbook(gradeId)) return null
  return TEXTBOOK_BY_GRADE[gradeId]
}

export function textbookSectionPage(gradeId: string, chapterId: string, sectionId: string): number {
  const cfg = getTextbookConfig(gradeId)
  if (!cfg) return 1
  return cfg.sectionPage(chapterId, sectionId) ?? cfg.chapterStartPage(Number(chapterId.replace(/^c/, '')) || 1)
}

export function textbookPdfUrl(gradeId: string, page: number): string {
  const cfg = getTextbookConfig(gradeId)
  if (!cfg) return ''
  return pdfUrl(cfg.pdfFile, page, cfg.totalPages)
}

/** @deprecated — используйте textbookSectionPage('g7', …) */
export function g7TextbookSectionPage(chapterId: string, sectionId: string): number {
  return textbookSectionPage('g7', chapterId, sectionId)
}

/** @deprecated */
export function g7TextbookPdfUrl(page: number): string {
  return textbookPdfUrl('g7', page)
}

export const G7_TEXTBOOK_PDF = `${BASE}textbooks/kimyo-7-ru-2022.pdf`
export const G7_TEXTBOOK_TOTAL_PAGES = 176
