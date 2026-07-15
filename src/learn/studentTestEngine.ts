import type { AppLocale } from '../i18n/types'
import { pickMcqExamQuestions, mcqExamPoolSize } from './g7ExamPools'
import type { TopicQuizItem } from './topicQuizTypes'
import type { StudentTestLength } from './studentTestScoring'

export function pickStudentTestQuestions(
  gradeId: string,
  chapterId: string,
  sectionId: string,
  count: StudentTestLength,
  locale: AppLocale = 'ru',
): TopicQuizItem[] {
  return pickMcqExamQuestions(gradeId, chapterId, sectionId, count, locale)
}

export function studentTestMaxQuestions(
  gradeId: string,
  chapterId: string,
  sectionId: string,
): number {
  return mcqExamPoolSize(gradeId, chapterId, sectionId)
}
