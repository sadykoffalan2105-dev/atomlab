import bankRaw from '../data/g7SectionQuizBank.json'
import type { TopicQuizItem } from './topicQuizTypes'

export type G7SectionQuizBank = {
  source: string
  generatedFrom: string
  totalSections: number
  totalQuestions: number
  sections: Record<string, TopicQuizItem[]>
}

export const G7_SECTION_QUIZ_BANK = bankRaw as unknown as G7SectionQuizBank

export function g7SectionQuizKey(chapterId: string, sectionId: string): string {
  return `g7-${chapterId}-${sectionId}`
}

export function getG7SectionQuizPool(chapterId: string, sectionId: string): TopicQuizItem[] {
  return G7_SECTION_QUIZ_BANK.sections[g7SectionQuizKey(chapterId, sectionId)] ?? []
}
