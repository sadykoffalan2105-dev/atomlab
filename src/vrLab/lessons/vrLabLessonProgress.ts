import type { CuratedReactionId } from '../reactions/curatedReactions'
import { CURATED_REACTIONS } from '../reactions/curatedReactions'
import { syncVrPracticeToLearn } from './vrLabLearnBridge'
import { VR_LAB_LESSONS } from './vrLabLessonModules'
import type { LessonProgress } from './types'

const STORAGE_KEY = 'atomlab.vrLab.lessonProgress'

function readAll(): Record<string, LessonProgress> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, LessonProgress>) : {}
  } catch {
    return {}
  }
}

function writeAll(data: Record<string, LessonProgress>) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function readLessonProgress(lessonId: string): LessonProgress {
  const all = readAll()
  const raw = all[lessonId]
  if (!raw) {
    return {
      lessonId,
      theoryDone: false,
      quizScore: 0,
      quizPassed: false,
      practiceDone: false,
      completedReactionIds: [],
    }
  }
  return {
    ...raw,
    completedReactionIds: raw.completedReactionIds ?? [],
  }
}

export function isReactionCompleted(lessonId: string, reactionId: string): boolean {
  return readLessonProgress(lessonId).completedReactionIds.includes(reactionId)
}

export function markTheoryDone(lessonId: string): LessonProgress {
  const all = readAll()
  const cur = readLessonProgress(lessonId)
  const next = { ...cur, theoryDone: true }
  all[lessonId] = next
  writeAll(all)
  return next
}

export function markQuizResult(lessonId: string, score: number, passed: boolean): LessonProgress {
  const all = readAll()
  const cur = readLessonProgress(lessonId)
  const next = { ...cur, quizScore: score, quizPassed: passed || cur.quizPassed }
  all[lessonId] = next
  writeAll(all)
  return next
}

export function markPracticeDone(lessonId: string, reactionId?: CuratedReactionId): LessonProgress {
  const all = readAll()
  const cur = readLessonProgress(lessonId)
  const reactions = reactionId
    ? [...new Set([...cur.completedReactionIds, reactionId])]
    : cur.completedReactionIds
  const next = {
    ...cur,
    practiceDone: true,
    completedReactionIds: reactions,
    completedAt: cur.completedAt ?? new Date().toISOString(),
  }
  all[lessonId] = next
  writeAll(all)
  syncVrPracticeToLearn(lessonId)
  return next
}

export function vrLabLessonSummary(): {
  lessonsDone: number
  reactionsDone: number
  lessonTotal: number
  reactionTotal: number
} {
  const all = readAll()
  let lessonsDone = 0
  let reactionsDone = 0
  for (const lesson of VR_LAB_LESSONS) {
    const p = all[lesson.id] ?? readLessonProgress(lesson.id)
    if (p.practiceDone) lessonsDone++
    reactionsDone += p.completedReactionIds.length
  }
  return {
    lessonsDone,
    reactionsDone,
    lessonTotal: VR_LAB_LESSONS.length,
    reactionTotal: CURATED_REACTIONS.length,
  }
}

export function isLessonPracticeUnlocked(lessonId: string): boolean {
  const p = readLessonProgress(lessonId)
  return p.quizPassed
}
