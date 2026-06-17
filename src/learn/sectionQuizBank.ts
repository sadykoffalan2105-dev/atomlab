import g7Bank from '../data/g7SectionQuizBank.json'
import g8Bank from '../data/g8SectionQuizBank.json'
import g9Bank from '../data/g9SectionQuizBank.json'
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

export function sectionQuizKey(gradeId: string, chapterId: string, sectionId: string): string {
  return `${gradeId}-${chapterId}-${sectionId}`
}

export function getSectionQuizPool(
  gradeId: string,
  chapterId: string,
  sectionId: string,
): TopicQuizItem[] {
  const bank = BANKS[gradeId]
  if (!bank) return []
  return bank.sections[sectionQuizKey(gradeId, chapterId, sectionId)] ?? []
}

/** @deprecated use getSectionQuizPool */
export function getG7SectionQuizPool(chapterId: string, sectionId: string): TopicQuizItem[] {
  return getSectionQuizPool('g7', chapterId, sectionId)
}

export function g7SectionQuizKey(chapterId: string, sectionId: string): string {
  return sectionQuizKey('g7', chapterId, sectionId)
}

export const G7_SECTION_QUIZ_BANK = BANKS.g7!
