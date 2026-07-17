import { learnSectionPathKey } from '../data/learnFgosMatrix'
import type { AppLocale } from '../i18n/types'
import { getTopicQuizPool, shuffleQuizChoices } from './g7TopicQuizEngine'
import {
  getLogicalMcqForChapter,
  getOralQuestionsForChapter,
  getWrittenQuestionsForChapter,
} from './g7LogicalQuestions'
import { G7_ORAL_EXAM_STARTER } from './g7OralExamStarter'
import { localizeTopicQuiz, localizeOralExam, localizeWrittenExam, mergeOralExamI18n } from './topicQuizLocale'
import { G7_ORAL_EXAM_I18N } from './g7ExamQuestionI18n'
import type { OralExamItem, TopicQuizItem, WrittenExamItem } from './topicQuizTypes'
import type { StudentTestLength } from './studentTestScoring'

export type OralExamCount = 5 | 10

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

function chapterNum(chapterId: string): number {
  return Number(chapterId.replace(/^c/, '')) || 1
}

/** MCQ-пул: только вопросы текущего § (логические — только в итоговом тесте главы). */
export function getMcqExamPool(gradeId: string, chapterId: string, sectionId: string): TopicQuizItem[] {
  return getTopicQuizPool(gradeId, chapterId, sectionId)
}

/** Логические MCQ главы — отдельный пул для экзамена по главе. */
export function getChapterLogicalMcqPool(gradeId: string, chapterId: string): TopicQuizItem[] {
  if (gradeId !== 'g7') return []
  return getLogicalMcqForChapter(chapterNum(chapterId))
}

export function getWrittenExamPool(gradeId: string, chapterId: string): WrittenExamItem[] {
  if (gradeId !== 'g7') return []
  return getWrittenQuestionsForChapter(chapterNum(chapterId))
}

export function getOralExamPool(gradeId: string, chapterId: string): OralExamItem[] {
  if (gradeId !== 'g7') return []
  const chapter = getOralQuestionsForChapter(chapterNum(chapterId))
  const seen = new Set(chapter.map((q) => q.id))
  const starter = G7_ORAL_EXAM_STARTER.filter((q) => !seen.has(q.id)).map((q) =>
    mergeOralExamI18n(q, G7_ORAL_EXAM_I18N[q.id]),
  )
  return [...chapter, ...starter]
}

export function pickMcqExamQuestions(
  gradeId: string,
  chapterId: string,
  sectionId: string,
  count: StudentTestLength,
  locale: AppLocale = 'ru',
): TopicQuizItem[] {
  const pool = getMcqExamPool(gradeId, chapterId, sectionId)
  const logical = getChapterLogicalMcqPool(gradeId, chapterId)
  const merged = shuffle([...pool, ...logical])
  if (merged.length === 0) return []
  const shuffled = merged.map((q) => localizeTopicQuiz(shuffleQuizChoices(q), locale))
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

export function pickWrittenExamQuestions(
  gradeId: string,
  chapterId: string,
  count: 3 | 5,
  locale: AppLocale = 'ru',
): WrittenExamItem[] {
  const pool = getWrittenExamPool(gradeId, chapterId)
  if (pool.length === 0) return []
  const shuffled = shuffle(pool)
  return shuffled
    .slice(0, Math.min(count, shuffled.length))
    .map((q) => localizeWrittenExam(q, locale))
}

export function pickOralExamQuestions(
  gradeId: string,
  chapterId: string,
  count: OralExamCount,
  locale: AppLocale = 'ru',
): OralExamItem[] {
  const pool = getOralExamPool(gradeId, chapterId)
  if (pool.length === 0) return []
  const shuffled = shuffle(pool)
  return shuffled
    .slice(0, Math.min(count, shuffled.length))
    .map((q) => localizeOralExam(q, locale))
}

export function mcqExamPoolSize(gradeId: string, chapterId: string, sectionId: string): number {
  return getMcqExamPool(gradeId, chapterId, sectionId).length + getChapterLogicalMcqPool(gradeId, chapterId).length
}

export function writtenExamPoolSize(gradeId: string, chapterId: string): number {
  return getWrittenExamPool(gradeId, chapterId).length
}

export function oralExamPoolSize(gradeId: string, chapterId: string): number {
  return getOralExamPool(gradeId, chapterId).length
}

export function examSectionKey(gradeId: string, chapterId: string, sectionId: string): string {
  return learnSectionPathKey(gradeId, chapterId, sectionId)
}
