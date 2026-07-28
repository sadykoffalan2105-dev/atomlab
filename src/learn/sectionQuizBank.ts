import g7Bank from '../data/g7SectionQuizBank.json'
import g8Bank from '../data/g8SectionQuizBank.json'
import g9Bank from '../data/g9SectionQuizBank.json'
import sectionQuizI18n from '../data/sectionQuizI18n.json'
import { enrichG7SectionQuizItem } from './g7SectionQuizEnrichments'
import { mergeQuizI18n, type QuizI18nEntry } from './topicQuizLocale'
import type { TopicQuizItem } from './topicQuizTypes'

export type SectionQuizBank = {
  source: string
  generatedFrom: string
  totalSections: number
  totalQuestions: number
  sections: Record<string, TopicQuizItem[]>
}

const BANKS: Record<string, SectionQuizBank> = {
  g7: g7Bank as unknown as SectionQuizBank,
  g8: g8Bank as unknown as SectionQuizBank,
  g9: g9Bank as unknown as SectionQuizBank,
}

const I18N = sectionQuizI18n as unknown as Record<string, QuizI18nEntry>

export function sectionQuizKey(gradeId: string, chapterId: string, sectionId: string): string {
  return `${gradeId}-${chapterId}-${sectionId}`
}

function withI18n(item: TopicQuizItem): TopicQuizItem {
  return mergeQuizI18n(item, I18N[item.id])
}

export function getSectionQuizPool(
  gradeId: string,
  chapterId: string,
  sectionId: string,
): TopicQuizItem[] {
  const bank = BANKS[gradeId]
  if (!bank) return []
  const raw = bank.sections[sectionQuizKey(gradeId, chapterId, sectionId)] ?? []
  const enriched = gradeId === 'g7' ? raw.map(enrichG7SectionQuizItem) : raw
  return enriched.map(withI18n)
}

/** @deprecated use getSectionQuizPool */
export function getG7SectionQuizPool(chapterId: string, sectionId: string): TopicQuizItem[] {
  return getSectionQuizPool('g7', chapterId, sectionId)
}

export function g7SectionQuizKey(chapterId: string, sectionId: string): string {
  return sectionQuizKey('g7', chapterId, sectionId)
}

/** Все MCQ из банка параграфов (для поиска вопроса по ID). */
export function getAllSectionQuizItems(gradeId: string): TopicQuizItem[] {
  const bank = BANKS[gradeId]
  if (!bank) return []
  return Object.values(bank.sections).flatMap((raw) => {
    const enriched = gradeId === 'g7' ? raw.map(enrichG7SectionQuizItem) : raw
    return enriched.map(withI18n)
  })
}

export const G7_SECTION_QUIZ_BANK = BANKS.g7!
