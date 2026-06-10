import { learnSectionPathKey } from '../data/learnFgosMatrix'
import { getTopicQuizPool } from './g7TopicQuizEngine'
import {
  getLogicalMcqForChapter,
  getOralQuestionsForChapter,
  getWrittenQuestionsForChapter,
} from './g7LogicalQuestions'
import type { OralExamItem, TopicQuizItem, WrittenExamItem } from './topicQuizTypes'
import type { StudentTestLength } from './studentTestScoring'

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

/** MCQ-пул: базовые вопросы § + логические вопросы главы. */
export function getMcqExamPool(gradeId: string, chapterId: string, sectionId: string): TopicQuizItem[] {
  const base = getTopicQuizPool(gradeId, chapterId, sectionId)
  if (gradeId !== 'g7') return base
  const logical = getLogicalMcqForChapter(chapterNum(chapterId))
  const seen = new Set(base.map((q) => q.id))
  const extra = logical.filter((q) => !seen.has(q.id))
  return [...base, ...extra]
}

export function getWrittenExamPool(gradeId: string, chapterId: string): WrittenExamItem[] {
  if (gradeId !== 'g7') return []
  return getWrittenQuestionsForChapter(chapterNum(chapterId))
}

export function getOralExamPool(gradeId: string, chapterId: string): OralExamItem[] {
  if (gradeId !== 'g7') return []
  return getOralQuestionsForChapter(chapterNum(chapterId))
}

export function pickMcqExamQuestions(
  gradeId: string,
  chapterId: string,
  sectionId: string,
  count: StudentTestLength,
): TopicQuizItem[] {
  const pool = getMcqExamPool(gradeId, chapterId, sectionId)
  if (pool.length === 0) return []
  const shuffled = shuffle(pool)
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

export function pickWrittenExamQuestions(
  gradeId: string,
  chapterId: string,
  count: 3 | 5,
): WrittenExamItem[] {
  const pool = getWrittenExamPool(gradeId, chapterId)
  if (pool.length === 0) return []
  const shuffled = shuffle(pool)
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

export function pickOralExamQuestions(
  gradeId: string,
  chapterId: string,
  count: 3 | 5,
): OralExamItem[] {
  const pool = getOralExamPool(gradeId, chapterId)
  if (pool.length === 0) return []
  const shuffled = shuffle(pool)
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

export function mcqExamPoolSize(gradeId: string, chapterId: string, sectionId: string): number {
  return getMcqExamPool(gradeId, chapterId, sectionId).length
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
