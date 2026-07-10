import g10BookToc from './g10BookToc.json'
import g11BookToc from './g11BookToc.json'
import g10g11ChapterMeta from './g10g11ChapterMeta.json'
import type { MessageKey } from '../i18n/messagesRu'

type TocEntry = { ch: number; sec: number; kp: number; page: number; titleRu: string }

type ChapterMeta = { totem: string; sectionCount: number }

function sectionId(sec: number): string {
  return `s${String(sec).padStart(2, '0')}`
}

function seedsFromToc(
  gradeId: 'g10' | 'g11',
  toc: readonly TocEntry[],
  chapterNum: number,
): { id: string; kp: number; titleKey: MessageKey }[] {
  return toc
    .filter((e) => e.ch === chapterNum)
    .map((e) => ({
      id: sectionId(e.sec),
      kp: e.kp,
      titleKey: `learn.${gradeId}.c${chapterNum}.${sectionId(e.sec)}.title` as MessageKey,
    }))
}

export const G10_BOOK_TOC = g10BookToc as TocEntry[]
export const G11_BOOK_TOC = g11BookToc as TocEntry[]

const META = g10g11ChapterMeta as {
  g10: Record<string, ChapterMeta>
  g11: Record<string, ChapterMeta>
}

export function g10BookSectionSeeds(chapterNum: number) {
  return seedsFromToc('g10', G10_BOOK_TOC, chapterNum)
}

export function g11BookSectionSeeds(chapterNum: number) {
  return seedsFromToc('g11', G11_BOOK_TOC, chapterNum)
}

export function g10ChapterTotem(chapterNum: number): string {
  return META.g10[String(chapterNum)]?.totem ?? 'co2'
}

export function g11ChapterTotem(chapterNum: number): string {
  return META.g11[String(chapterNum)]?.totem ?? 'h2o'
}

export function g10ChapterNums(): number[] {
  return Object.keys(META.g10)
    .map(Number)
    .sort((a, b) => a - b)
}

export function g11ChapterNums(): number[] {
  return Object.keys(META.g11)
    .map(Number)
    .sort((a, b) => a - b)
}
