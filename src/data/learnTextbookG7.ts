import {
  G7_TEXTBOOK_CHAPTER_START,
  G7_TEXTBOOK_SECTION_PAGES,
  g7BookChapterStart,
  g7BookSectionPage,
} from './g7BookCurriculum'

export { G7_TEXTBOOK_CHAPTER_START, G7_TEXTBOOK_SECTION_PAGES }

/** Путь к PDF с учётом Vite base (GitHub Pages: /atomlab/). */
export const G7_TEXTBOOK_PDF = `${import.meta.env.BASE_URL}textbooks/kimyo-7-ru-2022.pdf`
export const G7_TEXTBOOK_TOTAL_PAGES = 176

export function g7TextbookSectionPage(chapterId: string, sectionId: string): number {
  return g7BookSectionPage(chapterId, sectionId) ?? g7BookChapterStart(Number(chapterId.replace(/^c/, '')))
}

export function g7TextbookPdfUrl(page: number): string {
  const p = Math.min(Math.max(1, Math.round(page)), G7_TEXTBOOK_TOTAL_PAGES)
  return `${G7_TEXTBOOK_PDF}#page=${p}&toolbar=0&navpanes=0&scrollbar=1`
}

export function gradeHasTextbook(gradeId: string): boolean {
  return gradeId === 'g7'
}
