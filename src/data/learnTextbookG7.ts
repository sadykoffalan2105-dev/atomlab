/**
 * Страницы учебника «Kimyo, 7 класс» (рус., 2022) — по оглавлению PDF.
 * Ключ: `${chapterId}-${sectionId}` в терминах learnCurriculum (g7, c1…c5).
 */
export const G7_TEXTBOOK_PDF = '/textbooks/kimyo-7-ru-2022.pdf'
export const G7_TEXTBOOK_TOTAL_PAGES = 176

/** Стартовая страница параграфа (1-based, как в PDF-ридере). */
export const G7_TEXTBOOK_SECTION_PAGES: Record<string, number> = {
  // Глава I — 1.1 … 1.10
  'c1-s01': 7,
  'c1-s02': 12,
  'c1-s03': 14,
  'c1-s04': 16,
  'c1-s05': 20,
  'c1-s06': 24,
  'c1-s07': 26,
  'c1-s08': 28,
  'c1-s09': 31,
  'c1-s10': 34,
  // Глава II — 2.1 … 2.8 (программа ФГОС; в книге дальше 2.9–2.14)
  'c2-s01': 37,
  'c2-s02': 41,
  'c2-s03': 44,
  'c2-s04': 47,
  'c2-s05': 49,
  'c2-s06': 51,
  'c2-s07': 54,
  'c2-s08': 56,
  // Глава III — в книге 4 §; остальное — ближайшие страницы программы
  'c3-s01': 75,
  'c3-s02': 79,
  'c3-s03': 81,
  'c3-s04': 81,
  'c3-s05': 83,
  'c3-s06': 83,
  'c3-s07': 83,
  // Глава IV
  'c4-s01': 85,
  'c4-s02': 87,
  'c4-s03': 90,
  'c4-s04': 92,
  'c4-s05': 95,
  'c4-s06': 97,
  // Глава V
  'c5-s01': 112,
  'c5-s02': 115,
  'c5-s03': 117,
}

export const G7_TEXTBOOK_CHAPTER_START: Record<string, number> = {
  c1: 7,
  c2: 37,
  c3: 75,
  c4: 85,
  c5: 112,
}

export function g7TextbookSectionPage(chapterId: string, sectionId: string): number {
  return G7_TEXTBOOK_SECTION_PAGES[`${chapterId}-${sectionId}`] ?? G7_TEXTBOOK_CHAPTER_START[chapterId] ?? 1
}

export function g7TextbookPdfUrl(page: number): string {
  const p = Math.min(Math.max(1, Math.round(page)), G7_TEXTBOOK_TOTAL_PAGES)
  // toolbar=0 / navpanes=0 — скрывают панель браузера (скачивание, печать, меню).
  return `${G7_TEXTBOOK_PDF}#page=${p}&toolbar=0&navpanes=0&scrollbar=1`
}

export function gradeHasTextbook(gradeId: string): boolean {
  return gradeId === 'g7'
}
