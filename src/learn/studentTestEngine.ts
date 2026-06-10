import { pickMcqExamQuestions, mcqExamPoolSize } from './g7ExamPools'
import type { TopicQuizItem } from './topicQuizTypes'
import type { StudentTestLength } from './studentTestScoring'

export function pickStudentTestQuestions(
  gradeId: string,
  chapterId: string,
  sectionId: string,
  count: StudentTestLength,
): TopicQuizItem[] {
  return pickMcqExamQuestions(gradeId, chapterId, sectionId, count)
}

export function studentTestMaxQuestions(
  gradeId: string,
  chapterId: string,
  sectionId: string,
): number {
  return mcqExamPoolSize(gradeId, chapterId, sectionId)
}
