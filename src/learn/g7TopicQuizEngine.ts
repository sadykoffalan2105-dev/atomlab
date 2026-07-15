import type { AppLocale } from '../i18n/types'
import { getSectionQuizPool } from './sectionQuizBank'
import { localizeTopicQuiz } from './topicQuizLocale'
import type { TopicQuizItem } from './topicQuizTypes'

function shuffleWith<T>(items: T[], rand: () => number): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

/**
 * Перемешивает варианты синхронно во всех языках, чтобы correctIndex
 * оставался верным после localizeTopicQuiz.
 */
export function shuffleQuizChoices(item: TopicQuizItem, rand: () => number = Math.random): TopicQuizItem {
  const order = [0, 1, 2, 3]
  const shuffledOrder = shuffleWith(order, rand) as [number, number, number, number]
  const pick = <T,>(arr: readonly T[] | undefined): [T, T, T, T] | undefined => {
    if (!arr || arr.length !== 4) return undefined
    return [arr[shuffledOrder[0]]!, arr[shuffledOrder[1]]!, arr[shuffledOrder[2]]!, arr[shuffledOrder[3]]!]
  }
  const correctPos = shuffledOrder.indexOf(item.correctIndex) as 0 | 1 | 2 | 3
  return {
    ...item,
    choices: pick(item.choices)!,
    choicesEn: pick(item.choicesEn),
    choicesUz: pick(item.choicesUz),
    correctIndex: correctPos >= 0 ? correctPos : 0,
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
  locale: AppLocale = 'ru',
): TopicQuizItem {
  const pool = getTopicQuizPool(gradeId, chapterId, sectionId)
  const available = pool.filter((q) => !excludeKeys.has(quizDedupeKey(q)))
  const list = available.length > 0 ? available : pool
  const idx = Math.floor(Math.random() * list.length)
  return localizeTopicQuiz(shuffleQuizChoices(list[idx]!), locale)
}

export function topicQuizPoolSize(gradeId: string, chapterId: string, sectionId: string): number {
  return getTopicQuizPool(gradeId, chapterId, sectionId).length
}
