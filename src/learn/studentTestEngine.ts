import { getTopicQuizPool } from './g7TopicQuizEngine'
import type { TopicQuizItem } from './topicQuizTypes'
import type { StudentTestLength } from './studentTestScoring'

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

export function pickStudentTestQuestions(
  gradeId: string,
  chapterId: string,
  sectionId: string,
  count: StudentTestLength,
): TopicQuizItem[] {
  const pool = getTopicQuizPool(gradeId, chapterId, sectionId)
  if (pool.length === 0) return []
  const shuffled = shuffle(pool)
  const n = Math.min(count, shuffled.length)
  return shuffled.slice(0, n)
}

export function studentTestMaxQuestions(
  gradeId: string,
  chapterId: string,
  sectionId: string,
): number {
  return getTopicQuizPool(gradeId, chapterId, sectionId).length
}
