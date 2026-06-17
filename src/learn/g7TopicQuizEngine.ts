import { getSectionQuizPool } from './sectionQuizBank'
import type { TopicQuizItem } from './topicQuizTypes'

function shuffleWith<T>(items: T[], rand: () => number): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

/** Перемешивает варианты ответа — убирает «самый длинный = правильный». */
export function shuffleQuizChoices(item: TopicQuizItem, rand: () => number = Math.random): TopicQuizItem {
  const correct = item.choices[item.correctIndex] ?? item.choices[0]!
  const shuffled = shuffleWith([...item.choices], rand)
  const correctIndex = shuffled.indexOf(correct) as 0 | 1 | 2 | 3
  return {
    ...item,
    choices: shuffled as [string, string, string, string],
    correctIndex: correctIndex >= 0 ? correctIndex : 0,
  }
}

export function quizDedupeKey(item: TopicQuizItem): string {
  const tk = item.templateKey ?? item.id
  return `${tk}::${item.question.trim().toLowerCase().slice(0, 80)}`
}

/** Вопросы строго по § учебника (g7/g8/g9 section quiz banks). */
export function getTopicQuizPool(gradeId: string, chapterId: string, sectionId: string): TopicQuizItem[] {
  return getSectionQuizPool(gradeId, chapterId, sectionId)
}

export function pickRandomTopicQuiz(
  gradeId: string,
  chapterId: string,
  sectionId: string,
  excludeKeys: ReadonlySet<string> = new Set(),
): TopicQuizItem {
  const pool = getTopicQuizPool(gradeId, chapterId, sectionId)
  const available = pool.filter((q) => !excludeKeys.has(quizDedupeKey(q)))
  const list = available.length > 0 ? available : pool
  const idx = Math.floor(Math.random() * list.length)
  return shuffleQuizChoices(list[idx]!)
}

export function topicQuizPoolSize(gradeId: string, chapterId: string, sectionId: string): number {
  return getTopicQuizPool(gradeId, chapterId, sectionId).length
}
