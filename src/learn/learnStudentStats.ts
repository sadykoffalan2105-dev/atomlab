import type { ClassStudent, ClassTestAttempt, StudentTestKind } from './learnClassRosterStorage'

export type KindStats = {
  attempts: number
  avgPct: number | null
  last: ClassTestAttempt | null
}

export type StudentMasteryStats = {
  student: ClassStudent
  byKind: Record<StudentTestKind, KindStats>
  overallAvgPct: number | null
  masteryLevel: 'strong' | 'good' | 'needsWork' | 'none'
  recentAttempts: ClassTestAttempt[]
}

function attemptPct(a: ClassTestAttempt): number {
  return a.total > 0 ? Math.round((a.score / a.total) * 100) : 0
}

function normalizeKind(kind: ClassTestAttempt['kind'] | undefined): StudentTestKind {
  return kind ?? 'molecule'
}

function kindStats(attempts: ClassTestAttempt[], kind: StudentTestKind): KindStats {
  const filtered = attempts.filter((a) => normalizeKind(a.kind) === kind)
  if (filtered.length === 0) {
    return { attempts: 0, avgPct: null, last: null }
  }
  const sum = filtered.reduce((acc, a) => acc + attemptPct(a), 0)
  return {
    attempts: filtered.length,
    avgPct: Math.round(sum / filtered.length),
    last: filtered[filtered.length - 1] ?? null,
  }
}

export function computeStudentMastery(student: ClassStudent): StudentMasteryStats {
  const attempts = student.attempts
  const byKind: Record<StudentTestKind, KindStats> = {
    molecule: kindStats(attempts, 'molecule'),
    topic: kindStats(attempts, 'topic'),
    ai: kindStats(attempts, 'ai'),
  }

  const lastAttempts = attempts.slice(-10).reverse()
  const lastScores = attempts.map(attemptPct)
  const overallAvgPct =
    lastScores.length > 0
      ? Math.round(lastScores.reduce((a, b) => a + b, 0) / lastScores.length)
      : null

  let masteryLevel: StudentMasteryStats['masteryLevel'] = 'none'
  if (overallAvgPct !== null) {
    if (overallAvgPct >= 85) masteryLevel = 'strong'
    else if (overallAvgPct >= 65) masteryLevel = 'good'
    else masteryLevel = 'needsWork'
  }

  return {
    student,
    byKind,
    overallAvgPct,
    masteryLevel,
    recentAttempts: lastAttempts,
  }
}

export function collectWeakTopics(attempts: ClassTestAttempt[]): string[] {
  const ids = new Set<string>()
  for (const a of attempts) {
    for (const id of a.wrongQuestionIds ?? []) ids.add(id)
  }
  return [...ids].slice(0, 8)
}
