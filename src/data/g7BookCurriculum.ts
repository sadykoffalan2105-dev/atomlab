import type { MessageKey } from '../i18n/messagesRu'
import g7BookToc from './g7BookToc.json'

export type G7BookTocEntry = {
  ch: number
  sec: number
  page: number
  titleRu: string
  titleEn: string
}

export const G7_BOOK_TOC = g7BookToc as G7BookTocEntry[]

export function g7BookSectionId(sec: number): string {
  return `s${String(sec).padStart(2, '0')}`
}

export function g7BookTitleKey(chapterNum: number, sec: number): MessageKey {
  return `learn.g7.c${chapterNum}.${g7BookSectionId(sec)}.title` as MessageKey
}

export function g7BookSectionSeeds(
  chapterNum: number,
  opts?: { taskBySec?: Partial<Record<number, string>> },
): { id: string; kp: number; titleKey: MessageKey; taskCategoryId?: string }[] {
  return G7_BOOK_TOC.filter((e) => e.ch === chapterNum).map((e) => ({
    id: g7BookSectionId(e.sec),
    kp: e.sec,
    titleKey: g7BookTitleKey(chapterNum, e.sec),
    taskCategoryId: opts?.taskBySec?.[e.sec],
  }))
}

export function g7BookSectionPage(chapterId: string, sectionId: string): number | undefined {
  const ch = Number(chapterId.replace(/^c/, ''))
  const sec = Number(sectionId.replace(/^s/, ''))
  return G7_BOOK_TOC.find((e) => e.ch === ch && e.sec === sec)?.page
}

export function g7BookChapterStart(chapterNum: number): number {
  return G7_BOOK_TOC.find((e) => e.ch === chapterNum)?.page ?? 1
}

export const G7_TEXTBOOK_SECTION_PAGES: Record<string, number> = Object.fromEntries(
  G7_BOOK_TOC.map((e) => [`c${e.ch}-${g7BookSectionId(e.sec)}`, e.page]),
)

export const G7_TEXTBOOK_CHAPTER_START: Record<string, number> = Object.fromEntries(
  Array.from({ length: 8 }, (_, i) => {
    const n = i + 1
    return [`c${n}`, g7BookChapterStart(n)]
  }),
)
