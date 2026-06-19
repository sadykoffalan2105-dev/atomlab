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
  return (
    all[lessonId] ?? {
      lessonId,
      theoryDone: false,
      quizScore: 0,
      quizPassed: false,
      practiceDone: false,
    }
  )
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

export function markPracticeDone(lessonId: string): LessonProgress {
  const all = readAll()
  const cur = readLessonProgress(lessonId)
  const next = {
    ...cur,
    practiceDone: true,
    completedAt: new Date().toISOString(),
  }
  all[lessonId] = next
  writeAll(all)
  return next
}

export function isLessonPracticeUnlocked(lessonId: string): boolean {
  const p = readLessonProgress(lessonId)
  return p.quizPassed
}
